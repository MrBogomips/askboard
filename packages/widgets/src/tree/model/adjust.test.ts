import { describe, expect, test } from "bun:test";
import type { TreeNode, TreeProps } from "@askboard/contract";
import { generator } from "../../../test/tree-model.ts";
import {
  adjustableColumns,
  adjustValue,
  applyAdjustment,
  parsePercent,
  planAdjustment,
} from "./adjust.ts";
import { NO_SELECTION, selectAll, toggle } from "./selection.ts";

// The bulk percentage adjustment (design decision 3; spec, Tree bulk percentage adjustment, The
// adjustment percentage, Tree bulk adjustment values, Estimates in order, the edge cases).
const COLUMNS = [
  { field: "optimistic", label: "Optimistic", type: "number" },
  { field: "mostLikely", label: "Most likely", type: "number" },
  { field: "pessimistic", label: "Pessimistic", type: "number" },
] as const;
const node = (id: string, fields: Record<string, number> = {}): TreeNode => ({
  id,
  label: id,
  ...fields,
});
const wbs = (...leaves: TreeNode[]): TreeProps =>
  ({
    pert: true,
    columns: COLUMNS,
    nodes: [node("ux"), { id: "build", label: "build", children: leaves }],
  }) as unknown as TreeProps;
const ALL = ["optimistic", "mostLikely", "pessimistic"];
const plan = (value: TreeProps, fields: string[], tenths: number, ids = selectAll(value)) =>
  planAdjustment(value, ids, fields, tenths);
const ready = (result: ReturnType<typeof planAdjustment>) => {
  if (result.kind !== "ready") throw new Error("the plan is refused");
  return result;
};
const valuesOf = (value: TreeProps, id: string, field: string) =>
  value.nodes.flatMap((one) => [one, ...(one.children ?? [])]).find((one) => one.id === id)?.[
    field
  ];

describe("adjustValue: decimal arithmetic, half away from zero, one decimal", () => {
  test.each([
    [12, 100, 13.2],
    [6, -200, 4.8],
    [12, -200, 9.6],
    [24, -200, 19.2],
    [2.25, 100, 2.5],
    [3, 100, 3.3],
    [0.1, 40, 0.1],
    [99_999, 100, 109_998.9],
    [1.005, 0, 1],
    [0.05, 0, 0.1],
    [-0.05, 0, -0.1],
    [1e-7, 100, 0],
  ])("%p at %p tenths of a percent gives %p", (value, tenths, expected) => {
    expect(adjustValue(value, tenths)).toBe(expected);
  });
});

describe("parsePercent", () => {
  test("reads signs, one decimal and the locale's marks, the edges included", () => {
    expect(parsePercent("+10")).toEqual({ kind: "percent", tenths: 100 });
    expect(parsePercent("15")).toEqual({ kind: "percent", tenths: 150 });
    expect(parsePercent("-20")).toEqual({ kind: "percent", tenths: -200 });
    expect(parsePercent("-99.9")).toEqual({ kind: "percent", tenths: -999 });
    expect(parsePercent("1000")).toEqual({ kind: "percent", tenths: 10_000 });
    expect(parsePercent("12,5", "it-IT")).toEqual({ kind: "percent", tenths: 125 });
    expect(parsePercent("0.1")).toEqual({ kind: "percent", tenths: 1 });
    expect(parsePercent("  ")).toEqual({ kind: "empty" });
  });

  test("refuses -100, +1001, 12,5 in en-US and 1.25, with a message and no echo", () => {
    for (const input of ["-100", "+1001", "12,5", "1.25", "abc", "1e2"]) {
      const entry = parsePercent(input);
      expect(entry.kind).toBe("refused");
      if (entry.kind === "refused")
        expect(entry.reason).not.toContain(input === "abc" ? "zzz" : "= ");
    }
    expect(parsePercent("-100")).toEqual({
      kind: "refused",
      reason: "A percentage is from -99.9 to +1000.",
    });
    expect(parsePercent("1.25")).toEqual({
      kind: "refused",
      reason: "A percentage has at most one decimal.",
    });
  });

  test("the reason is in the ask's language", () => {
    expect(parsePercent("1001", "it-IT", "it-IT")).toEqual({
      kind: "refused",
      reason: "Una percentuale va da -99,9 a +1000.",
    });
  });
});

