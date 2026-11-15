import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The e2e workflows (e2e-cadence, decisions 1 to 3, D1 to D3; delta spec `packaging`, The release
// workflow), read as data: `e2e.yml` and the two reusable workflows it composes, `browser.yml` and
// `conformance.yml`, and the lines of `ci.yml` and `release.yml` that moved with them. The workflows
// run nowhere until the pull request's own run (task 7.2); these tests are their review. The
// repository is public, so a pull request from a fork runs `e2e.yml`: the safety points of decision 3
// are checked on all three files.

const ROOT = join(import.meta.dir, "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const file = (name: string): string => join(WORKFLOWS, `${name}.yml`);

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  if?: string | boolean;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  name?: string;
  needs?: string | string[];
  if?: string | boolean;
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: unknown;
  permissions?: Record<string, string>;
  "runs-on"?: string;
  "timeout-minutes"?: number;
  outputs?: Record<string, string>;
  strategy?: { matrix?: Record<string, unknown>; "fail-fast"?: boolean };
  env?: Record<string, string>;
  steps?: Step[];
};
type Workflow = {
  on: Record<
    string,
    | { inputs?: Record<string, Record<string, unknown>>; cron?: string }[]
    | Record<string, unknown>
    | null
  >;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; "cancel-in-progress"?: string | boolean };
  jobs: Record<string, Job>;
};

const read = (name: string): { text: string; workflow: Workflow } => {
  const text = readFileSync(file(name), "utf8");
  return { text, workflow: Bun.YAML.parse(text) as Workflow };
};
const e2e = read("e2e");
const browser = read("browser");
const conformance = read("conformance");
const ci = read("ci");
const release = read("release");
const E2E_FILES = { e2e, browser, conformance };
// The text without its full-line comments, which explain the rules and so name what they forbid.
const code = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
// What of `text` the pattern matches, or nothing: a failure names the match, not the whole file.
const found = (text: string, pattern: RegExp): string => pattern.exec(code(text))?.[0] ?? "";

const job = (workflow: Workflow, name: string): Job => {
  const found = workflow.jobs[name];
  if (found === undefined) throw new Error(`no job ${name}`);
  return found;
};
const stepsOf = (workflow: Workflow, name: string): Step[] => job(workflow, name).steps ?? [];
const needsOf = (value: Job): string[] =>
  value.needs === undefined ? [] : Array.isArray(value.needs) ? value.needs : [value.needs];
const plan = (): Job => job(e2e.workflow, "plan");
const planStep = (id: string): Step => {
  const found = stepsOf(e2e.workflow, "plan").find((step) => step.id === id);
  if (found === undefined) throw new Error(`no plan step ${id}`);
  return found;
};
const allJobs = Object.entries(E2E_FILES).flatMap(([file, { workflow }]) =>
  Object.entries(workflow.jobs).map(([name, value]) => ({ file, name, job: value })),
);
const allSteps = allJobs.flatMap(({ file, name, job: value }) =>
  (value.steps ?? []).map((step) => ({ where: `${file}/${name}`, step })),
);
const cron = (workflow: Workflow): string[] =>
  ((workflow.on.schedule ?? []) as { cron?: string }[]).flatMap((entry) =>
    entry.cron === undefined ? [] : [entry.cron],
  );

