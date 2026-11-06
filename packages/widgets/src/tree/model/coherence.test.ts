import { describe, expect, test } from "bun:test";
import type { TreeNode, TreeProps } from "@askboard/contract";
import { estimateOrderProblem, estimatesOf, orderViolation, violationsOf } from "./coherence.ts";

// The estimates stay in order (design decision 3b; spec, "Estimates stay in order" and "Estimates in
// order, the edge cases").
const COLUMNS = [
  { field: "optimistic", label: "Optimistic", type: "number" },
  { field: "mostLikely", label: "Most likely", type: "number" },
  { field: "pessimistic", label: "Pessimistic", type: "number" },
] as const;
const node = (id: string, fields: Record<string, number>): TreeNode => ({
  id,
  label: id,
  ...fields,
});
const WBS = {
  pert: true,
  columns: COLUMNS,
  nodes: [
    node("portal", { optimistic: 6, mostLikely: 12, pessimistic: 24 }),
    node("billing", { optimistic: 9, mostLikely: 5, pessimistic: 20 }),
    node("sparse", { mostLikely: 4 }),
  ],
} as unknown as TreeProps;
const problem = (id: string, field: string, input: number | undefined) =>
  estimateOrderProblem(WBS, id, field, input);

describe("a cell edit against the order", () => {
  test("15 over a most likely of 12 names the optimistic and the most likely", () => {
    expect(problem("portal", "optimistic", 15)).toBe("optimisticLikely");
  });

  test("12, equal to the most likely, keeps the order", () => {
    expect(problem("portal", "optimistic", 12)).toBeUndefined();
  });

  test("a most likely above the pessimistic, and below the optimistic, are refused", () => {
    expect(problem("portal", "mostLikely", 30)).toBe("likelyPessimistic");
    expect(problem("portal", "mostLikely", 5)).toBe("optimisticLikely");
    expect(problem("portal", "pessimistic", 10)).toBe("likelyPessimistic");
  });

  test("raising all three in the right order commits each edit", () => {
    let value = WBS;
    const edits = [
      ["pessimistic", 40],
      ["mostLikely", 20],
      ["optimistic", 10],
    ] as const;
    for (const [field, input] of edits) {
      expect(estimateOrderProblem(value, "portal", field, input)).toBeUndefined();
      value = {
        ...value,
        nodes: value.nodes.map((one) => (one.id === "portal" ? { ...one, [field]: input } : one)),
      } as TreeProps;
    }
  });

  test("an emptied estimate takes no part: the order holds over the others", () => {
    expect(problem("portal", "mostLikely", undefined)).toBeUndefined();
    expect(problem("sparse", "optimistic", 3)).toBeUndefined();
    expect(problem("sparse", "optimistic", 5)).toBe("optimisticLikely");
    expect(problem("sparse", "pessimistic", 3)).toBe("likelyPessimistic");
  });

  test("with no most likely, the optimistic is held against the pessimistic", () => {
    const value = {
      ...WBS,
      nodes: [node("gap", { optimistic: 2, pessimistic: 8 })],
    } as unknown as TreeProps;
    expect(estimateOrderProblem(value, "gap", "optimistic", 9)).toBe("optimisticPessimistic");
  });

  test("another field, an unknown node and a Tree without pert are no concern", () => {
    expect(estimateOrderProblem(WBS, "portal", "notes", 99)).toBeUndefined();
    expect(estimateOrderProblem(WBS, "ghost", "optimistic", 99)).toBeUndefined();
    const plain = { ...WBS, pert: undefined } as unknown as TreeProps;
    expect(estimateOrderProblem(plain, "portal", "optimistic", 99)).toBeUndefined();
  });
});

describe("a row the agent sent out of order", () => {
  test("lowering its optimistic from 9 to 7 commits: it is no worse", () => {
    expect(problem("billing", "optimistic", 7)).toBeUndefined();
  });

  test("raising it, adding a pair out of order or widening a gap is refused", () => {
    expect(problem("billing", "optimistic", 10)).toBe("optimisticLikely");
    expect(problem("billing", "mostLikely", 3)).toBe("optimisticLikely");
    expect(problem("billing", "pessimistic", 4)).toBe("likelyPessimistic" as const);
  });

  test("setting it right commits", () => {
    expect(problem("billing", "optimistic", 5)).toBeUndefined();
    expect(problem("billing", "mostLikely", 9)).toBeUndefined();
  });
});

describe("the pure pieces", () => {
  test("violations are read over the estimates a row has, with their gaps", () => {
    expect(violationsOf({ optimistic: 9, mostLikely: 5, pessimistic: 20 })).toEqual([
      { rule: "optimisticLikely", over: "optimistic", under: "mostLikely", gap: 4 },
    ]);
    expect(violationsOf({})).toEqual([]);
    expect(estimatesOf(node("n", { mostLikely: 3 }))).toEqual({ mostLikely: 3 });
  });

  test("a row is refused only when it ends out of order and worse than it was", () => {
    expect(orderViolation({}, { optimistic: 1, mostLikely: 2 })).toBeUndefined();
    expect(
      orderViolation({ optimistic: 3, mostLikely: 2 }, { optimistic: 3, mostLikely: 2 }),
    ).toBeUndefined();
    expect(
      orderViolation({ optimistic: 3, mostLikely: 2 }, { optimistic: 4, mostLikely: 2 })?.gap,
    ).toBe(2);
  });
});
