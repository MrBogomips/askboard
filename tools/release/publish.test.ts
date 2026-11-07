import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// The publish job's steps, run for real (plugin-release task 3.5; packaging spec, "The release
// workflow"; design decision 6). The test takes the `run:` scripts of `publish` out of the workflow
// file and runs them in order with bash, the way the runner does, against what the build job would
// have uploaded. Nothing leaves the machine: the GitHub URL is rewritten to a bare repository in a
// temporary folder (`insteadOf`), `gh` is a stub first on PATH, the git configuration is isolated, and
// every git command that touches a repository does so through a `GIT_DIR` in the temporary folder, so
// the repository's own `.git` is never read or written. The artifact is untrusted: a tree that carries
// a `.git/config`, a version with a second line or files that are not the zip's must stop the job
// before any command of the artifact runs and before anything is pushed.

const ROOT = join(import.meta.dir, "..", "..");
const REPOSITORY = "owner/repo";
const MAIN_SHA = "0123456789abcdef0123456789abcdef01234567";
const FAKE_TOKEN = "ghs_FAKE_WRITE_TOKEN";

type Step = { name?: string; uses?: string; run?: string; env?: Record<string, string> };
const workflow = Bun.YAML.parse(
  readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8"),
) as { jobs: { publish: { steps: Step[] } } };
const publishSteps = workflow.jobs.publish.steps;
const FIRST_RUN = publishSteps.findIndex((step) => step.run !== undefined);

const tools = ["bash", "git", "jq", "unzip", "zip", "diff", "find", "sha256sum"];
const missing = tools.filter((tool) => Bun.which(tool) === null);

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
const scratch = (): string => {
  const folder = mkdtempSync(join(tmpdir(), "askboard-publish-"));
  folders.push(folder);
  return folder;
};

type Tree = Record<string, string | { content: string; mode: number }>;

const pluginJson = (version: string): string =>
  `${JSON.stringify({ name: "askboard", version })}\n`;
const sha = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

const writeTree = (tree: string, files: Tree): void => {
  for (const [path, entry] of Object.entries(files)) {
    const file = join(tree, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof entry === "string" ? entry : entry.content);
    if (typeof entry !== "string") chmodSync(file, entry.mode);
  }
};

type Artifact = {
  /** The tree's files, which are also the zip's unless `zipOnly` or `zipExtra` say otherwise. */
  readonly files: Tree;
  /** The version the file names carry, which the plugin.json inside may contradict. */
  readonly named?: string;
  /** Files written into the tree after the zip was made. */
  readonly treeExtra?: Tree;
  /** Files only in the zip. */
  readonly zipExtra?: Tree;
  /** Left out of the SHA256SUMS file. */
  readonly omitFromSums?: "zip" | "bundle";
  /** The bundle asset's text, when it is not the zip's `dist/askboard.mjs` (the sums follow it). */
  readonly bundle?: string;
  /** The notes file's text, when it is not the zip's CHANGELOG section. */
  readonly notes?: string;
  /** Makes `release/notes.md` a link to a file with the right text. */
  readonly notesAsLink?: boolean;
};

/** What the build job writes as notes: the body of the version's section, as a file. */
const noteText = "Notes for the release.\n\n- an item\n";

