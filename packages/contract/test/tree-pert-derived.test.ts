import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { treeBoardDocument } from "../src/fixtures/index.ts";
import { TREE_PERT_ANSWER_DERIVED, TREE_PERT_DERIVED, treeDerivedFields } from "../src/index.ts";

// The Tree's derived declarations (molecules design decision 8; contract spec, "Tree PERT derived
// fields", "WBS answer derived values"): what compute writes for a work breakdown, and which of it
// an answer carries. The rounding is compute's; the approved answer holds the declaration to F7.

const [question] = treeBoardDocument.items;
const [tree] = question.props.items;
const nodeIds = (nodes: typeof tree.props.nodes): string[] =>
  nodes.flatMap((node) => [node.id, ...nodeIds(node.children ?? [])]);

const answers = (await Bun.file(
  join(import.meta.dir, "fixtures/answers/uj2-wbs-gantt.json"),
).json()) as {
  asks: { events: { derived?: Record<string, unknown> }[] }[];
};
const approved = answers.asks[0]?.events[0]?.derived ?? {};
const wbsKeys = Object.keys(approved).filter((key) => key.startsWith("wbs."));

describe("TREE_PERT_DERIVED", () => {
  test("names expected and spread on every node and on the item, frozen", () => {
    expect(TREE_PERT_DERIVED).toEqual({
      node: ["expected", "spread"],
      item: ["expected", "spread"],
    });
    expect(Object.isFrozen(TREE_PERT_DERIVED)).toBe(true);
    expect(Object.isFrozen(TREE_PERT_DERIVED.node)).toBe(true);
    expect(Object.isFrozen(TREE_PERT_DERIVED.item)).toBe(true);
  });

  test("belongs only to a Tree with pert", () => {
    expect(treeDerivedFields({ ...tree.props, pert: true })).toBe(TREE_PERT_DERIVED);
    expect(treeDerivedFields(tree.props)).toBeUndefined();
    expect(treeDerivedFields({ ...tree.props, pert: false } as never)).toBeUndefined();
  });
});

describe("TREE_PERT_ANSWER_DERIVED", () => {
  test("says two decimals, the item's totals always and the nodes only when changed, frozen", () => {
    expect(TREE_PERT_ANSWER_DERIVED).toEqual({
      fields: ["expected", "spread"],
      decimals: 2,
      itemTotals: true,
      onlyChanged: true,
    });
    expect(Object.isFrozen(TREE_PERT_ANSWER_DERIVED)).toBe(true);
    expect(Object.isFrozen(TREE_PERT_ANSWER_DERIVED.fields)).toBe(true);
    expect(TREE_PERT_ANSWER_DERIVED.fields).toEqual(TREE_PERT_DERIVED.node);
  });

  test("agrees with the approved UJ-2 answer's twelve wbs. values", () => {
    expect(wbsKeys).toHaveLength(12);
    const ids = new Set([...nodeIds(tree.props.nodes), "u-1"]);
    for (const key of wbsKeys) {
      const [, ...rest] = key.split(".");
      const field = rest.at(-1) ?? "";
      expect(TREE_PERT_ANSWER_DERIVED.fields as readonly string[]).toContain(field);
      if (rest.length === 2) expect(ids.has(rest[0] ?? "")).toBe(true);
      else expect(rest).toHaveLength(1);
      const value = approved[key];
      expect(typeof value).toBe("number");
      const decimals = String(value).split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(TREE_PERT_ANSWER_DERIVED.decimals);
    }
  });

  test("the approved answer carries the item's totals, and no node the user left alone", () => {
    for (const field of TREE_PERT_ANSWER_DERIVED.fields) expect(wbsKeys).toContain(`wbs.${field}`);
    for (const untouched of ["architecture", "prototype", "reporting"]) {
      expect(wbsKeys.filter((key) => key.startsWith(`wbs.${untouched}.`))).toEqual([]);
    }
  });
});
