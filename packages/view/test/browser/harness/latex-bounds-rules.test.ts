import { describe, expect, test } from "bun:test";
import {
  type Bounds,
  combinedFamilies,
  depthBound,
  type FlatSeries,
  fractionBound,
  isSlow,
  nestingBound,
  nodeBound,
  type Sample,
  slowest,
  stopReasons,
  violations,
  within,
} from "./latex-bounds-rules.ts";

const sample = (over: Partial<Sample> = {}): Sample => ({
  engine: "webkit",
  family: "s",
  label: "s",
  scanDepth: 1,
  treeDepth: 10,
  nodes: 100,
  fractions: 0,
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

describe("rule 2, the fraction bound", () => {
  test("is one less than the least nested-fraction count among the slow samples within the node bound", () => {
    const found = fractionBound(
      [
        sample({ fractions: 10, ms: 229, label: "ten" }),
        sample({ fractions: 11, ms: 386, label: "eleven" }),
        sample({ fractions: 12, ms: 638, label: "boxed", engine: "webkit" }),
        sample({ fractions: 13, ms: 574, label: "cfrac" }),
        sample({ fractions: 3, ms: 900, nodes: 90_000, label: "wide" }),
      ],
      10_000,
    );
    expect(found).toEqual({ fractions: 11, limitedBy: "boxed in webkit" });
  });

  test("counts a failure as slow, and with no slow sample is the most fractions seen", () => {
    expect(
      fractionBound([sample({ fractions: 4 }), sample({ fractions: 6, ms: undefined })], 1_000),
    ).toMatchObject({ fractions: 5 });
    expect(fractionBound([sample({ fractions: 4 }), sample({ fractions: 9 })], 1_000)).toEqual({
      fractions: 9,
      limitedBy: "no slow fixture",
    });
  });

  test("a slow sample with no fractions leaves the bound at none below zero", () => {
    expect(fractionBound([sample({ fractions: 0, ms: 700 })], 1_000).fractions).toBe(0);
  });
});

describe("rule 3, the depth bound", () => {
  test("is the deepest fast tree below the least depth among the slow samples within the two bounds", () => {
    const found = depthBound(
      [
        sample({ treeDepth: 80, ms: 100 }),
        sample({ treeDepth: 105, ms: 600, label: "frac" }),
        sample({ treeDepth: 96, ms: 520, label: "dfrac", engine: "chromium" }),
        sample({ treeDepth: 40, ms: 900, nodes: 90_000, label: "wide" }),
        sample({ treeDepth: 30, ms: 900, fractions: 12, label: "many fractions" }),
        sample({ treeDepth: 90, ms: 400, label: "nearly" }),
      ],
      10_000,
      11,
    );
    // 96 is the least slow depth; the deepest fast tree below it is 90: no value past the data.
    expect(found).toEqual({ depth: 90, limitedBy: "dfrac in chromium" });
  });

  test("with no slow sample it is the deepest tree seen within the two bounds", () => {
    expect(
      depthBound(
        [
          sample({ treeDepth: 30 }),
          sample({ treeDepth: 245 }),
          sample({ treeDepth: 300, fractions: 12 }),
          sample({ treeDepth: 400, nodes: 99_999 }),
        ],
        1_000,
        11,
      ),
    ).toEqual({ depth: 245, limitedBy: "no slow fixture" });
  });

  test("a crash is slow", () => {
    expect(
      depthBound([sample({ treeDepth: 120 }), sample({ treeDepth: 319, ms: undefined })], 1_000, 11)
        .depth,
    ).toBe(120);
  });
});

describe("rule 4, the nesting bound", () => {
  const three = { nodes: 10_000, fractions: 11, depth: 100 };

  test("is one less than the least scan depth among the samples whose tree is past a bound", () => {
    const found = nestingBound(
      [
        sample({ scanDepth: 7, treeDepth: 90 }),
        sample({ scanDepth: 9, treeDepth: 101, label: "pmatrix" }),
        sample({ scanDepth: 8, treeDepth: 50, nodes: 20_000, label: "wide" }),
        sample({ scanDepth: 12, treeDepth: 200 }),
      ],
      three,
    );
    expect(found.depth).toBe(7);
    expect(found.limitedBy).toContain("wide");
  });

  test("a tree past the fraction bound limits the scan too", () => {
    const found = nestingBound(
      [
        sample({ scanDepth: 11, fractions: 11 }),
        sample({ scanDepth: 12, fractions: 12, treeDepth: 60, label: "frac" }),
        sample({ scanDepth: 14, treeDepth: 150 }),
      ],
      three,
    );
    expect(found.depth).toBe(11);
    expect(found.limitedBy).toContain("frac");
    expect(found.limitedBy).toContain("12 fractions");
  });

  test("with every tree within the bounds it is the deepest scan seen", () => {
    expect(nestingBound([sample({ scanDepth: 24 })], three)).toEqual({
      depth: 24,
      limitedBy: "no fixture past the bounds",
    });
  });
});

describe("rule 5 and the stops", () => {
  const bounds: Bounds = { nodes: 1_000, fractions: 11, depth: 100, nesting: 11 };

  test("nothing stops a nesting bound of 8 or more with a realistic set within the bounds", () => {
    expect(stopReasons(bounds, [sample({ scanDepth: 6 })])).toEqual([]);
  });

  test("a nesting bound under 8 stops", () => {
    const reasons = stopReasons({ ...bounds, nesting: 7 }, []);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("under 8");
  });

  test("a realistic fixture past the scan or any one of the three bounds stops, each named", () => {
    const reasons = stopReasons(bounds, [
      sample({ label: "scan", scanDepth: 12 }),
      sample({ label: "nodes", nodes: 1_001 }),
      sample({ label: "fractions", fractions: 12 }),
      sample({ label: "depth", treeDepth: 101 }),
      sample({ label: "fine" }),
    ]);
    expect(reasons).toHaveLength(4);
    for (const label of ["scan", "nodes", "fractions", "depth"])
      expect(reasons.some((reason) => reason.includes(`"${label}"`))).toBe(true);
  });

  test("a realistic fixture that fails or is slow stops", () => {
    expect(stopReasons(bounds, [sample({ label: "slow", ms: 600 })])).toHaveLength(1);
    expect(stopReasons(bounds, [sample({ label: "crash", ms: undefined })])).toHaveLength(1);
  });
});

describe("the families of the combined form", () => {
  const bounds: Bounds = { nodes: 1_000, fractions: 11, depth: 100, nesting: 20 };

  test("the fraction family is the slowest within the bounds at the most fractions, the plain one the deepest tree with none", () => {
    const found = combinedFamilies(
      [
        sample({ family: "frac", fractions: 11, ms: 300, engine: "webkit" }),
        sample({ family: "dfrac", fractions: 11, ms: 380, engine: "webkit" }),
        sample({ family: "chromium frac", fractions: 11, ms: 390, engine: "chromium" }),
        sample({ family: "outside", fractions: 11, ms: 480, nodes: 1_001 }),
        sample({ family: "fewer", fractions: 10, ms: 480 }),
        sample({ family: "x^", fractions: 0, treeDepth: 90 }),
        sample({ family: "sqrt", fractions: 0, treeDepth: 96 }),
        sample({ family: "too deep", fractions: 0, treeDepth: 101 }),
      ],
      bounds,
    );
    expect(found).toEqual({ fraction: "chromium frac", plain: "sqrt" });
  });

  test("with no sample at the fraction bound the most fractions within it stand in", () => {
    expect(
      combinedFamilies(
        [sample({ family: "a", fractions: 4 }), sample({ family: "b", fractions: 7 })],
        bounds,
      ).fraction,
    ).toBe("b");
  });

  test("with no fraction family or no plain one, that part is undefined", () => {
    expect(combinedFamilies([], bounds)).toEqual({ fraction: undefined, plain: undefined });
    expect(combinedFamilies([sample({ fractions: 0 })], bounds).fraction).toBeUndefined();
  });
});

describe("the bounds as a filter", () => {
  const bounds: Bounds = { nodes: 1_000, fractions: 11, depth: 100, nesting: 10 };

  test("a sample is within when its nodes, fractions, tree depth and scan depth are", () => {
    expect(within(sample(), bounds)).toBe(true);
    expect(within(sample({ nodes: 1_001 }), bounds)).toBe(false);
    expect(within(sample({ fractions: 12 }), bounds)).toBe(false);
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
