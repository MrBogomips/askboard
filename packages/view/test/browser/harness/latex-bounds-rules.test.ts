import { describe, expect, test } from "bun:test";
import {
  type Bounds,
  depthBound,
  type FlatSeries,
  isSlow,
  nestingBound,
  nodeBound,
  type Sample,
  slowest,
  violations,
  within,
} from "./latex-bounds-rules.ts";

const sample = (over: Partial<Sample> = {}): Sample => ({
  engine: "webkit",
  label: "s",
  scanDepth: 1,
  treeDepth: 10,
  nodes: 100,
  ms: 10,
  beforeMs: 1,
  ...over,
});

describe("rule 1, the node bound", () => {
  const series = (kind: string, engine: string, nodes: number[], ms: (number | undefined)[]) =>
    ({
      engine,
      kind,
      capped: false,
      samples: nodes.map((n, at) => sample({ engine, label: kind, nodes: n, ms: ms[at] })),
    }) satisfies FlatSeries;

  test("is the least, over the series, of the last sample before the first slow one", () => {
    const found = nodeBound([
      series("x", "chromium", [1_000, 2_000, 4_000], [10, 20, 600]),
      series("frac", "webkit", [500, 1_500, 3_000], [10, 400, 700]),
    ]);
    expect(found).toEqual({ nodes: 1_500, limitedBy: "frac in webkit", unbounded: false });
  });

  test("counts a failure as slow", () => {
    expect(nodeBound([series("x", "webkit", [10, 20], [10, undefined])]).nodes).toBe(10);
  });

  test("leaves out a series KaTeX itself stopped with no slow sample, and says when none is slow", () => {
    const capped = { ...series("le", "webkit", [50], [5]), capped: true };
    const slow = series("x", "webkit", [1_000, 2_000], [10, 900]);
    expect(nodeBound([capped, slow]).nodes).toBe(1_000);
    expect(nodeBound([capped, series("x", "webkit", [1_000, 2_000], [10, 20])])).toEqual({
      nodes: 2_000,
      limitedBy: "no slow flat fixture",
      unbounded: true,
    });
  });

  test("a capped series that is slow still counts", () => {
    const capped = { ...series("le", "webkit", [50, 90], [5, 700]), capped: true };
    expect(nodeBound([capped]).nodes).toBe(50);
  });

  test("an empty series says nothing", () => {
    expect(nodeBound([{ engine: "webkit", kind: "x", capped: false, samples: [] }]).unbounded).toBe(
      true,
    );
  });
});

describe("rule 2, the depth bound", () => {
  test("is one less than the least tree depth among the slow samples within the node bound", () => {
    const found = depthBound(
      [
        sample({ treeDepth: 80, ms: 100 }),
        sample({ treeDepth: 105, ms: 600, label: "frac" }),
        sample({ treeDepth: 96, ms: 520, label: "dfrac", engine: "chromium" }),
        sample({ treeDepth: 40, ms: 900, nodes: 90_000, label: "wide" }),
      ],
      10_000,
    );
    expect(found).toEqual({ depth: 95, limitedBy: "dfrac in chromium" });
  });

  test("with no slow sample it is the deepest tree seen", () => {
    expect(depthBound([sample({ treeDepth: 30 }), sample({ treeDepth: 44 })], 1_000)).toEqual({
      depth: 44,
      limitedBy: "no slow fixture",
    });
  });
});

describe("rule 3, the nesting bound", () => {
  test("is one less than the least scan depth among the samples whose tree is past a bound", () => {
    const found = nestingBound(
      [
        sample({ scanDepth: 7, treeDepth: 90 }),
        sample({ scanDepth: 9, treeDepth: 101, label: "pmatrix" }),
        sample({ scanDepth: 8, treeDepth: 50, nodes: 20_000, label: "wide" }),
        sample({ scanDepth: 12, treeDepth: 200 }),
      ],
      10_000,
      100,
    );
    expect(found.depth).toBe(7);
    expect(found.limitedBy).toContain("wide");
  });

  test("with every tree within the bounds it is the deepest scan seen", () => {
    expect(nestingBound([sample({ scanDepth: 24 })], 1_000, 100)).toEqual({
      depth: 24,
      limitedBy: "no fixture past the bounds",
    });
  });
});

describe("the bounds as a filter", () => {
  const bounds: Bounds = { nodes: 1_000, depth: 100, nesting: 10 };

  test("a sample is within when its nodes, tree depth and scan depth are", () => {
    expect(within(sample(), bounds)).toBe(true);
    expect(within(sample({ nodes: 1_001 }), bounds)).toBe(false);
    expect(within(sample({ treeDepth: 101 }), bounds)).toBe(false);
    expect(within(sample({ scanDepth: 11 }), bounds)).toBe(false);
  });

  test("slow means 500 ms or more, or a failure", () => {
    expect(isSlow(sample({ ms: 499 }))).toBe(false);
    expect(isSlow(sample({ ms: 500 }))).toBe(true);
    expect(isSlow(sample({ ms: undefined }))).toBe(true);
  });

  test("a violation is a slow sample within the bounds, or work before the bound over 100 ms", () => {
    const found = violations(
      [
        sample({ label: "slow", ms: 700 }),
        sample({ label: "before", beforeMs: 150 }),
        sample({ label: "outside", ms: 700, treeDepth: 300 }),
        sample({ label: "fine" }),
      ],
      bounds,
    );
    expect(found.map((s) => s.label)).toEqual(["slow", "before"]);
  });

  test("the slowest are the slowest within the bounds, slowest first", () => {
    const found = slowest(
      [
        sample({ label: "a", ms: 30 }),
        sample({ label: "b", ms: 90 }),
        sample({ label: "c", ms: 900, treeDepth: 300 }),
        sample({ label: "d", ms: undefined }),
      ],
      bounds,
      2,
    );
    expect(found.map((s) => s.label)).toEqual(["b", "a"]);
  });
});