// The `cadence` step of the plan job, run as the runner runs it: the event reaches it through env.
// A scratch GITHUB_OUTPUT file takes what it prints.
describe("the plan job's cadence table (decision 1)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "e2e-plan-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const decide = (
    env: Record<string, string>,
  ): { code: number; out: Record<string, string>; text: string } => {
    const step = planStep("cadence");
    const output = join(dir, "output");
    Bun.write(output, "");
    const result = Bun.spawnSync(["sh", "-c", step.run ?? "exit 99"], {
      cwd: dir,
      env: {
        PATH: process.env.PATH ?? "",
        GITHUB_OUTPUT: output,
        EVENT: "",
        INPUT: "",
        SCHEDULE: "",
        ENGINES: "",
        ...env,
      },
    });
    const out: Record<string, string> = {};
    for (const line of readFileSync(output, "utf8").split("\n")) {
      const at = line.indexOf("=");
      if (at > 0) out[line.slice(0, at)] = line.slice(at + 1);
    }
    return {
      code: result.exitCode,
      out,
      text: result.stdout.toString() + result.stderr.toString(),
    };
  };
  const NIGHTLY = "23 2 * * *";
  const WEEKLY = "23 4 * * 6";

  test("the step takes the event, the input and the schedule through env, as the plan step's env", () => {
    const step = planStep("cadence");
    expect(Object.keys(step.env ?? {}).sort()).toEqual(["ENGINES", "EVENT", "INPUT", "SCHEDULE"]);
    expect(step.env?.ENGINES).toBe("${{ inputs.engines }}");
    expect(step.env?.EVENT).toBe("${{ github.event_name }}");
    expect(step.env?.INPUT).toBe("${{ inputs.cadence }}");
    expect(step.env?.SCHEDULE).toBe("${{ github.event.schedule }}");
  });

  test("a pull request is the smoke cadence: Linux, the smoke set in Chromium, one shard, Bun, no perf (D1)", () => {
    const { code, out } = decide({ EVENT: "pull_request" });
    expect(code).toBe(0);
    expect(out).toEqual({
      cadence: "smoke",
      runner: "ubuntu-24.04",
      "build-artifact": "e2e-build-linux",
      set: "smoke",
      engines: '["chromium"]',
      shards: '["1/1"]',
      runtimes: '["bun"]',
      perf: "false",
      timings: "false",
    });
  });

  test("the nightly cron is the nightly cadence: Linux, the full set, three engines by four shards, the perf pass, Node 24 and Node 26 (D2, Q1)", () => {
    const { code, out } = decide({ EVENT: "schedule", SCHEDULE: NIGHTLY });
    expect(code).toBe(0);
    expect(out).toEqual({
      cadence: "nightly",
      runner: "ubuntu-24.04",
      "build-artifact": "e2e-build-linux",
      set: "full",
      engines: '["chromium","firefox","webkit"]',
      shards: '["1/4","2/4","3/4","4/4"]',
      runtimes: '["node-24","node-26"]',
      perf: "true",
      timings: "true",
    });
  });

  test("the weekly cron is the weekly cadence: macOS, the full set, the perf pass, Bun, Node 24 and Node 26 (D3, Q1)", () => {
    const { code, out } = decide({ EVENT: "schedule", SCHEDULE: WEEKLY });
    expect(code).toBe(0);
    expect(out).toMatchObject({
      cadence: "weekly",
      runner: "macos-latest",
      "build-artifact": "e2e-build-macos",
      set: "full",
      engines: '["chromium","firefox","webkit"]',
      shards: '["1/4","2/4","3/4","4/4"]',
      runtimes: '["bun","node-24","node-26"]',
      perf: "true",
      timings: "false",
    });
  });

  test("a dispatch and the release's call take the cadence they name, whatever the event", () => {
    for (const cadence of ["smoke", "nightly", "weekly"]) {
      const dispatched = decide({ EVENT: "workflow_dispatch", INPUT: cadence });
      const called = decide({ EVENT: "workflow_call", INPUT: cadence });
      expect(dispatched.out.cadence).toBe(cadence);
      expect(called.out).toEqual(dispatched.out);
    }
    // The release's call: the event is the caller's dispatch, the input is `weekly`.
    expect(decide({ EVENT: "workflow_dispatch", INPUT: "weekly" }).out.runner).toBe("macos-latest");
  });

  test("an event, a schedule or a cadence it does not know fails, naming it, and sets no output", () => {
    const refused: Record<string, string>[] = [
      { EVENT: "push" },
      { EVENT: "schedule", SCHEDULE: "0 0 * * *" },
      { EVENT: "schedule" },
      { EVENT: "workflow_dispatch", INPUT: "hourly" },
      { EVENT: "workflow_dispatch" },
      { EVENT: "workflow_call", INPUT: "" },
    ];
    for (const env of refused) {
      const { code, out, text } = decide(env);
      expect(code).not.toBe(0);
      expect(out).toEqual({});
      expect(text).toContain("::error::");
    }
    expect(decide({ EVENT: "workflow_dispatch", INPUT: "hourly" }).text).toContain("hourly");
  });

  // Coordinator decision C6 (review 5.5, S-1): the release gate runs Chromium and WebKit only until
  // #174 and #145 close; the `engines` input of the call replaces the cadence's engines.
  test("an `engines` list replaces the cadence's engines and nothing else (C6)", () => {
    const narrowed = '["chromium","webkit"]';
    for (const cadence of ["smoke", "nightly", "weekly"]) {
      const plain = decide({ EVENT: "workflow_call", INPUT: cadence });
      const called = decide({ EVENT: "workflow_call", INPUT: cadence, ENGINES: narrowed });
      expect(called.code).toBe(0);
      expect(called.out.engines).toBe(narrowed);
      expect({ ...called.out, engines: "" }).toEqual({ ...plain.out, engines: "" });
    }
    expect(
      decide({ EVENT: "workflow_call", INPUT: "weekly", ENGINES: '["firefox"]' }).out.engines,
    ).toBe('["firefox"]');
  });

  test("no `engines` input leaves every engine the cadence names: the schedules and the dispatch never set one", () => {
    expect(decide({ EVENT: "schedule", SCHEDULE: WEEKLY }).out.engines).toBe(
      '["chromium","firefox","webkit"]',
    );
    expect(decide({ EVENT: "workflow_call", INPUT: "weekly" }).out.engines).toBe(
      '["chromium","firefox","webkit"]',
    );
    expect(decide({ EVENT: "workflow_dispatch", INPUT: "nightly" }).out.engines).toBe(
      '["chromium","firefox","webkit"]',
    );
  });

  test("an `engines` value that is not a JSON list of known engines fails, naming it, and sets no output", () => {
    const refused = [
      "chromium",
      "[]",
      '["opera"]',
      '["chromium","chromium2"]',
      '["chromium"] ; echo x',
      '["chromium"],["webkit"]',
      '["chromium","$(id)"]',
      '[ "chromium" ]',
      '["chromium"]\ncadence=x',
      '["chromium"]\n',
      '["chromium"]\r',
      '["chromium"]\r\nrunner=x',
      '\n["chromium"]',
    ];
    for (const ENGINES of refused) {
      const { code, out, text } = decide({ EVENT: "workflow_call", INPUT: "weekly", ENGINES });
      expect(code).not.toBe(0);
      expect(out).toEqual({});
      expect(text).toContain("::error::");
    }
  });

  test("the call takes `engines` as a string, optional and empty by default, and `no-cache` as a boolean, false by default (C6, X-1)", () => {
    const call = (
      e2e.workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> }
    ).inputs;
    expect(call.engines?.type).toBe("string");
    expect(call.engines?.required).not.toBe(true);
    expect(call.engines?.default).toBe("");
    expect(call["no-cache"]?.type).toBe("boolean");
    expect(call["no-cache"]?.default).toBe(false);
    // The comment names the Issues that are the condition to restore Firefox.
    expect(e2e.text).toMatch(/#174[\s\S]*#145|#145[\s\S]*#174/);
  });

  test("every cron line of e2e.yml is in the table, and none is ci.yml's", () => {
    expect(cron(e2e.workflow)).toEqual([NIGHTLY, WEEKLY]);
    expect(cron(ci.workflow)).toEqual(["17 3 * * *"]);
    for (const line of cron(e2e.workflow)) expect(cron(ci.workflow)).not.toContain(line);
  });

  test("the plan job's outputs are the table's, each from the step that sets it", () => {
    const outputs = plan().outputs ?? {};
    expect(Object.keys(outputs).sort()).toEqual(
      [
        "build-artifact",
        "cadence",
        "code",
        "engines",
        "perf",
        "runner",
        "runtimes",
        "set",
        "shards",
        "timings",
      ].sort(),
    );
    expect(outputs.code).toBe("${{ steps.paths.outputs.code }}");
    for (const [name, value] of Object.entries(outputs)) {
      if (name !== "code") expect(value).toBe(`\${{ steps.cadence.outputs.${name} }}`);
    }
  });
});