/** The `release/` folder the build job uploads, in a workspace; returns the workspace. */
const makeWorkspace = (name: string, spec: Artifact): string => {
  const workspace = join(scratch(), name);
  const release = join(workspace, "release");
  const tree = join(release, "tree");
  mkdirSync(tree, { recursive: true });
  writeTree(tree, spec.files);
  const version = spec.named ?? "0.1.0";
  const zipped = join(release, `askboard-${version}.zip`);
  const staging = join(workspace, "zip-staging");
  mkdirSync(staging, { recursive: true });
  writeTree(staging, spec.files);
  writeTree(staging, spec.zipExtra ?? {});
  const list = [...Object.keys(spec.files), ...Object.keys(spec.zipExtra ?? {})].join("\n");
  const made = Bun.spawnSync(["zip", "-X", "-D", "-q", "-9", zipped, "-@"], {
    cwd: staging,
    stdin: Buffer.from(`${list}\n`),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (made.exitCode !== 0) throw new Error(`zip: ${made.stderr.toString()}`);
  writeTree(tree, spec.treeExtra ?? {});
  const inZip = spec.files["dist/askboard.mjs"];
  const bundle = spec.bundle ?? (typeof inZip === "string" ? inZip : `// bundle ${version}\n`);
  writeFileSync(join(release, `askboard-${version}.mjs`), bundle);
  const notes = spec.notes ?? noteText;
  if (spec.notesAsLink) {
    writeFileSync(join(workspace, "real-notes.md"), notes);
    symlinkSync(join(workspace, "real-notes.md"), join(release, "notes.md"));
  } else {
    writeFileSync(join(release, "notes.md"), notes);
  }
  const sums = [
    spec.omitFromSums === "bundle" ? "" : `${sha(bundle)}  askboard-${version}.mjs\n`,
    spec.omitFromSums === "zip" ? "" : `${sha(readFileSync(zipped))}  askboard-${version}.zip\n`,
  ].join("");
  writeFileSync(join(release, "SHA256SUMS"), sums);
  return workspace;
};

const releaseFiles = (version: string, extra: Tree = {}): Tree => ({
  ".claude-plugin/plugin.json": pluginJson(version),
  "scripts/askboard": { content: "#!/bin/sh\nexit 0\n", mode: 0o755 },
  "dist/askboard.mjs": `// bundle ${version}\n`,
  "README.md": "readme\n",
  "CHANGELOG.md": `# Changelog\n\n## ${version} - 2026-11-07\n\n${noteText}\n## 0.0.9\n\nold\n`,
  ...extra,
});

type Remote = { dir: string; config: string; stubs: string; log: string; home: string };

const makeRemote = (reachable = true): Remote => {
  const base = scratch();
  const dir = join(base, "remote.git");
  const stubs = join(base, "stubs");
  const home = join(base, "home");
  const log = join(base, "gh.log");
  const config = join(base, "gitconfig");
  mkdirSync(stubs);
  mkdirSync(home);
  const target = reachable ? dir : join(base, "no-such-remote.git");
  writeFileSync(
    config,
    `[url "file://${target}"]\n\tinsteadOf = https://github.com/${REPOSITORY}.git\n`,
  );
  // The `gh` the job calls: `auth setup-git` does nothing; `release create` records its arguments, the
  // token it was given and whether each file it uploads exists.
  writeFileSync(
    join(stubs, "gh"),
    `#!/bin/sh
if [ "$1 $2" = "auth setup-git" ]; then echo "gh auth setup-git token=\${GH_TOKEN:-none}" >> "${log}"; exit 0; fi
if [ "$1 $2" = "release create" ]; then
  echo "gh $* token=\${GH_TOKEN:-none}" >> "${log}"
  for arg in "$@"; do case "$arg" in release/askboard-*|release/SHA256SUMS) [ -f "$arg" ] || exit 9;; esac; done
  exit 0
fi
echo "gh: unexpected: $*" >&2
exit 2
`,
  );
  chmodSync(join(stubs, "gh"), 0o755);
  isolated(["init", "--quiet", "--bare", dir], { config, home });
  return { dir, config, stubs, log, home };
};

const baseEnv = (remote: Pick<Remote, "config" | "home">): Record<string, string> => ({
  HOME: remote.home,
  GIT_CONFIG_GLOBAL: remote.config,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_CEILING_DIRECTORIES: tmpdir(),
  LC_ALL: "C",
});

const isolated = (
  args: string[],
  remote: Pick<Remote, "config" | "home">,
  cwd = tmpdir(),
): string => {
  const ran = Bun.spawnSync(["git", ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", ...baseEnv(remote) },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (ran.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${ran.stderr.toString()}`);
  return ran.stdout.toString();
};
const remoteGit = (remote: Remote, ...args: string[]): string =>
  isolated(["--git-dir", remote.dir, ...args], remote);

type Outcome = {
  /** The index of the step that failed, or undefined. */
  failed: number | undefined;
  output: string;
  githubEnv: string;
  temp: string;
};

/** Runs publish's `run:` steps in `workspace` with bash -e, applying GITHUB_ENV between steps. */
const runPublish = (workspace: string, remote: Remote, sha1 = MAIN_SHA): Outcome => {
  const temp = join(dirname(workspace), "runner-temp");
  mkdirSync(temp, { recursive: true });
  const githubEnv = join(dirname(workspace), "github-env");
  writeFileSync(githubEnv, "");
  const carried: Record<string, string> = {};
  let output = "";
  let failed: number | undefined;
  publishSteps.forEach((step, index) => {
    if (failed !== undefined || step.run === undefined) return;
    const env: Record<string, string> = {
      PATH: `${remote.stubs}:${process.env.PATH ?? ""}`,
      ...baseEnv(remote),
      RUNNER_TEMP: temp,
      GITHUB_ENV: githubEnv,
      GITHUB_REPOSITORY: REPOSITORY,
      GITHUB_SHA: sha1,
      GITHUB_WORKSPACE: workspace,
      ...carried,
    };
    // The workflow gives the token only to the steps whose `env:` names it.
    if (step.env?.GH_TOKEN !== undefined) env.GH_TOKEN = FAKE_TOKEN;
    const ran = Bun.spawnSync(["bash", "-e", "-c", step.run], {
      cwd: workspace,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    output += `${ran.stdout.toString()}${ran.stderr.toString()}`;
    for (const line of readFileSync(githubEnv, "utf8").split("\n")) {
      const found = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (found?.[1] !== undefined) carried[found[1]] = found[2] ?? "";
    }
    if (ran.exitCode !== 0) failed = index;
  });
  return { failed, output, githubEnv: readFileSync(githubEnv, "utf8"), temp };
};

const tags = (remote: Remote): string[] =>
  remoteGit(remote, "tag", "--list").split("\n").filter(Boolean);
const branches = (remote: Remote): string[] =>
  remoteGit(remote, "branch", "--list").split("\n").filter(Boolean);
const treeOf = (remote: Remote, ref: string): Record<string, string> => {
  const listing = remoteGit(remote, "ls-tree", "-r", "--format=%(objectmode) %(path)", ref);
  const found: Record<string, string> = {};
  for (const line of listing.split("\n").filter(Boolean)) {
    const [mode, path] = [line.slice(0, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1)];
    found[path] = `${mode} ${remoteGit(remote, "show", `${ref}:${path}`)}`;
  }
  return found;
};
const expected = (files: Tree): Record<string, string> =>
  Object.fromEntries(
    Object.entries(files).map(([path, entry]) => [
      path,
      typeof entry === "string" ? `100644 ${entry}` : `100755 ${entry.content}`,
    ]),
  );

const markerRun = (marker: string): Tree => ({
  ".git/config": `[core]\n\tfsmonitor = "echo fsmonitor GH_TOKEN=$GH_TOKEN >> ${marker}; exit 1 #"\n[credential]\n\thelper = "!echo helper GH_TOKEN=$GH_TOKEN >> ${marker} #"\n`,
});

const nothingPublished = (remote: Remote): void => {
  expect(tags(remote)).toEqual([]);
  expect(branches(remote)).toEqual([]);
  expect(existsSync(remote.log) ? readFileSync(remote.log, "utf8") : "").not.toContain(
    "release create",
  );
};

describe.skipIf(missing.length > 0)("the publish job's steps, run against local files", () => {
  test("a first release: an orphan commit holding exactly the tree, tagged, pushed and released", () => {
    const remote = makeRemote();
    const files = releaseFiles("0.1.0");
    const outcome = runPublish(makeWorkspace("w", { files }), remote);
    expect(outcome.output).not.toMatch(/error|fatal|warning/i);
    expect(outcome.failed).toBeUndefined();
    expect(outcome.githubEnv).toBe("VERSION=0.1.0\n");
    expect(branches(remote).map((line) => line.trim())).toEqual(["release"]);
    expect(tags(remote)).toEqual(["v0.1.0"]);
    expect(remoteGit(remote, "rev-list", "--count", "release").trim()).toBe("1");
    expect(remoteGit(remote, "rev-parse", "v0.1.0^{commit}")).toBe(
      remoteGit(remote, "rev-parse", "release"),
    );
    expect(remoteGit(remote, "log", "-1", "--format=%s", "release").trim()).toBe(
      `release: v0.1.0 from ${MAIN_SHA}`,
    );
    expect(remoteGit(remote, "log", "-1", "--format=%an <%ae>", "release").trim()).toBe(
      "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>",
    );
    expect(treeOf(remote, "release")).toEqual(expected(files));
    const log = readFileSync(remote.log, "utf8");
    expect(log).toContain("gh release create v0.1.0 --repo owner/repo --title v0.1.0");
    expect(log).toContain("--notes-file release/notes.md --verify-tag");
    expect(log).toContain(
      "release/askboard-0.1.0.mjs release/askboard-0.1.0.zip release/SHA256SUMS",
    );
  });

  test("a second release goes on top of the first, and a file the new tree lacks is gone from the branch", () => {
    const remote = makeRemote();
    const first = releaseFiles("0.1.0", { "skills/old.md": "old\n", "kept.md": "kept\n" });
    const second = releaseFiles("0.1.1", { "kept.md": "kept, changed\n", "added.md": "new\n" });
    const one = runPublish(makeWorkspace("one", { files: first }), remote, "a".repeat(40));
    expect(one.failed).toBeUndefined();
    const two = runPublish(
      makeWorkspace("two", { files: second, named: "0.1.1" }),
      remote,
      "b".repeat(40),
    );
    expect(two.output).not.toMatch(/error|fatal|warning/i);
    expect(two.failed).toBeUndefined();
    expect(remoteGit(remote, "rev-list", "--count", "release").trim()).toBe("2");
    expect(tags(remote)).toEqual(["v0.1.0", "v0.1.1"]);
    expect(treeOf(remote, "v0.1.0")).toEqual(expected(first));
    expect(treeOf(remote, "release")).toEqual(expected(second));
    expect(treeOf(remote, "release")["skills/old.md"]).toBeUndefined();
    expect(remoteGit(remote, "rev-parse", "release~1")).toBe(
      remoteGit(remote, "rev-parse", "v0.1.0^{commit}"),
    );
    expect(remoteGit(remote, "log", "--format=%s", "release").trim().split("\n")).toEqual([
      `release: v0.1.1 from ${"b".repeat(40)}`,
      `release: v0.1.0 from ${"a".repeat(40)}`,
    ]);
    expect(remoteGit(remote, "rev-list", "--max-parents=0", "release").trim()).toBe(
      remoteGit(remote, "rev-parse", "v0.1.0^{commit}").trim(),
    );
  });

  test("a tree that holds .git/config is refused: its fsmonitor and credential helper never run, nothing is pushed", () => {
    const remote = makeRemote();
    const marker = join(scratch(), "marker");
    const workspace = makeWorkspace("w", {
      files: releaseFiles("0.1.0"),
      treeExtra: markerRun(marker),
    });
    const outcome = runPublish(workspace, remote);
    expect(outcome.failed).toBeDefined();
    expect(existsSync(marker)).toBe(false);
    expect(outcome.githubEnv).not.toContain("BASH_ENV");
    nothingPublished(remote);
  });

  test("an archive that itself holds .git/config is refused too, before git runs", () => {
    const remote = makeRemote();
    const marker = join(scratch(), "marker");
    const hostile = markerRun(marker);
    const workspace = makeWorkspace("w", {
      files: { ...releaseFiles("0.1.0"), ...hostile },
    });
    const outcome = runPublish(workspace, remote);
    expect(outcome.failed).toBeDefined();
    expect(outcome.output).toContain(".git");
    expect(existsSync(marker)).toBe(false);
    nothingPublished(remote);
  });

  test("other git metadata in the archive is refused: .gitattributes, .gitmodules, .gitignore", () => {
    for (const name of [".gitattributes", ".gitmodules", "skills/.gitignore"]) {
      const remote = makeRemote();
      const workspace = makeWorkspace("w", {
        files: { ...releaseFiles("0.1.0"), [name]: "x\n" },
      });
      expect(runPublish(workspace, remote).failed).toBeDefined();
      nothingPublished(remote);
    }
  });

  test.each([
    ["a second line", "0.1.0\nBASH_ENV=/tmp/evil"],
    ["a trailing line break and more", "0.1.0\n\nX=1"],
    ["two parts", "1.2"],
    ["a pre-release suffix", "0.1.0-rc1"],
    ["a word", "latest"],
    ["a path", "0.1.0/../../x"],
    ["an empty string", ""],
  ])("a version with %s is refused before GITHUB_ENV is written", (_label, version) => {
    const remote = makeRemote();
    const workspace = makeWorkspace("w", { files: releaseFiles(version), named: "0.1.0" });
    const outcome = runPublish(workspace, remote);
    expect(outcome.failed).toBe(FIRST_RUN);
    expect(outcome.githubEnv).toBe("");
    expect(outcome.output).toContain("major.minor.patch");
    nothingPublished(remote);
  });

  test("a plugin.json with no string version is refused", () => {
    const remote = makeRemote();
    const workspace = makeWorkspace("w", {
      files: { ...releaseFiles("0.1.0"), ".claude-plugin/plugin.json": '{"version":1}\n' },
    });
    const outcome = runPublish(workspace, remote);
    expect(outcome.failed).toBe(FIRST_RUN);
    expect(outcome.githubEnv).toBe("");
    nothingPublished(remote);
  });

  test.each([
    ["a file changed after the zip was made", { treeExtra: { "README.md": "changed\n" } }],
    ["a file added to the tree", { treeExtra: { "extra.md": "extra\n" } }],
    ["a file only in the zip", { zipExtra: { "only-in-zip.md": "z\n" } }],
  ] as [string, Partial<Artifact>][])(
    "a tree that differs from the verified zip is refused: %s",
    (_label, extra) => {
      const remote = makeRemote();
      const outcome = runPublish(
        makeWorkspace("w", { files: releaseFiles("0.1.0"), ...extra }),
        remote,
      );
      expect(outcome.failed).toBeDefined();
      expect(outcome.output).toMatch(/differ|not the zip/i);
      nothingPublished(remote);
    },
  );

  test("a zip whose hash is not in SHA256SUMS, or a sums file without the zip, is refused", () => {
    const tampered = makeRemote();
    const workspace = makeWorkspace("w", { files: releaseFiles("0.1.0") });
    writeFileSync(join(workspace, "release", "askboard-0.1.0.zip"), "not the zip\n");
    expect(runPublish(workspace, tampered).failed).toBe(FIRST_RUN);
    nothingPublished(tampered);

    for (const omit of ["zip", "bundle"] as const) {
      const remote = makeRemote();
      const outcome = runPublish(
        makeWorkspace("w", { files: releaseFiles("0.1.0"), omitFromSums: omit }),
        remote,
      );
      expect(outcome.failed).toBe(FIRST_RUN);
      expect(outcome.githubEnv).toBe("");
      nothingPublished(remote);
    }
  });

  test("a bundle asset that is not the zip's dist/askboard.mjs is refused, even with matching sums", () => {
    const remote = makeRemote();
    const outcome = runPublish(
      makeWorkspace("w", { files: releaseFiles("0.1.0"), bundle: "// another bundle\n" }),
      remote,
    );
    expect(outcome.failed).toBeDefined();
    expect(outcome.output).toMatch(/bundle/i);
    nothingPublished(remote);
  });

  test("release notes that are not the zip's CHANGELOG section are refused", () => {
    for (const notes of ["Other notes.\n", `${noteText}\nand one more line\n`]) {
      const remote = makeRemote();
      const outcome = runPublish(
        makeWorkspace("w", { files: releaseFiles("0.1.0"), notes }),
        remote,
      );
      expect(outcome.failed).toBeDefined();
      expect(outcome.output).toMatch(/notes/i);
      nothingPublished(remote);
    }
  });

  test("a link anywhere under release/ is refused, not only inside the tree", () => {
    const remote = makeRemote();
    const outcome = runPublish(
      makeWorkspace("w", { files: releaseFiles("0.1.0"), notesAsLink: true }),
      remote,
    );
    expect(outcome.failed).toBeDefined();
    expect(outcome.output).toMatch(/link or a special file/i);
    nothingPublished(remote);
  });

  test("a version that is already tagged is refused, and nothing moves", () => {
    const remote = makeRemote();
    const files = releaseFiles("0.1.0");
    expect(runPublish(makeWorkspace("one", { files }), remote).failed).toBeUndefined();
    const before = remoteGit(remote, "rev-parse", "release");
    const again = runPublish(
      makeWorkspace("two", { files: { ...files, "README.md": "other\n" } }),
      remote,
    );
    expect(again.failed).toBeDefined();
    expect(again.output).toContain("v0.1.0 already exists");
    expect(remoteGit(remote, "rev-parse", "release")).toBe(before);
    expect(remoteGit(remote, "rev-list", "--count", "release").trim()).toBe("1");
  });

  test("a remote that cannot be read refuses the job: no tag is created, nothing is released", () => {
    const remote = makeRemote(false);
    const outcome = runPublish(makeWorkspace("w", { files: releaseFiles("0.1.0") }), remote);
    expect(outcome.failed).toBeDefined();
    expect(existsSync(remote.log) ? readFileSync(remote.log, "utf8") : "").not.toContain(
      "release create",
    );
  });

  test("the token reaches only the steps that talk to GitHub", () => {
    const remote = makeRemote();
    const outcome = runPublish(makeWorkspace("w", { files: releaseFiles("0.1.0") }), remote);
    expect(outcome.failed).toBeUndefined();
    const withToken = publishSteps.filter((step) => step.env?.GH_TOKEN !== undefined);
    for (const step of publishSteps) {
      const talks = /ls-remote|git fetch|git push|gh release|gh auth/.test(step.run ?? "");
      expect(step.env?.GH_TOKEN !== undefined).toBe(talks);
    }
    expect(withToken.length).toBe(3);
    const log = readFileSync(remote.log, "utf8");
    expect(log).toContain(`token=${FAKE_TOKEN}`);
  });

  test("the job leaves the folder it ran in without a .git, and the artifact's folders unchanged", () => {
    const remote = makeRemote();
    const workspace = makeWorkspace("w", { files: releaseFiles("0.1.0") });
    runPublish(workspace, remote);
    expect(existsSync(join(workspace, ".git"))).toBe(false);
    expect(existsSync(join(workspace, "release", "tree", ".git"))).toBe(false);
  });
});

test("the tools the publish tests need are installed", () => {
  expect(missing).toEqual([]);
});
