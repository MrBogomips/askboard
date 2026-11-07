import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { construct } from "./latex-fixtures.ts";
import type { LatexFrame, RenderResult } from "./latex-frame.ts";
import type { Measure, Measurer } from "./latex-measure.ts";
import {
  boundsOf,
  flatSeriesOf,
  type ProbeRecord,
  reportOf,
  sampleOf,
} from "./latex-probe-report.ts";
import {
  memoMeasure,
  type Row,
  STOP_MS,
  sweepFamilies,
  sweepFamily,
  sweepFlat,
  sweepRealistic,
} from "./latex-sweep.ts";

const parses = (depth: number, nodes = 100): Measure => ({
  scanDepth: depth,
  parses: true,
  treeDepth: depth * 7,
  nodes,
  beforeMs: 1,
});

// A measurer whose tree depth follows the scan depth, and a frame whose time follows the tree depth.
const fracs = (expression: string): number => expression.split("\\frac").length - 1;

const measurer: Measurer = (expression) => {
  const depth = fracs(expression);
  return expression.includes("BAD")
    ? { scanDepth: 0, parses: false, error: "bad", beforeMs: 0 }
    : parses(Math.min(depth, 30), expression.length);
};

const frameOf = (time: (expression: string) => number | "crash"): LatexFrame => {
  const calls: string[] = [];
  const frame = {
    engine: "webkit",
    calls,
    render: async (expression: string): Promise<RenderResult> => {
      calls.push(expression);
      const ms = time(expression);
      return ms === "crash"
        ? { ok: false, reason: "crash", message: "Target crashed" }
        : {
            ok: true,
            ms,
            nodes: 5,
            scanDepth: 1,
            treeDepth: 7,
            treeNodes: 9,
            beforeMs: 1,
            parentMs: 1,
          };
    },
  };
  return frame as unknown as LatexFrame;
};

const callsOf = (frame: LatexFrame): string[] => (frame as unknown as { calls: string[] }).calls;

const noProgress = () => undefined;
const frac = construct("\\frac{ }{x}", "\\frac{", "}{x}");

describe("sweepFamily", () => {
  test("goes from the first depth to the last, one row each", async () => {
    const frame = frameOf(() => 10);
    const rows = await sweepFamily(frame, measurer, frac, "alone", 4, 8, noProgress);
    expect(rows.map((r) => r.asked)).toEqual([4, 5, 6, 7, 8]);
    expect(rows[0]).toMatchObject({ engine: "webkit", family: frac.name, shape: "alone", ms: 10 });
  });

  test("stops at the first render over the limit, which it keeps", async () => {
    const frame = frameOf((expression) => (fracs(expression) > 5 ? STOP_MS : 10));
    const rows = await sweepFamily(frame, measurer, frac, "alone", 4, 20, noProgress);
    expect(rows.at(-1)?.asked).toBe(6);
    expect(rows.at(-1)?.ms).toBe(STOP_MS);
  });

  test("stops at a failure, naming it", async () => {
    const frame = frameOf((expression) => (fracs(expression) > 4 ? "crash" : 10));
    const rows = await sweepFamily(frame, measurer, frac, "alone", 4, 20, noProgress);
    expect(rows.at(-1)).toMatchObject({ asked: 5, failure: "crash: Target crashed" });
    expect(rows.at(-1)?.ms).toBeUndefined();
  });

  test("does not draw what KaTeX builds no tree for", async () => {
    const bad = construct("BAD", "BAD{", "}");
    const frame = frameOf(() => 10);
    const rows = await sweepFamily(frame, measurer, bad, "alone", 4, 8, noProgress);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.failure).toBe("no tree: bad");
    expect(callsOf(frame)).toHaveLength(0);
  });
});

describe("sweepFamilies", () => {
  test("adds the branching shape only where the time doubles", async () => {
    const steady = frameOf(() => 30);
    const shapesOf = (rows: Row[]) => [...new Set(rows.map((r) => r.shape))];
    expect(shapesOf(await sweepFamilies(steady, measurer, [frac], 4, 6, noProgress))).toEqual([
      "alone",
      "side by side",
    ]);
    const doubling = frameOf((expression) => 25 * 2 ** fracs(expression));
    expect(shapesOf(await sweepFamilies(doubling, measurer, [frac], 4, 6, noProgress))).toEqual([
      "alone",
      "side by side",
      "branching",
    ]);
    const under = frameOf((expression) => (fracs(expression) > 4 ? 15 : 8));
    expect(shapesOf(await sweepFamilies(under, measurer, [frac], 4, 6, noProgress))).toEqual([
      "alone",
      "side by side",
    ]);
  });
});

