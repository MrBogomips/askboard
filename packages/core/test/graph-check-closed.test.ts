import { describe, expect, test } from "bun:test";
import { checkedFormulaWarnings } from "../src/graph-check.ts";

// Widget-answers design decision 5 and AD-10: a graph that cannot be built is a refusal.

const question = (items: unknown[]) => ({ type: "question", id: "q", props: { items } });
const tree = { type: "tree", id: "wbs", props: { nodes: [] } };
const plan = (workPackages: unknown) => ({
  type: "gantt",
  id: "schedule",
  props: { workPackages, tasks: {} },
});

describe("checkedFormulaWarnings", () => {
  test("a board the graph cannot be built over is refused with the reason, not thrown", () => {
    const checked = checkedFormulaWarnings([question([tree, plan(3)])], new Map() as never);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("schedule");
  });

  test("a board without widget items checks clean", () => {
    expect(checkedFormulaWarnings([question([])], new Map() as never)).toEqual({
      ok: true,
      warnings: [],
    });
  });
});
