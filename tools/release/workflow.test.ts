import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The release workflow (plugin-release, design decision 6; packaging spec, "The release workflow"),
// read as data: who may run it, what each job may write, which actions it runs and in what order. The
// workflow runs nowhere until the PO dispatches it on `main` (task 5.3); these tests are its review.

const ROOT = join(import.meta.dir, "..", "..");
const FILE = join(ROOT, ".github", "workflows", "release.yml");
const text = readFileSync(FILE, "utf8");

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  if?: string;
  run?: string;
  shell?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  "runs-on"?: string;
  uses?: string;
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  "timeout-minutes"?: number;
  // A job that calls a reusable workflow (`e2e-macos`) has no steps and no timeout of its own.
  steps?: Step[];
  outputs?: Record<string, string>;
};
type Workflow = {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  jobs: Record<string, Job>;
};

const workflow = Bun.YAML.parse(text) as Workflow;
const jobs = workflow.jobs;
const job = (name: string): Job => {
  const found = jobs[name];
  if (found === undefined) throw new Error(`no job ${name}`);
  return found;
};
const steps = (name: string): Step[] => job(name).steps ?? [];
const runs = (name: string): string[] =>
  steps(name).flatMap((step) => (step.run ? [step.run] : []));
const needs = (name: string): string[] => {
  const declared = job(name).needs;
  return declared === undefined ? [] : Array.isArray(declared) ? declared : [declared];
};
const allSteps = Object.entries(jobs).flatMap(([name, value]) =>
  (value.steps ?? []).map((step) => ({ job: name, step })),
);
const indexOfRun = (name: string, fragment: string): number =>
  steps(name).findIndex((step) => step.run?.includes(fragment));