describe("sweepFlat and sweepRealistic", () => {
  test("flat content grows until the first render at the slow limit, per kind", async () => {
    const frame = frameOf((expression) => (expression.length > 3_000 ? 600 : 10));
    const rows = await sweepFlat(frame, measurer, 500, noProgress);
    const kinds = [...new Set(rows.map((r) => r.family))];
    expect(kinds).toEqual(["x", "\\le", "matrix of a cells", "\\frac{a}{b}"]);
    expect(rows.filter((r) => r.family === "x").at(-1)?.ms).toBe(600);
    expect(rows.every((r) => r.shape === "flat")).toBe(true);
  });

  test("a kind KaTeX stops building ends there", async () => {
    const frame = frameOf(() => 10);
    const stopping: Measurer = (e) =>
      e.length > 1_500 ? { scanDepth: 0, parses: false, beforeMs: 0 } : parses(0);
    const rows = await sweepFlat(frame, stopping, 500, noProgress);
    expect(rows.filter((r) => r.family === "x").map((r) => r.asked)).toEqual([1_000, 2_000]);
    expect(rows.find((r) => r.asked === 2_000)?.failure).toBe("no tree: ");
  });

  test("the realistic set is drawn once each", async () => {
    const rows = await sweepRealistic(
      frameOf(() => 12),
      measurer,
      noProgress,
    );
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.shape === "realistic" && r.ms === 12)).toBe(true);
  });

  test("a measurement is kept by expression", () => {
    let calls = 0;
    const memo = memoMeasure(() => {
      calls += 1;
      return parses(1);
    });
    memo("a");
    memo("a");
    memo("b");
    expect(calls).toBe(2);
  });
});

describe("the report", () => {
  const row = (over: Omit<Partial<Row>, "bun"> & { bun?: Partial<Measure> }): Row => ({
    engine: "webkit",
    family: "f",
    shape: "alone",
    asked: 4,
    length: 10,
    ...over,
    bun: { ...parses(4), ...over.bun },
    ms: over.ms ?? 10,
  });

  const rows: Row[] = [
    row({ family: "x", shape: "flat", asked: 1_000, bun: { nodes: 2_000, treeDepth: 8 } }),
    row({ family: "x", shape: "flat", asked: 2_000, bun: { nodes: 4_000, treeDepth: 8 }, ms: 700 }),
    row({ family: "\\le", shape: "flat", asked: 2_000, bun: { nodes: 1_000, treeDepth: 8 } }),
    row({ family: "\\le", shape: "flat", asked: 3_000, bun: { parses: false } }),
    row({ family: "f", asked: 8, bun: { scanDepth: 8, treeDepth: 56, nodes: 300 }, ms: 40 }),
    row({ family: "f", asked: 9, bun: { scanDepth: 9, treeDepth: 63, nodes: 330 }, ms: 90 }),
    row({ family: "f", asked: 10, bun: { scanDepth: 10, treeDepth: 70, nodes: 360 }, ms: 640 }),
    row({ family: "f", asked: 11, bun: { scanDepth: 11, treeDepth: 77, nodes: 390 }, ms: 3_000 }),
    row({
      family: "the skill's example",
      shape: "realistic",
      asked: 0,
      bun: { scanDepth: 3, treeDepth: 25, nodes: 110 },
    }),
  ];

  test("a row KaTeX built no tree for has no sample", () => {
    expect(sampleOf(rows[3] as Row)).toBeUndefined();
    expect(sampleOf(rows[0] as Row)?.nodes).toBe(2_000);
  });

  test("the flat series are per kind and engine, capped where KaTeX stopped", () => {
    const series = flatSeriesOf(rows);
    expect(series.map((s) => [s.kind, s.capped, s.samples.length])).toEqual([
      ["x", false, 2],
      ["\\le", true, 1],
    ]);
  });

  test("the bounds follow the rules on the rows", () => {
    const { nodes, depth, nesting, bounds } = boundsOf(rows);
    expect(nodes.nodes).toBe(2_000);
    expect(depth.depth).toBe(69);
    expect(nesting.depth).toBe(9);
    expect(bounds).toEqual({ nodes: 2_000, depth: 69, nesting: 9 });
  });

  test("the report names the bounds, the tables and the realistic set", async () => {
    const folder = await mkdtemp(join(tmpdir(), "askboard-probe-report-"));
    try {
      const record: ProbeRecord = {
        machine: "a machine",
        versions: { webkit: "27.2" },
        skipped: ["\\alpha"],
        rows,
      };
      const file = join(folder, "probe.json");
      await writeFile(file, JSON.stringify(record));
      const text = await reportOf([file]);
      expect(text).toContain("machine: a machine");
      expect(text).toContain("LATEX_TREE_MAX_NODES 2000, limited by x in webkit");
      expect(text).toContain("LATEX_TREE_MAX_DEPTH 69");
      expect(text).toContain("LATEX_NESTING_MAX_DEPTH 9");
      expect(text).toContain("| the skill's example | 3 | 25 | 110 | 10 | yes |");
      expect(text).toContain("## flat content");
      expect(text).toContain("webkit: f | alone 9");
      expect(text).toContain("control words skipped (no argument or no parsing form): 1");
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
