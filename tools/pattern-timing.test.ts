// The pattern timing script (form-widget, task 1.4; design decision 3; the PO's rule of
// 2026-11-07): the patterns it times are inside the safe subset, so that what it measures is the
// residual the subset leaves; it runs on Bun and on Node 24 with no imports, and prints a table.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { patternProblem } from "@askboard/contract";
import {
  ENDINGS,
  FIXTURES,
  formatTable,
  GATE_MS,
  KNOWN_LIMIT_MS,
  report,
  runTimings,
  runtimeName,
  SIZES,
  sizesFrom,
  timeMatch,
} from "./pattern-timing.ts";

const SOURCE = new URL("./pattern-timing.ts", import.meta.url);

describe("the fixtures", () => {
  test("hold the four patterns of the task, each over a run of its class", () => {
    expect(FIXTURES.map(({ pattern }) => pattern)).toEqual([
      "^\\d*\\d*\\d*$",
      "\\d+\\d+x",
      "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      "^(?:[a-z0-9-]+\\.)?[a-z0-9-]+$",
    ]);
    for (const { pattern, run } of FIXTURES) {
      expect(run.length, pattern).toBe(1);
    }
  });

  test("every pattern it times passes the safe-pattern check", () => {
    for (const { pattern } of FIXTURES) expect(patternProblem(pattern), pattern).toBeUndefined();
  });

  test("the texts end in x, ! and U+2028, in sizes of 100, 300 and 1,000", () => {
    expect(ENDINGS.map(({ text }) => text)).toEqual(["x", "!", " "]);
    expect(SIZES).toEqual([100, 300, 1_000]);
    expect(GATE_MS).toBe(2_000);
    expect(KNOWN_LIMIT_MS).toBe(500);
  });
});

describe("the timings", () => {
  test("a case is timed in milliseconds, whatever the pattern says of the text", () => {
    const ms = timeMatch("^a+$", "aaaa!");
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(ms)).toBe(true);
  });

  test("each pattern and ending is run at each size while the one before took under the gate", () => {
    const rows = runTimings(FIXTURES, [5, 10, 20], GATE_MS);
    expect(rows).toHaveLength(FIXTURES.length * ENDINGS.length * 3);
    for (const row of rows) expect(row.ms).toBeGreaterThanOrEqual(0);
    expect(rows.filter(({ size }) => size === 20)).toHaveLength(FIXTURES.length * ENDINGS.length);
  });

  test("a case over the gate stops its own larger sizes and no other", () => {
    const rows = runTimings(FIXTURES, [5, 10, 20], 0);
    expect(rows.map(({ size }) => size)).toEqual(rows.map(() => 5));
    expect(rows).toHaveLength(FIXTURES.length * ENDINGS.length);
  });

  test("the table has a header, each pattern and a row for every case", () => {
    const rows = runTimings(FIXTURES, [5, 10], GATE_MS);
    const table = formatTable(rows);
    expect(table.split("\n")[0]).toContain("pattern");
    for (const { pattern } of FIXTURES) expect(table).toContain(pattern);
    expect(table).toContain("U+2028");
    expect(table.split("\n").length).toBe(rows.length + 2);
  });

  test("a row over the limit is marked", () => {
    const table = formatTable([
      { pattern: "a", ending: "x", size: 100, ms: KNOWN_LIMIT_MS + 1 },
      { pattern: "a", ending: "!", size: 100, ms: 1 },
    ]);
    expect(table.split("\n").filter((line) => line.includes("over"))).toHaveLength(1);
  });
});

describe("the report", () => {
  test("reads the sizes from its arguments, else the specified ones", () => {
    expect(sizesFrom(["--sizes", "5,10"])).toEqual([5, 10]);
    expect(sizesFrom([])).toEqual(SIZES);
    expect(sizesFrom(["--sizes"])).toEqual(SIZES);
  });

  test("names the runtime, prints the table and says whether a case is over the limit", () => {
    expect(runtimeName()).toMatch(/^Bun \d/);
    const [name, table, verdict] = report(["--sizes", "5"]);
    expect(name).toBe(`pattern-timing on ${runtimeName()}`);
    expect(table).toContain("^\\d*\\d*\\d*$");
    expect(verdict).toBe(`no case over ${KNOWN_LIMIT_MS} ms`);
  });
});

describe("the script", () => {
  test("has no import and only erasable TypeScript", () => {
    const text = readFileSync(SOURCE, "utf8");
    expect(text).not.toMatch(/^\s*(import|export \* from)\s/m);
    expect(text).not.toMatch(/\brequire\(/);
    expect(text).not.toMatch(/^\s*(export )?(const )?enum\s/m);
    expect(text).not.toMatch(/^\s*(export )?(declare )?namespace\s/m);
    expect(text).not.toMatch(/constructor\([^)]*(public|private|protected|readonly)\s/);
  });

  for (const runtime of ["bun", "node"]) {
    test(`runs on ${runtime} and prints its table`, () => {
      const run = Bun.spawnSync([runtime, "tools/pattern-timing.ts", "--sizes", "5,10"], {
        cwd: new URL("..", import.meta.url).pathname,
      });
      const out = run.stdout.toString();
      expect(run.exitCode, run.stderr.toString()).toBe(0);
      expect(out).toContain("pattern");
      for (const { pattern } of FIXTURES) expect(out).toContain(pattern);
    });
  }
});
