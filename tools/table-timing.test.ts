// The Table timing script (table-widget, task 2.5; design decision 13): it builds the worst form the
// Table's bounds admit through `boardGraphSource`, sets one cell and recalculates, then rebuilds
// with a row added, and prints each step against its gate. The tests run it on a small form on Bun
// and on Node 24 (the script bundles itself for Node, since `contract`'s sources use TypeScript
// that Node's type stripping refuses) and check the shape of what it prints.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TABLE_MAX_ROWS } from "@askboard/contract";
import {
  formatReport,
  GATES_MS,
  report,
  runSteps,
  runtimeName,
  stepsFrom,
  type TimingStep,
} from "./table-timing.ts";

const ROOT = new URL("..", import.meta.url).pathname;

describe("the gates", () => {
  test("are design decision 13's: 150 ms to build, 10 ms to recalculate, 150 ms to rebuild", () => {
    expect(GATES_MS).toEqual({ build: 150, set: 10, rebuild: 150 });
  });
});

describe("the steps", () => {
  test("on a small form: the three steps in order, each a time and a gate", () => {
    const steps = runSteps(8);
    expect(steps.map(({ step }) => step)).toEqual(["build", "set", "rebuild"]);
    for (const step of steps) {
      expect(step.gateMs).toBe(GATES_MS[step.step]);
      expect(Number.isFinite(step.ms)).toBe(true);
      expect(step.ms).toBeGreaterThanOrEqual(0);
      expect(step.within).toBe(step.ms <= step.gateMs);
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  test("the cell set changes the Table's totals, and the rebuild holds one row more", () => {
    const [build, set, rebuild] = runSteps(8);
    expect(build?.detail).toBe("8 rows, 80 cells, 9 formula columns");
    expect(set?.detail).toContain("recalculated");
    expect(rebuild?.detail).toBe("9 rows, 90 cells, 9 formula columns");
  });

  test("one step alone is the one reported", () => {
    expect(runSteps(8, "set").map(({ step }) => step)).toEqual(["set"]);
    expect(runSteps(8, "rebuild").map(({ step }) => step)).toEqual(["rebuild"]);
    expect(runSteps(8, "build").map(({ step }) => step)).toEqual(["build"]);
  });

  test("the default form is the Table's bound", () => {
    expect(stepsFrom([]).rows).toBe(TABLE_MAX_ROWS);
    expect(stepsFrom(["--rows", "12", "--only", "set"])).toEqual({ rows: 12, only: "set" });
    expect(() => stepsFrom(["--only", "nothing"])).toThrow("nothing");
    expect(() => stepsFrom(["--rows", "-1"])).toThrow("rows");
  });
});

describe("the report", () => {
  const steps: TimingStep[] = [
    {
      step: "build",
      label: "build and first evaluation",
      ms: 12.34,
      gateMs: 150,
      within: true,
      detail: "d",
    },
    {
      step: "set",
      label: "one cell set and recalculated",
      ms: 11,
      gateMs: 10,
      within: false,
      detail: "e",
    },
  ];

  test("names the runtime and the form, one line a step, a verdict last", () => {
    const lines = formatReport("Bun 1.4.4", 200, steps);
    expect(lines[0]).toBe("table-timing on Bun 1.4.4: 200 rows, 10 columns");
    expect(
      lines.some(
        (line) =>
          line.includes("build and first evaluation") &&
          line.includes("12.3 ms") &&
          line.includes("gate 150 ms") &&
          line.includes("ok"),
      ),
    ).toBe(true);
    expect(lines.some((line) => line.includes("one cell set") && line.includes("OVER"))).toBe(true);
    expect(lines.at(-1)).toBe("1 step over its gate");
  });

  test("a clean run says so", () => {
    expect(formatReport("Node v24", 8, steps.slice(0, 1)).at(-1)).toBe(
      "every step within its gate",
    );
  });

  test("report() runs the steps for the arguments given", () => {
    const lines = report(["--rows", "6"]);
    expect(lines[0]).toBe(`table-timing on ${runtimeName()}: 6 rows, 10 columns`);
    expect(lines.filter((line) => line.includes("(gate ")).length).toBe(3);
  });
});

describe("the script, run fresh", () => {
  const PRINTED = /^table-timing on (Bun|Node) \S+: 8 rows, 10 columns$/;

  test("on Bun, on a small form, prints the report and exits 0", () => {
    const run = Bun.spawnSync([process.execPath, "tools/table-timing.ts", "--rows", "8"], {
      cwd: ROOT,
    });
    expect(run.stderr.toString()).toBe("");
    expect(run.exitCode).toBe(0);
    const lines = run.stdout.toString().trim().split("\n");
    expect(lines[0]).toMatch(PRINTED);
    expect(lines[0]).toContain("Bun");
    expect(lines.filter((line) => line.includes("(gate "))).toHaveLength(3);
  });

  test("on Node 24, through --node, prints the same report", () => {
    const run = Bun.spawnSync(
      [process.execPath, "tools/table-timing.ts", "--rows", "8", "--node"],
      {
        cwd: ROOT,
      },
    );
    expect(run.stderr.toString()).toBe("");
    expect(run.exitCode).toBe(0);
    const lines = run.stdout.toString().trim().split("\n");
    expect(lines[0]).toMatch(PRINTED);
    expect(lines[0]).toContain("Node v24");
    expect(lines.filter((line) => line.includes("(gate "))).toHaveLength(3);
  });
});

describe("the script's source", () => {
  test("imports the fixtures of contract and compute's entry only, and no test runner", () => {
    const source = readFileSync(new URL("./table-timing.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports.every((specifier) => !specifier?.includes("bun:test"))).toBe(true);
    expect(imports).toContain("../packages/compute/src/index.ts");
  });
});