describe("the triggers (decision 1)", () => {
  const { workflow } = e2e;
  test("pull_request, the two schedules, a dispatch and a call, and nothing else", () => {
    expect(Object.keys(workflow.on).sort()).toEqual(
      ["pull_request", "schedule", "workflow_call", "workflow_dispatch"].sort(),
    );
  });

  test("the dispatch and the call take a cadence: smoke, nightly or weekly", () => {
    const dispatch = (
      workflow.on.workflow_dispatch as { inputs: Record<string, Record<string, unknown>> }
    ).inputs.cadence;
    expect(dispatch?.type).toBe("choice");
    expect(dispatch?.options).toEqual(["smoke", "nightly", "weekly"]);
    const call = (workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> })
      .inputs.cadence;
    expect(call?.type).toBe("string");
    expect(call?.required).toBe(true);
  });

  test("the pull_request trigger never filters by path: the status exists for every change", () => {
    expect(workflow.on.pull_request ?? null).toBeNull();
    expect(found(e2e.text, /paths(-ignore)?:/)).toBe("");
  });
});

describe("the code gate and the always-run rule (decision 1, #173)", () => {
  test("the plan job takes `code` from changed-paths.sh on a checkout of depth 2", () => {
    const steps = stepsOf(e2e.workflow, "plan");
    const checkout = steps.findIndex((step) => step.uses?.startsWith("actions/checkout@"));
    const paths = steps.findIndex((step) => step.id === "paths");
    expect(checkout).toBe(0);
    expect(steps[checkout]?.with?.["fetch-depth"]).toBe(2);
    expect(steps[paths]?.run).toBe('sh tools/ci/changed-paths.sh >> "$GITHUB_OUTPUT"');
    expect(paths).toBeGreaterThan(checkout);
    expect(plan()["runs-on"]).toBe("ubuntu-24.04");
  });

  test("no e2e workflow holds a list of paths of its own: the one list is the script's", () => {
    for (const [name, { text }] of Object.entries(E2E_FILES)) {
      expect(`${name}: ${found(text, /\b(docs|openspec|drafts)\/|\*\.md|git diff/)}`).toBe(
        `${name}: `,
      );
    }
  });

  test("build, browser and conformance have no job-level `if`; perf and timings, never a pull request status, alone have one", () => {
    for (const name of ["plan", "build", "browser", "conformance"]) {
      expect(job(e2e.workflow, name).if).toBeUndefined();
    }
    const guarded = Object.entries(e2e.workflow.jobs)
      .filter(([, value]) => value.if !== undefined)
      .map(([name]) => name)
      .sort();
    expect(guarded).toEqual(["perf", "timings"]);
    expect(job(e2e.workflow, "perf").if).toBe("${{ needs.plan.outputs.perf == 'true' }}");
  });

  test("the called workflows get `code` as a boolean from the plan", () => {
    for (const name of ["browser", "perf", "conformance"]) {
      expect(job(e2e.workflow, name).with?.code).toBe("${{ needs.plan.outputs.code == 'true' }}");
    }
  });

  test("with `code` false each job ends after one step that says why, and no other step runs", () => {
    const ending: [string, Step[]][] = [
      ["e2e.yml build", stepsOf(e2e.workflow, "build")],
      ["browser.yml", stepsOf(browser.workflow, "browser")],
      ["conformance.yml", stepsOf(conformance.workflow, "conformance")],
    ];
    for (const [where, steps] of ending) {
      const [first, ...rest] = steps;
      expect(`${where}: ${String(first?.if)}`).toMatch(
        /!inputs\.code|needs\.plan\.outputs\.code != 'true'/,
      );
      expect(first?.run).toMatch(/^echo "Only documents changed/);
      expect(first?.uses).toBeUndefined();
      expect(rest.length).toBeGreaterThan(0);
      for (const step of rest) {
        expect(`${where}: ${step.name ?? step.uses ?? step.run}: ${String(step.if)}`).toMatch(
          /inputs\.code|needs\.plan\.outputs\.code == 'true'/,
        );
        expect(String(step.if)).not.toMatch(/!inputs\.code|code != 'true'/);
      }
    }
  });

  test("browser.yml and conformance.yml take `code` as a boolean that defaults to true", () => {
    for (const { workflow } of [browser, conformance]) {
      const inputs = (
        workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> }
      ).inputs;
      expect(inputs.code?.type).toBe("boolean");
      expect(inputs.code?.default).toBe(true);
    }
  });

  test("the jobs are plan, build, browser, perf, conformance and timings, in the order of their needs", () => {
    expect(Object.keys(e2e.workflow.jobs)).toEqual([
      "plan",
      "build",
      "browser",
      "perf",
      "conformance",
      "timings",
    ]);
    expect(needsOf(job(e2e.workflow, "plan"))).toEqual([]);
    expect(needsOf(job(e2e.workflow, "build"))).toEqual(["plan"]);
    for (const name of ["browser", "perf", "conformance"]) {
      expect(needsOf(job(e2e.workflow, name)).sort()).toEqual(["build", "plan"]);
    }
  });
});