describe("planAdjustment", () => {
  const value = wbs(
    node("portal", { optimistic: 6, mostLikely: 12, pessimistic: 24 }),
    node("billing", { optimistic: 2.25, mostLikely: 3, pessimistic: 9 }),
    node("reporting", { mostLikely: 0.1 }),
  );

  test("widening only the most likely by +10: 13.2 for portal, nothing else", () => {
    const result = ready(plan(value, ["mostLikely"], 100));
    expect(result.changes.map((one) => [one.nodeId, one.field, one.from, one.to])).toEqual([
      ["portal", "mostLikely", 12, 13.2],
      ["billing", "mostLikely", 3, 3.3],
    ]);
    const next = applyAdjustment(value, result);
    expect(valuesOf(next, "portal", "mostLikely")).toBe(13.2);
    expect(valuesOf(next, "portal", "optimistic")).toBe(6);
    expect(valuesOf(next, "reporting", "mostLikely")).toBe(0.1);
  });

  test("all three of portal by -20: 4.8, 9.6 and 19.2", () => {
    const only = toggle(NO_SELECTION, value, "portal");
    const next = applyAdjustment(value, ready(plan(value, ALL, -200, only)));
    expect(ALL.map((field) => valuesOf(next, "portal", field))).toEqual([4.8, 9.6, 19.2]);
  });

  test("rounding: 2.25 by +10 is 2.5, a value that rounds to itself is not counted", () => {
    const result = ready(plan(value, ["optimistic"], 100));
    expect(result.changes.find((one) => one.nodeId === "billing")?.to).toBe(2.5);
    const small = ready(plan(value, ["mostLikely"], 40, toggle(NO_SELECTION, value, "reporting")));
    expect(small.changes).toEqual([]);
    expect(applyAdjustment(value, small)).toBe(value);
  });

  test("an empty field stays empty and counts as skipped", () => {
    const result = ready(plan(value, ["pessimistic"], 100));
    expect(result.skipped).toBe(2); // ux and reporting have no pessimistic
    const next = applyAdjustment(value, result);
    expect(Object.hasOwn(next.nodes[1]?.children?.[2] ?? {}, "pessimistic")).toBe(false);
  });

  test("parents are not edited: selecting build changes its leaves only", () => {
    const result = ready(plan(value, ALL, 100, toggle(NO_SELECTION, value, "build")));
    expect(new Set(result.changes.map((one) => one.nodeId))).toEqual(
      new Set(["portal", "billing"]),
    );
  });

  test("no checked column changes nothing; a non-estimate column is never adjusted", () => {
    expect(ready(plan(value, [], 100)).changes).toEqual([]);
    expect(adjustableColumns(value).map((column) => column.field)).toEqual(ALL);
  });

  test("a Tree without pert adjusts its number columns, with no order rule", () => {
    const plain = {
      columns: [
        { field: "a", label: "A", type: "number" },
        { field: "b", label: "B", type: "text" },
      ],
      nodes: [{ id: "x", label: "x", a: 100_000, b: "text" }],
    } as unknown as TreeProps;
    expect(adjustableColumns(plain).map((column) => column.field)).toEqual(["a"]);
    expect(ready(plan(plain, ["a"], 100)).changes[0]?.to).toBe(110_000);
  });
});

describe("the whole adjustment is refused when any row breaks the rule", () => {
  test("an optimistic by +300 that exceeds a most likely names the row, its column and the count", () => {
    const value = wbs(
      node("portal", { optimistic: 6, mostLikely: 12, pessimistic: 24 }),
      node("billing", { optimistic: 5, mostLikely: 6, pessimistic: 9 }),
    );
    const result = plan(value, ["optimistic"], 3000);
    expect(result.kind).toBe("refused");
    if (result.kind !== "refused") return;
    expect(result.problems.map((one) => [one.nodeId, one.column, one.rule])).toEqual([
      ["portal", "Optimistic", "optimisticLikely"],
      ["billing", "Optimistic", "optimisticLikely"],
    ]);
    expect(applyAdjustment(value, result)).toBe(value);
  });

  test("a value of 99,999 by +10 names it, and no value changes", () => {
    const value = wbs(node("big", { mostLikely: 99_999 }), node("small", { mostLikely: 1 }));
    const result = plan(value, ["mostLikely"], 100);
    expect(result.kind === "refused" ? result.problems : []).toMatchObject([
      { nodeId: "big", column: "Most likely", rule: "range" },
    ]);
    expect(applyAdjustment(value, result)).toBe(value);
  });

  test("a row sent out of order is not refused for staying so, but is for getting worse", () => {
    const value = wbs(node("odd", { optimistic: 9, mostLikely: 5, pessimistic: 20 }));
    expect(plan(value, ["optimistic"], -200).kind).toBe("ready");
    expect(plan(value, ["optimistic"], 100).kind).toBe("refused");
  });

  test("every row stays coherent by +10 or -20 on all three: it applies", () => {
    const value = wbs(
      node("portal", { optimistic: 6, mostLikely: 12, pessimistic: 24 }),
      node("billing", { optimistic: 2, mostLikely: 3, pessimistic: 9 }),
    );
    for (const tenths of [100, -200]) expect(plan(value, ALL, tenths).kind).toBe("ready");
  });
});

describe("applyAdjustment", () => {
  test("returns a new frozen value and leaves its input untouched", () => {
    const value = wbs(node("portal", { optimistic: 6, mostLikely: 12, pessimistic: 24 }));
    const before = structuredClone(value);
    const next = applyAdjustment(value, ready(plan(value, ALL, 100)));
    expect(value).toEqual(before);
    expect(next).not.toBe(value);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.nodes[1]?.children?.[0])).toBe(true);
  });
});

describe("results are within one decimal and never negative (property)", () => {
  test("for random values and percentages in range", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = generator(seed);
      const base = random.int(1_000_000) / 10 ** random.int(5);
      const tenths = random.int(10_000 - -999 + 1) + -999;
      const result = adjustValue(base, tenths);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Math.abs(result * 10 - Math.round(result * 10))).toBeLessThan(1e-6);
      const exact = (base * (1000 + tenths)) / 1000;
      expect(Math.abs(result - exact)).toBeLessThanOrEqual(0.05 + 1e-6);
    }
  });
});