describe("the release workflow", () => {
  test("has the four jobs, on the runners the design names", () => {
    expect(Object.keys(jobs)).toEqual(["build", "smoke-linux", "e2e-macos", "publish"]);
    expect(job("build")["runs-on"]).toBe("macos-latest");
    expect(job("smoke-linux")["runs-on"]).toBe("ubuntu-24.04");
    expect(job("publish")["runs-on"]).toBe("ubuntu-24.04");
  });

  test("the trigger is workflow_dispatch alone, with no inputs", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch ?? {}).toEqual({});
  });

  test("a run does not cancel another: one workflow-wide group, a fixed name", () => {
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
    expect(workflow.concurrency?.group).toBeDefined();
    expect(workflow.concurrency?.group).not.toContain("${{");
  });

  test("only publish has a write permission, and every job states its own", () => {
    for (const name of Object.keys(jobs)) {
      const permissions = job(name).permissions;
      expect(permissions).toBeDefined();
      const writes = Object.entries(permissions ?? {}).filter(([, level]) => level !== "read");
      expect(writes.length > 0).toBe(name === "publish");
    }
    expect(job("publish").permissions).toEqual({ contents: "write" });
    expect(job("build").permissions).toEqual({ contents: "read" });
    expect(job("smoke-linux").permissions).toEqual({ contents: "read" });
    // Nothing is granted for the whole workflow.
    expect(Object.values(workflow.permissions ?? {}).filter((level) => level !== "read")).toEqual(
      [],
    );
  });

  test("every remote action is pinned to a commit SHA, with its version as a comment", () => {
    const uses = [...text.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)].map((match) => ({
      action: match[1] ?? "",
      rest: match[2] ?? "",
    }));
    const remote = uses.filter(({ action }) => !action.startsWith("./"));
    expect(remote.length).toBeGreaterThanOrEqual(5);
    for (const { action, rest } of remote) {
      expect(action).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest).toMatch(/^ # v\d+\.\d+\.\d+$/);
    }
    // The artifact actions are among them.
    const names = remote.map(({ action }) => action.split("@")[0]);
    expect(names).toContain("actions/upload-artifact");
    expect(names).toContain("actions/download-artifact");
    // Local actions and workflows are the repository's own: the shared setup, and e2e.yml, which
    // e2e-macos calls (e2e-cadence, decision 1).
    expect(
      uses.filter(({ action }) => action.startsWith("./")).map(({ action }) => action),
    ).toEqual(["./.github/actions/setup-bun", "./.github/workflows/e2e.yml"]);
  });

  // X-1 (review 5.5): the release run shares its artifact namespace with the e2e jobs of `e2e-macos`,
  // so the jobs that read the artifact take the one the build job uploaded, by its ID.
  test("build exposes the upload's artifact-id, and smoke-linux and publish download by that ID, not by name", () => {
    const upload = steps("build").find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.id).toBe("upload");
    expect((job("build") as { outputs?: Record<string, string> }).outputs).toEqual({
      "artifact-id": "${{ steps.upload.outputs.artifact-id }}",
    });
    for (const name of ["smoke-linux", "publish"]) {
      const download = steps(name).find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      );
      expect(download?.with?.["artifact-ids"]).toBe("${{ needs.build.outputs.artifact-id }}");
      expect(download?.with?.name).toBeUndefined();
      expect(download?.with?.["merge-multiple"]).toBe(true);
      expect(download?.with?.path).toBe("release");
      expect(download?.with?.["digest-mismatch"] ?? "error").toBe("error");
    }
  });

  test("publish needs build, smoke-linux and e2e-macos, and smoke-linux needs build", () => {
    expect(needs("publish").sort()).toEqual(["build", "e2e-macos", "smoke-linux"]);
    expect(needs("smoke-linux")).toEqual(["build"]);
    expect(needs("build")).toEqual([]);
  });

  test("build refuses any ref but main before it checks out, then runs preflight before the check", () => {
    const refusal = steps("build")[0];
    expect(refusal?.if).toContain("refs/heads/main");
    expect(refusal?.run).toContain("exit 1");
    const checkout = steps("build").findIndex((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout).toBeGreaterThan(0);
    const preflight = indexOfRun("build", "tools/release/preflight.ts");
    const check = indexOfRun("build", "bun run check");
    const build = indexOfRun("build", "bun run build");
    expect(preflight).toBeGreaterThan(checkout);
    expect(check).toBeGreaterThan(preflight);
    expect(build).toBeGreaterThan(check);
  });

  test("build assembles, smokes, packages and uploads, in that order", () => {
    const order = [
      indexOfRun("build", "bun run build"),
      indexOfRun("build", "tools/release/assemble.ts"),
      indexOfRun("build", "tools/release/tool-names.ts"),
      indexOfRun("build", "tools/release/smoke.ts"),
      indexOfRun("build", "tools/release/package.ts"),
      steps("build").findIndex((step) => step.uses?.startsWith("actions/upload-artifact@")),
    ];
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("the artifact keeps hidden files: the tree's .claude-plugin folder is one", () => {
    const upload = steps("build").find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.with?.["include-hidden-files"]).toBe(true);
    expect(upload?.with?.["if-no-files-found"]).toBe("error");
    expect(upload?.with?.path).toBe("release/");
  });

  test("every checkout drops its credentials, and build fetches every tag", () => {
    const checkouts = allSteps.filter(({ step }) => step.uses?.startsWith("actions/checkout@"));
    expect(checkouts.length).toBeGreaterThanOrEqual(2);
    for (const { step } of checkouts) expect(step.with?.["persist-credentials"]).toBe(false);
    const build = steps("build").find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(build?.with?.["fetch-depth"]).toBe(0);
    expect(build?.with?.["fetch-tags"]).toBe(true);
  });

  test("no github context is interpolated into a run script: it goes through env", () => {
    for (const { job: name, step } of allSteps) {
      if (step.run === undefined) continue;
      expect(`${name}: ${step.run}`).not.toContain("${{");
    }
    // The values the scripts read are the runner's own variables or come through env.
    const publish = runs("publish").join("\n");
    expect(publish).toMatch(/\$\{GITHUB_REPOSITORY\}/);
    expect(publish).toMatch(/\$\{GITHUB_SHA\}/);
  });

  test("the only secret is the job's GITHUB_TOKEN: build's check, publish's git and gh steps", () => {
    const secrets = [...text.matchAll(/secrets\.([A-Za-z_]+)/g)].map((match) => match[1]);
    expect(secrets.length).toBeGreaterThan(0);
    expect(new Set(secrets)).toEqual(new Set(["GITHUB_TOKEN"]));
    for (const { job: name, step } of allSteps) {
      const reads = Object.values(step.env ?? {}).some((value) =>
        String(value).includes("secrets."),
      );
      if (!reads) continue;
      if (name === "build") expect(step.run).toBe("bun run check");
      else expect(name).toBe("publish");
    }
    expect(JSON.stringify(job("smoke-linux"))).not.toContain("secrets.");
  });

  test("smoke-linux uses Node and sh only: no Bun, no install, and it verifies the sums", () => {
    const names = steps("smoke-linux").map((step) => step.uses ?? "");
    expect(names.some((name) => name.includes("setup-bun"))).toBe(false);
    expect(runs("smoke-linux").join("\n")).not.toMatch(/\bbun\b|npm |yarn |pnpm /);
    expect(indexOfRun("smoke-linux", "node tools/release/smoke.ts")).toBeGreaterThan(-1);
    expect(runs("smoke-linux").join("\n")).toContain("sha256sum -c SHA256SUMS");
    expect(
      steps("smoke-linux").find((step) => step.uses?.startsWith("actions/setup-node@"))?.with?.[
        "node-version-file"
      ],
    ).toBe("package.json");
  });

  test("publish runs no code of the repository or the artifact: no checkout, no setup, no package manager", () => {
    for (const step of steps("publish")) {
      expect(step.uses?.startsWith("actions/checkout@") ?? false).toBe(false);
      expect(step.uses?.startsWith("actions/setup-") ?? false).toBe(false);
      expect(step.uses?.startsWith("./") ?? false).toBe(false);
    }
    const script = runs("publish").join("\n");
    expect(script).not.toMatch(/\b(bun|npm|npx|node|yarn|pnpm)\b/);
    expect(
      steps("publish").some((step) => step.uses?.startsWith("actions/download-artifact@")),
    ).toBe(true);
  });

  test("publish verifies the sums, then commits the tree to release, tags it and pushes both at once", () => {
    const script = runs("publish").join("\n");
    const sums = script.indexOf("sha256sum -c SHA256SUMS");
    const commit = script.indexOf(" commit-tree ");
    const tag = script.indexOf("git tag");
    const push = script.indexOf("git push");
    const release = script.indexOf("gh release create");
    expect(sums).toBeGreaterThanOrEqual(0);
    expect([sums, commit, tag, push, release].every((at) => at >= 0)).toBe(true);
    expect([sums, commit, tag, push, release]).toEqual(
      [sums, commit, tag, push, release].sort((a, b) => a - b),
    );
    expect(script).toContain("release: v${VERSION} from ${GITHUB_SHA}");
    expect(script).toMatch(
      /git push --atomic origin HEAD:refs\/heads\/release "refs\/tags\/v\$\{VERSION\}"/,
    );
    // The tag is checked in advance too, so that a refusal does not leave a release branch commit.
    expect(script).not.toMatch(/--force|-f\b/);
    // The commit is made with a repository outside the artifact, from the zip's files.
    expect(script).toContain('GIT_DIR="$RUNNER_TEMP/release.git"');
    expect(script).toContain('GIT_WORK_TREE="$RUNNER_TEMP/release-tree"');
    expect(script).toContain("unzip -q");
  });

  test("the GitHub release carries the notes and the three files", () => {
    const script = runs("publish").join("\n");
    expect(script).toContain('--notes-file "release/notes.md"');
    expect(script).toContain('"release/askboard-${VERSION}.mjs"');
    expect(script).toContain('"release/askboard-${VERSION}.zip"');
    expect(script).toContain('"release/SHA256SUMS"');
    expect(script).toContain("--verify-tag");
  });

  test("the version that publish uses comes from the artifact and is checked whole to be x.y.z", () => {
    const script = runs("publish").join("\n");
    expect(script).toContain("tree/.claude-plugin/plugin.json");
    // One bash match on the whole string: a line-by-line grep would pass a version with a second line.
    expect(script).toContain("[[ ! $VERSION =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]");
    expect(script).not.toMatch(/printf .*\| grep/);
    // GITHUB_ENV is written after the version check and the sums, never before.
    const version = script.indexOf("=~");
    const sums = script.indexOf("sha256sum -c SHA256SUMS");
    const env = script.indexOf('>> "$GITHUB_ENV"');
    expect(version).toBeGreaterThanOrEqual(0);
    expect(env).toBeGreaterThan(sums);
    expect(env).toBeGreaterThan(version);
  });

  test("every job that runs steps has a timeout; the one that calls e2e.yml has none, and e2e.yml's jobs do", () => {
    for (const name of Object.keys(jobs)) {
      if (job(name).uses !== undefined) expect(job(name)["timeout-minutes"]).toBeUndefined();
      else expect(job(name)["timeout-minutes"]).toBeGreaterThan(0);
    }
    expect(job("e2e-macos").uses).toBe("./.github/workflows/e2e.yml");
  });

  const actionlint = Bun.which("actionlint");
  test.skipIf(actionlint === null)("actionlint reports nothing", () => {
    const linted = Bun.spawnSync([actionlint ?? "actionlint", "-no-color", FILE], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(linted.stdout.toString() + linted.stderr.toString()).toBe("");
    expect(linted.exitCode).toBe(0);
  });
});