describe("concurrency (decision 1)", () => {
  test("ci.yml's group with the cadence added, cancelling only a pull request's superseded run", () => {
    expect(ci.workflow.concurrency?.group).toBe(
      "${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}",
    );
    expect(e2e.workflow.concurrency?.group).toBe(
      "${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}-${{ inputs.cadence || github.event.schedule || github.event_name }}",
    );
    expect(e2e.workflow.concurrency?.["cancel-in-progress"]).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
    expect(ci.workflow.concurrency?.["cancel-in-progress"]).toBe(
      e2e.workflow.concurrency?.["cancel-in-progress"],
    );
  });
});

describe("the build, once per run (decision 2)", () => {
  const build = (): Step[] => stepsOf(e2e.workflow, "build");
  const upload = (): Step | undefined =>
    build().find((step) => step.uses?.startsWith("actions/upload-artifact@"));

  test("runs on the plan's runner: setup-bun, then bun run build, then the upload", () => {
    expect(job(e2e.workflow, "build")["runs-on"]).toBe("${{ needs.plan.outputs.runner }}");
    const at = (match: (step: Step) => boolean) => build().findIndex(match);
    const setup = at((step) => step.uses === "./.github/actions/setup-bun");
    const built = at((step) => step.run === "bun run build");
    const uploaded = at((step) => step.uses?.startsWith("actions/upload-artifact@") === true);
    expect(setup).toBeGreaterThan(0);
    expect(built).toBeGreaterThan(setup);
    expect(uploaded).toBeGreaterThan(built);
  });

  test("uploads dist/ and the built mod as the plan's artifact name, kept one day, and fails if empty", () => {
    expect(upload()?.with?.name).toBe("${{ needs.plan.outputs.build-artifact }}");
    expect(String(upload()?.with?.path).split("\n").filter(Boolean)).toEqual([
      "dist/",
      "hooks/askboard-mod.js",
    ]);
    expect(upload()?.with?.["retention-days"]).toBe(1);
    expect(upload()?.with?.["if-no-files-found"]).toBe("error");
  });

  test("browser.yml and conformance.yml download that artifact in place of building, and build when none is named", () => {
    for (const [where, workflow, name] of [
      ["browser.yml", browser.workflow, "browser"],
      ["conformance.yml", conformance.workflow, "conformance"],
    ] as const) {
      const inputs = (
        workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> }
      ).inputs;
      expect(inputs["build-artifact"]?.type).toBe("string");
      expect(inputs["build-artifact"]?.default).toBe("");
      const steps = stepsOf(workflow, name);
      const download = steps.find((step) => step.uses?.startsWith("actions/download-artifact@"));
      const built = steps.find((step) => step.run === "bun run build");
      expect(`${where}: ${download?.with?.name}`).toBe(`${where}: \${{ inputs.build-artifact }}`);
      expect(download?.with?.path).toBe(".");
      expect(String(download?.if)).toContain("inputs.build-artifact != ''");
      expect(String(built?.if)).toContain("inputs.build-artifact == ''");
    }
    for (const name of ["browser", "perf", "conformance"]) {
      expect(job(e2e.workflow, name).with?.["build-artifact"]).toBe(
        "${{ needs.plan.outputs.build-artifact }}",
      );
    }
  });

  test("an artifact is read in the run that made it: the downloads name no run, repository or token", () => {
    for (const { step } of allSteps) {
      if (!step.uses?.startsWith("actions/download-artifact@")) continue;
      for (const key of ["run-id", "repository", "github-token"]) {
        expect(Object.keys(step.with ?? {})).not.toContain(key);
      }
    }
  });
});

