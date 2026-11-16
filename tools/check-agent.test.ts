import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHECK_STEPS,
  COVERAGE_THRESHOLD,
  coverageBelow,
  logFileOf,
  main,
  REPORT_LIMIT,
  runStep,
  type StepRun,
  stepReport,
} from "./check-agent.ts";

const ROOT = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("the quiet check runs what `bun run check` runs", () => {
  test("the same steps, in the same order", () => {
    expect(pkg.scripts.check).toBe(CHECK_STEPS.map((step) => `bun run ${step}`).join(" && "));
  });

  test("the coverage threshold is bunfig.toml's", () => {
    const bunfig = readFileSync(join(ROOT, "bunfig.toml"), "utf8");
    expect(bunfig).toContain(`coverageThreshold = ${COVERAGE_THRESHOLD}`);
  });

  test("is the script check:agent", () => {
    expect(pkg.scripts["check:agent"]).toBe("bun tools/check-agent.ts");
  });
});

const COVERAGE = `-----------|---------|---------|-------------------
File       | % Funcs | % Lines | Uncovered Line #s
-----------|---------|---------|-------------------
All files  |   93.10 |   95.00 |
 packages/a/src/good.ts |  100.00 |  100.00 |
 packages/a/src/thin.ts |   50.00 |   90.00 | 4-9
 packages/a/src/lines.ts |   90.00 |   79.99 | 12
-----------|---------|---------|-------------------

 10 pass
 0 fail
Ran 10 tests across 3 files. [2.00ms]
`;

describe("coverageBelow: the rows of the coverage table under the threshold", () => {
  test("files whose functions or lines are under 80%, with their uncovered lines", () => {
    expect(coverageBelow(COVERAGE)).toEqual([
      "packages/a/src/thin.ts: 50.00% functions, 90.00% lines (uncovered 4-9)",
      "packages/a/src/lines.ts: 90.00% functions, 79.99% lines (uncovered 12)",
    ]);
  });
});

describe("stepReport: what the console shows of a step", () => {
  test("a passing step is one line, whatever it printed", () => {
    expect(stepReport("test", 0, COVERAGE, 12.34)).toBe("ok   test in 12.3 s");
  });

  test("failing tests: one line each, then the counts, and no coverage table", () => {
    const output = `packages/a/test/x.test.ts:
error: expect(received).toBe(expected)
(fail) x > works [1.00ms]
${COVERAGE.replace(" 0 fail", " 1 fail")}`;
    expect(stepReport("test", 1, output, 3).split("\n")).toEqual([
      "FAIL test in 3.0 s",
      "  x.test.ts > x > works: error: expect(received).toBe(expected)",
      "  10 pass",
      "  1 fail",
    ]);
  });

  test("a test step that fails with no failing test is the coverage threshold: its rows", () => {
    expect(stepReport("test", 1, COVERAGE, 3).split("\n")).toEqual([
      "FAIL test in 3.0 s",
      "  coverage under 80%:",
      "  packages/a/src/thin.ts: 50.00% functions, 90.00% lines (uncovered 4-9)",
      "  packages/a/src/lines.ts: 90.00% functions, 79.99% lines (uncovered 12)",
      "  10 pass",
      "  0 fail",
    ]);
  });

  test("any other failing step: the end of its output, within the limit", () => {
    const output = Array.from({ length: 500 }, (_, at) => `line ${at} ${"z".repeat(40)}`).join(
      "\n",
    );
    const report = stepReport("lint", 1, output, 1);
    expect(report.startsWith("FAIL lint in 1.0 s\n")).toBe(true);
    expect(report).toContain("line 499");
    expect(report).not.toContain("line 0 ");
    expect(new TextEncoder().encode(report).length).toBeLessThanOrEqual(REPORT_LIMIT);
  });
});

describe("main: the steps in turn, stopping at the first failure, the full output in the log", () => {
  const inTemp = async (body: (dir: string) => Promise<void>) => {
    const dir = mkdtempSync(join(tmpdir(), "check-agent-"));
    try {
      await body(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test("every step passes: one line each, then PASS and the log", () =>
    inTemp(async (dir) => {
      const printed: string[] = [];
      const log = join(dir, "sub", "check.log");
      const code = await main(["--log", log], {
        run: async (step) => ({ code: 0, output: `${step} said a lot\n`, seconds: 1 }),
        print: (text) => printed.push(text),
      });
      expect(code).toBe(0);
      expect(printed).toEqual([
        ...CHECK_STEPS.map((step) => `ok   ${step} in 1.0 s`),
        `check: PASS; full log: ${log}`,
      ]);
      expect(readFileSync(log, "utf8")).toContain(
        "=== check:licences (exit 0) ===\ncheck:licences said a lot",
      );
    }));

  test("a failing step stops the run, and the steps after it never run", () =>
    inTemp(async (dir) => {
      const ran: string[] = [];
      const printed: string[] = [];
      const log = join(dir, "check.log");
      const code = await main(["--log", log], {
        run: async (step): Promise<StepRun> => {
          ran.push(step);
          return step === "lint"
            ? { code: 1, output: "lint error here", seconds: 2 }
            : { code: 0, output: "", seconds: 1 };
        },
        print: (text) => printed.push(text),
      });
      expect(code).toBe(1);
      expect(ran).toEqual(["typecheck", "lint"]);
      expect(printed.slice(1)).toEqual([
        "FAIL lint in 2.0 s\n  lint error here",
        `check: FAIL at lint; full log: ${log}`,
      ]);
    }));

  test("with no --log, the log goes to the system's temporary folder", () => {
    const file = logFileOf([]);
    try {
      expect(file.startsWith(tmpdir())).toBe(true);
      expect(existsSync(file)).toBe(true);
    } finally {
      rmSync(file, { force: true });
    }
  });

  test("runStep runs a package.json script and captures its output and exit code", async () => {
    const run = await runStep("no-such-script-here");
    expect(run.code).not.toBe(0);
    expect(run.output).toContain("no-such-script-here");
    expect(run.seconds).toBeGreaterThanOrEqual(0);
  });
});