describe("browser.yml (decisions 1 to 3, 5; C5)", () => {
  const inputs = (
    browser.workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> }
  ).inputs;
  const steps = (): Step[] => stepsOf(browser.workflow, "browser");
  const testStep = (): Step | undefined =>
    steps().find((step) => step.run?.includes("browser/run.ts"));

  test("takes the inputs the design names, the defaults keeping today's manual run", () => {
    expect(Object.keys(inputs).sort()).toEqual(
      ["build-artifact", "cache", "code", "engines", "runs-on", "set", "shards", "workers"].sort(),
    );
    expect(inputs["runs-on"]?.default).toBe("macos-latest");
    expect(inputs.set?.default).toBe("all");
    expect(JSON.parse(String(inputs.engines?.default))).toEqual(["chromium", "firefox", "webkit"]);
    expect(JSON.parse(String(inputs.shards?.default))).toEqual(["1/1"]);
    expect(inputs.workers?.default).toBe("");
    expect(inputs.cache?.type).toBe("boolean");
    expect(inputs.cache?.default).toBe(true);
    for (const name of ["engines", "shards", "set", "workers"])
      expect(inputs[name]?.type).toBe("string");
  });

  test("a matrix of the engines by the shards, each cell a job on the caller's runner", () => {
    const value = job(browser.workflow, "browser");
    expect(value["runs-on"]).toBe("${{ inputs.runs-on }}");
    expect(value.strategy?.matrix).toEqual({
      engine: "${{ fromJSON(inputs.engines) }}",
      shard: "${{ fromJSON(inputs.shards) }}",
    });
    expect(value.strategy?.["fail-fast"]).toBe(false);
    expect(value.name).toContain("${{ matrix.engine }}");
    expect(value.name).toContain("${{ matrix.shard }}");
  });

  test("the Playwright cache and install steps follow the build or the download, the cache step as #173 left it", () => {
    const list = steps();
    const download = list.findIndex((step) => step.uses?.startsWith("actions/download-artifact@"));
    const built = list.findIndex((step) => step.run === "bun run build");
    const version = list.findIndex((step) => step.id === "playwright");
    const cache = list.findIndex((step) => step.uses?.startsWith("actions/cache@"));
    const install = list.findIndex((step) => step.run?.includes("playwright install --with-deps"));
    const tests = list.findIndex((step) => step.run?.includes("browser/run.ts"));
    expect(Math.max(download, built)).toBeLessThan(version);
    expect(version).toBeLessThan(cache);
    expect(cache).toBeLessThan(install);
    expect(install).toBeLessThan(tests);
    expect(list[cache]?.uses).toBe("actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
    expect(browser.text).toContain(
      "uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0\n",
    );
    expect(list[cache]?.with).toEqual({
      path: "${{ env.PLAYWRIGHT_BROWSERS_PATH }}",
      key: "playwright-${{ runner.os }}-${{ matrix.engine }}-${{ steps.playwright.outputs.version }}",
    });
    expect(job(browser.workflow, "browser").env?.PLAYWRIGHT_BROWSERS_PATH).toBe(
      "${{ github.workspace }}/.playwright-browsers",
    );
    expect(list[install]?.env?.ENGINE).toBe("${{ matrix.engine }}");
  });

  test("the BROWSER recorder stays job-wide (AD-18)", () => {
    expect(job(browser.workflow, "browser").env?.BROWSER).toBe(
      "${{ github.workspace }}/packages/view/test/browser/fixtures/record-link.sh",
    );
  });

  test("the run passes --set, --engines, --shard and --workers to run.ts, the values through env", () => {
    const step = testStep();
    expect(step?.env).toMatchObject({
      ENGINE: "${{ matrix.engine }}",
      SHARD: "${{ matrix.shard }}",
      SET: "${{ inputs.set }}",
      WORKERS: "${{ inputs.workers }}",
    });
    const script = step?.run ?? "";
    expect(script).toContain("--no-build --target session-process");
    for (const option of ["--set", "--engines", "--shard", "--workers", "--timings-out"]) {
      expect(script).toContain(option);
    }
    // --shard 1/1 is no shard: the all and perf sets refuse a shard.
    expect(script).toMatch(/"\$SHARD" != "1\/1"/);
  });

  test("the run is a shell script that runs for each value it takes: a real run of its argument list", () => {
    const script = testStep()?.run ?? "";
    // Replace the final exec with a printf of the arguments, then run the script as the runner does.
    const dir = mkdtempSync(join(tmpdir(), "e2e-browser-"));
    try {
      const probe = script.replace(
        /exec bun packages\/view\/test\/browser\/run\.ts "\$@"/,
        'printf "%s\\n" "$@"',
      );
      expect(probe).not.toBe(script);
      const argsFor = (env: Record<string, string>): string[] =>
        Bun.spawnSync(["sh", "-e", "-c", probe], {
          cwd: dir,
          env: { PATH: process.env.PATH ?? "", WORKERS: "", TIMINGS_FILE: "", ...env },
        })
          .stdout.toString()
          .trim()
          .split("\n");
      const common = ["--no-build", "--target", "session-process"];
      expect(argsFor({ SET: "smoke", ENGINE: "chromium", SHARD: "1/1" })).toEqual([
        ...common,
        "--set",
        "smoke",
        "--engines",
        "chromium",
      ]);
      expect(
        argsFor({
          SET: "full",
          ENGINE: "webkit",
          SHARD: "3/4",
          WORKERS: "2",
          TIMINGS_FILE: "timings-out/webkit-3of4.json",
        }),
      ).toEqual([
        ...common,
        "--set",
        "full",
        "--engines",
        "webkit",
        "--shard",
        "3/4",
        "--workers",
        "2",
        "--timings-out",
        "timings-out/webkit-3of4.json",
      ]);
      // The manual defaults: the set `all` and no shard.
      expect(argsFor({ SET: "all", ENGINE: "firefox", SHARD: "1/1" })).toEqual([
        ...common,
        "--set",
        "all",
        "--engines",
        "firefox",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a full set uploads its timings file (not timings/) as an artifact named after the engine and the shard", () => {
    const naming = steps().find((step) => step.id === "timings");
    expect(String(naming?.if)).toContain("inputs.set == 'full'");
    expect(naming?.env).toMatchObject({
      ENGINE: "${{ matrix.engine }}",
      SHARD: "${{ matrix.shard }}",
    });
    const dir = mkdtempSync(join(tmpdir(), "e2e-timings-"));
    try {
      const output = join(dir, "output");
      Bun.write(output, "");
      Bun.spawnSync(["sh", "-e", "-c", naming?.run ?? "exit 99"], {
        cwd: dir,
        env: {
          PATH: process.env.PATH ?? "",
          GITHUB_OUTPUT: output,
          ENGINE: "firefox",
          SHARD: "2/4",
        },
      });
      const lines = readFileSync(output, "utf8").trim().split("\n");
      expect(lines).toEqual([
        "name=timings-shard-firefox-2of4",
        "file=timings-out/firefox-2of4.json",
      ]);
      expect(Bun.file(join(dir, "timings-out")).size).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const upload = steps().find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.with?.name).toBe("${{ steps.timings.outputs.name }}");
    expect(upload?.with?.path).toBe("${{ steps.timings.outputs.file }}");
    expect(String(upload?.if)).toContain("inputs.set == 'full'");
    expect(String(upload?.if)).toContain("inputs.code");
    expect(JSON.stringify(upload)).not.toContain("timings/");
  });
});

describe("conformance.yml (decisions 1 to 3, Q1)", () => {
  const inputs = (
    conformance.workflow.on.workflow_call as { inputs: Record<string, Record<string, unknown>> }
  ).inputs;
  const steps = (): Step[] => stepsOf(conformance.workflow, "conformance");

  test("takes the runtimes as JSON, defaulting to today's Bun and Node 24", () => {
    expect(Object.keys(inputs).sort()).toEqual([
      "build-artifact",
      "cache",
      "code",
      "runs-on",
      "runtimes",
    ]);
    expect(inputs.cache?.type).toBe("boolean");
    expect(inputs.cache?.default).toBe(true);
    expect(inputs.runtimes?.type).toBe("string");
    expect(JSON.parse(String(inputs.runtimes?.default))).toEqual(["bun", "node-24"]);
    expect(job(conformance.workflow, "conformance").strategy?.matrix).toEqual({
      runtime: "${{ fromJSON(inputs.runtimes) }}",
    });
  });

  test("Node 26 is set up after the shared setup and before the suite, for that entry alone", () => {
    const list = steps();
    const setup = list.findIndex((step) => step.uses === "./.github/actions/setup-bun");
    const node26 = list.findIndex((step) => step.uses?.startsWith("actions/setup-node@"));
    const suite = list.findIndex((step) => step.run?.includes("conformance/run.ts"));
    expect(setup).toBeLessThan(node26);
    expect(node26).toBeLessThan(suite);
    expect(String(list[node26]?.if)).toContain("matrix.runtime == 'node-26'");
    expect(list[node26]?.with?.["node-version"]).toBe(26);
  });

  test("the suite gets the runtime kind through env, node for a Node entry and bun for the rest", () => {
    const suite = steps().find((step) => step.run?.includes("conformance/run.ts"));
    expect(suite?.run).toBe('bun packages/server/test/conformance/run.ts --runtime "$RUNTIME"');
    expect(suite?.env?.RUNTIME).toBe(
      "${{ startsWith(matrix.runtime, 'node') && 'node' || 'bun' }}",
    );
  });

  test("installs Chromium, which the suite's real board page launches, with the browser job's cache", () => {
    const list = steps();
    const cache = list.find((step) => step.uses?.startsWith("actions/cache@"));
    const install = list.find((step) => step.run?.includes("playwright install --with-deps"));
    expect(cache?.uses).toBe(
      browser.workflow.jobs.browser?.steps?.find((step) => step.uses?.startsWith("actions/cache@"))
        ?.uses,
    );
    expect(install?.run).toContain("chromium");
    expect(job(conformance.workflow, "conformance").env?.BROWSER).toBe(
      "${{ github.workspace }}/packages/view/test/browser/fixtures/record-link.sh",
    );
  });
});

describe("the cadences' jobs (decisions 1 to 3)", () => {
  test("perf calls browser.yml with the perf set, every engine, one shard and the plan's runner", () => {
    const value = job(e2e.workflow, "perf");
    expect(value.uses).toBe("./.github/workflows/browser.yml");
    expect(value.with).toMatchObject({
      set: "perf",
      engines: "${{ needs.plan.outputs.engines }}",
      shards: '["1/1"]',
      "runs-on": "${{ needs.plan.outputs.runner }}",
    });
  });

  test("browser calls browser.yml with the plan's set, engines and shards", () => {
    const value = job(e2e.workflow, "browser");
    expect(value.uses).toBe("./.github/workflows/browser.yml");
    expect(value.with).toMatchObject({
      set: "${{ needs.plan.outputs.set }}",
      engines: "${{ needs.plan.outputs.engines }}",
      shards: "${{ needs.plan.outputs.shards }}",
      "runs-on": "${{ needs.plan.outputs.runner }}",
    });
  });

  test("conformance calls conformance.yml with the plan's runtimes and runner", () => {
    const value = job(e2e.workflow, "conformance");
    expect(value.uses).toBe("./.github/workflows/conformance.yml");
    expect(value.with).toMatchObject({
      runtimes: "${{ needs.plan.outputs.runtimes }}",
      "runs-on": "${{ needs.plan.outputs.runner }}",
    });
  });

  test("timings follows the nightly browser shards, merges each engine's shard files and uploads the merged file (C5)", () => {
    const value = job(e2e.workflow, "timings");
    expect(needsOf(value).sort()).toEqual(["browser", "plan"]);
    expect(String(value.if)).toContain("needs.plan.outputs.timings == 'true'");
    expect(String(value.if)).toContain("!cancelled()");
    expect(value["timeout-minutes"]).toBeGreaterThan(0);
    expect(value.strategy?.matrix).toEqual({
      engine: "${{ fromJSON(needs.plan.outputs.engines) }}",
    });
    const steps = value.steps ?? [];
    const download = steps.find((step) => step.uses?.startsWith("actions/download-artifact@"));
    expect(download?.with).toMatchObject({
      pattern: "timings-shard-${{ matrix.engine }}-*",
      path: "shards",
      "merge-multiple": true,
    });
    const merge = steps.find((step) => step.run?.includes("tools/ci/merge-timings.ts"));
    expect(merge?.env?.ENGINE).toBe("${{ matrix.engine }}");
    expect(merge?.run).toContain("packages/view/test/browser/timings/$ENGINE.json");
    expect(merge?.run).toContain("--out");
    const upload = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    expect(upload?.with?.name).toBe("timings-merged-${{ matrix.engine }}");
    expect(steps.indexOf(download as Step)).toBeLessThan(steps.indexOf(merge as Step));
    expect(steps.indexOf(merge as Step)).toBeLessThan(steps.indexOf(upload as Step));
  });

  test("the merge step ends cleanly when no shard file arrived: the base file stands", () => {
    const merge = stepsOf(e2e.workflow, "timings").find((step) =>
      step.run?.includes("merge-timings.ts"),
    );
    const dir = mkdtempSync(join(tmpdir(), "e2e-merge-"));
    try {
      Bun.spawnSync(["mkdir", "-p", join(dir, "shards")]);
      const probe = (merge?.run ?? "").replace(/bun tools\/ci\/merge-timings\.ts/g, "echo merge");
      const result = Bun.spawnSync(["sh", "-e", "-c", probe], {
        cwd: dir,
        env: { PATH: process.env.PATH ?? "", ENGINE: "chromium" },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).not.toContain("merge ");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the weekly call from release.yml: publish needs e2e-macos, which calls e2e.yml with `weekly` and no secrets", () => {
    const call = job(release.workflow, "e2e-macos");
    expect(call.uses).toBe("./.github/workflows/e2e.yml");
    // C6 (review 5.5, S-1): Chromium and WebKit only until #174 and #145 close, Firefox staying in the
    // nightly and weekly cadences; and X-1: no Playwright cache in the release's run.
    expect(call.with).toEqual({
      cadence: "weekly",
      engines: '["chromium","webkit"]',
      "no-cache": true,
    });
    expect(release.text).toMatch(/#174[\s\S]*#145[\s\S]*Firefox|Firefox[\s\S]*#174[\s\S]*#145/);
    expect(call.secrets).toBeUndefined();
    expect(call.permissions).toEqual({ contents: "read" });
    expect(needsOf(job(release.workflow, "publish")).sort()).toEqual([
      "build",
      "e2e-firefox-smoke",
      "e2e-macos",
      "smoke-linux",
    ]);
    expect(found(release.text, /secrets:\s*inherit/)).toBe("");
  });

  // Security review X-1: while Firefox is out of `e2e-macos`, its smoke set (the token and sandbox
  // checks, view.browser.ts among them) still gates a release, on Linux, where it is green today.
  test("the release also calls e2e.yml with the smoke cadence in Firefox alone, no cache, no secrets, and publish needs it", () => {
    const call = job(release.workflow, "e2e-firefox-smoke");
    expect(call.uses).toBe("./.github/workflows/e2e.yml");
    expect(call.with).toEqual({ cadence: "smoke", engines: '["firefox"]', "no-cache": true });
    expect(call.secrets).toBeUndefined();
    expect(call.permissions).toEqual({ contents: "read" });
    expect(needsOf(job(release.workflow, "publish"))).toContain("e2e-firefox-smoke");
    expect(release.text).toMatch(/#174[\s\S]*#145[\s\S]*smoke|smoke[\s\S]*#174[\s\S]*#145/);
  });
});

describe("the Playwright cache is an input (X-1)", () => {
  test("browser.yml and conformance.yml restore the cache only when `cache` is true and code changed", () => {
    for (const [workflow, name] of [
      [browser.workflow, "browser"],
      [conformance.workflow, "conformance"],
    ] as const) {
      const cache = stepsOf(workflow, name).find((step) => step.uses?.startsWith("actions/cache@"));
      expect(String(cache?.if)).toContain("inputs.code");
      expect(String(cache?.if)).toContain("inputs.cache");
    }
  });

  test("e2e.yml passes the cache input to browser, perf and conformance, on unless no-cache is true", () => {
    for (const name of ["browser", "perf", "conformance"]) {
      expect(job(e2e.workflow, name).with?.cache).toBe("${{ !inputs.no-cache }}");
    }
  });

  test("a pull request or a schedule, whose `inputs` are empty, leaves the cache on: the expression is a negation, not a comparison", () => {
    for (const name of ["browser", "perf", "conformance"]) {
      expect(String(job(e2e.workflow, name).with?.cache)).toMatch(
        /^\$\{\{ !inputs\.no-cache \}\}$/,
      );
    }
  });
});

describe("ci.yml (decision 1, task 5.4)", () => {
  test("calls neither browser.yml nor conformance.yml, and says nothing of a dispatch for them", () => {
    expect(Object.keys(ci.workflow.jobs)).toEqual(["openspec", "check", "codex"]);
    const calls = Object.values(ci.workflow.jobs).map((value) => value.uses);
    expect(calls).toEqual([
      "./.github/workflows/openspec.yml",
      "./.github/workflows/check.yml",
      "./.github/workflows/codex.yml",
    ]);
    expect(found(ci.text, /browser\.yml|conformance\.yml/)).toBe("");
    // Nor do its comments send the suites to a dispatch.
    expect(ci.text).not.toMatch(/browser and conformance/i);
    expect(ci.text).not.toMatch(/only on demand/);
  });

  test("its three jobs run on a dispatch too: no job-level `if` on the event", () => {
    for (const [name, value] of Object.entries(ci.workflow.jobs)) {
      expect(`${name}: ${String(value.if)}`).toBe(`${name}: undefined`);
    }
    expect(found(ci.text, /workflow_dispatch'/)).toBe("");
    expect(Object.keys(ci.workflow.on)).toContain("workflow_dispatch");
  });

  test("keeps #173's runners and secrets: check on macOS off a pull request, secrets inherited by check alone", () => {
    expect(job(ci.workflow, "check").with?.["runs-on"]).toBe(
      "${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || 'macos-latest' }}",
    );
    expect(job(ci.workflow, "check").secrets).toBe("inherit");
    expect(job(ci.workflow, "openspec").secrets).toBeUndefined();
  });
});

describe("safe in a public repository (decision 3)", () => {
  test("the workflow grants contents: read and no job widens it", () => {
    for (const [name, { workflow }] of Object.entries(E2E_FILES)) {
      expect(`${name}: ${JSON.stringify(workflow.permissions)}`).toBe(
        `${name}: {"contents":"read"}`,
      );
      for (const [jobName, value] of Object.entries(workflow.jobs)) {
        expect(`${name}/${jobName}: ${JSON.stringify(value.permissions ?? null)}`).toBe(
          `${name}/${jobName}: null`,
        );
      }
    }
  });

  test("the trigger is pull_request, never pull_request_target, and no secret is passed or read", () => {
    for (const [name, { text }] of Object.entries(E2E_FILES)) {
      expect(`${name}: ${found(text, /pull_request_target|\bsecrets\b|GITHUB_TOKEN/)}`).toBe(
        `${name}: `,
      );
    }
  });

  test("no `${{ }}` expression inside a run script: the values go through env", () => {
    for (const { where, step } of allSteps) {
      if (step.run === undefined) continue;
      expect(`${where}: ${step.run}`).not.toContain("${{");
    }
  });

  test("every checkout drops its credentials", () => {
    const checkouts = allSteps.filter(({ step }) => step.uses?.startsWith("actions/checkout@"));
    expect(checkouts.length).toBeGreaterThanOrEqual(5);
    for (const { where, step } of checkouts) {
      expect(`${where}: ${step.with?.["persist-credentials"]}`).toBe(`${where}: false`);
    }
  });

  test("every `uses` is a local path or an actions/* action pinned by a 40-character SHA with its version", () => {
    const uses = Object.entries(E2E_FILES).flatMap(([name, { text }]) =>
      [...code(text).matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)].map((match) => ({
        name,
        action: match[1] ?? "",
        rest: match[2] ?? "",
      })),
    );
    expect(uses.length).toBeGreaterThan(10);
    for (const { name, action, rest } of uses) {
      if (action.startsWith("./")) {
        expect(`${name}: ${action}`).toMatch(
          /^[\w.]+: \.\/\.github\/(workflows\/(browser|conformance)\.yml|actions\/setup-bun)$/,
        );
        continue;
      }
      expect(`${name}: ${action}`).toMatch(/^[\w.]+: actions\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest).toMatch(/^ # v\d+\.\d+\.\d+$/);
    }
  });

  test("a pin is one SHA wherever it is used, the artifact pins those of release.yml", () => {
    const sha = (text: string, action: string): Set<string> =>
      new Set(
        [
          ...text.matchAll(new RegExp(`uses: (${action}@[0-9a-f]{40} # v\\d+\\.\\d+\\.\\d+)`, "g")),
        ].map((match) => match[1] ?? ""),
      );
    for (const action of [
      "actions/upload-artifact",
      "actions/download-artifact",
      "actions/setup-node",
      "actions/checkout",
    ]) {
      const releasePins = sha(release.text, action);
      const e2ePins = new Set(
        [e2e, browser, conformance].flatMap(({ text }) => [...sha(text, action)]),
      );
      for (const pin of e2ePins) {
        if (releasePins.size > 0) expect(releasePins.has(pin)).toBe(true);
      }
    }
  });

  test("every job that runs steps has a timeout; a job that calls a workflow has none, and the callee's jobs do", () => {
    for (const { file: name, name: jobName, job: value } of allJobs) {
      if (value.uses !== undefined) {
        expect(`${name}/${jobName}: ${value["timeout-minutes"]}`).toBe(
          `${name}/${jobName}: undefined`,
        );
        continue;
      }
      expect(`${name}/${jobName}: ${value["timeout-minutes"]}`).toMatch(/: [1-9]\d*$/);
    }
  });

  const actionlint = Bun.which("actionlint");
  test.skipIf(actionlint === null)("actionlint reports nothing on the four workflows", () => {
    for (const name of ["e2e", "browser", "conformance", "ci", "release"]) {
      const linted = Bun.spawnSync([actionlint ?? "actionlint", "-no-color", file(name)], {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(`${name}: ${linted.stdout.toString()}${linted.stderr.toString()}`).toBe(`${name}: `);
      expect(linted.exitCode).toBe(0);
    }
  });
});
