import { describe, expect, test } from "bun:test";
import {
  TREE_MAX_DEPTH,
  TREE_MAX_NODES,
  type TreeColumn,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import { treeBoardDocument, uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import { chain, flat, isDeepFrozen, objectsOf } from "../../../test/tree-model.ts";
import {
  addAfter,
  addChild,
  can,
  ESTIMATE_OUT_OF_RANGE,
  estimateProblem,
  nextNodeId,
  remove,
  removedCount,
  rename,
  setField,
} from "./edits.ts";

// The Tree's edits (design decision 5): each returns a new frozen value that validates as an
// edited value, or the same value when nothing changes, and never touches its input.
const sent = treeBoardDocument.items[0].props.items[0].props;

/** Runs `edit` on `value`, checking that the value, its objects and their frozen state stay as they were. */
const run = <A extends unknown[]>(
  edit: (value: TreeProps, ...args: A) => TreeProps,
  value: TreeProps,
  ...args: A
): TreeProps => {
  const copy = structuredClone(value);
  const objects = objectsOf(value).map((object) => [object, Object.isFrozen(object)] as const);
  const result = edit(value, ...args);
  expect(value).toEqual(copy);
  expect(objects.every(([object, frozen]) => Object.isFrozen(object) === frozen)).toBe(true);
  if (result !== value) {
    const checked = validateTreeProps(result, "edited");
    expect(checked.ok ? [] : checked.problems).toEqual([]);
    expect(isDeepFrozen(result)).toBe(true);
  }
  return result;
};

const childrenIds = (value: TreeProps, id: string): string[] => {
  const find = (nodes: readonly TreeNode[]): TreeNode | undefined =>
    nodes.reduce<TreeNode | undefined>(
      (found, node) => found ?? (node.id === id ? node : find(node.children ?? [])),
      undefined,
    );
  return (find(value.nodes)?.children ?? []).map((node) => node.id);
};

const nodeOf = (value: TreeProps, id: string): TreeNode | undefined => {
  const all = (nodes: readonly TreeNode[]): TreeNode[] =>
    nodes.flatMap((node) => [node, ...all(node.children ?? [])]);
  return all(value.nodes).find((node) => node.id === id);
};

const OWNER: TreeColumn = { field: "owner", label: "Owner", type: "text" };
const ESTIMATE: TreeColumn = { field: "estimate", label: "Estimate", type: "number" };
const withText: TreeProps = {
  columns: [OWNER, ESTIMATE],
  nodes: [{ id: "a", label: "A", owner: "Sara", children: [{ id: "b", label: "B" }] }],
};

describe("the next node's ID (design decision 11)", () => {
  test("is u-1 first, then one more than the highest u-<n> at any level", () => {
    expect(nextNodeId(sent)).toBe("u-1");
    expect(nextNodeId(run(addAfter, sent, "portal", "Dashboards"))).toBe("u-2");
    const deep: TreeProps = { nodes: chain(3, (level) => (level === 3 ? "u-7" : `n${level}`)) };
    expect(nextNodeId(deep)).toBe("u-8");
  });
});

describe("adding a node after another", () => {
  test("puts the new node right after it, under the same parent, with the next view-made ID", () => {
    const result = run(addAfter, sent, "portal", "Customer portal: dashboards");
    expect(childrenIds(result, "build")).toEqual(["portal", "u-1", "billing", "reporting"]);
    expect(nodeOf(result, "u-1")).toEqual({ id: "u-1", label: "Customer portal: dashboards" });
    const again = run(addAfter, result, "u-1", "Customer portal: settings");
    expect(childrenIds(again, "build")).toEqual(["portal", "u-1", "u-2", "billing", "reporting"]);
  });

  test("puts it after the node's whole branch, at the node's level", () => {
    const result = run(addAfter, sent, "design", "Discovery");
    expect(result.nodes.map((node) => node.id)).toEqual(["design", "u-1", "build"]);
    expect(childrenIds(result, "design")).toEqual(["ux", "architecture", "prototype"]);
  });

  test("with no current node, as in an empty Tree, adds a last top-level node", () => {
    expect(run(addAfter, { nodes: [] }, undefined, "First").nodes).toEqual([
      { id: "u-1", label: "First" },
    ]);
    expect(run(addAfter, sent, undefined, "Last").nodes.map((node) => node.id)).toEqual([
      "design",
      "build",
      "u-1",
    ]);
  });

  test("keeps the columns, and a Tree without columns stays without", () => {
    expect(run(addAfter, sent, "ux", "Research").columns).toEqual(sent.columns ?? []);
    expect(run(addAfter, { nodes: flat(2) }, "n0", "New")).not.toHaveProperty("columns");
  });

  test("takes a name of up to 200 characters, counted in code points", () => {
    const name = "\u{1F600}".repeat(200);
    expect(nodeOf(run(addAfter, sent, "ux", name), "u-1")?.label).toBe(name);
  });

  test.each([
    ["an empty name", "portal", ""],
    ["a name of 201 characters", "portal", "x".repeat(201)],
    ["a node the value does not hold", "nowhere", "New"],
  ])("changes nothing for %s", (_, nodeId, label) => {
    expect(run(addAfter, sent, nodeId, label)).toBe(sent);
  });

  test(`is refused at ${TREE_MAX_NODES} nodes, through the contract's limit`, () => {
    const full: TreeProps = { nodes: flat(TREE_MAX_NODES) };
    expect(run(addAfter, full, "n0", "One too many")).toBe(full);
    const room: TreeProps = { nodes: flat(TREE_MAX_NODES - 1) };
    expect(run(addAfter, room, "n0", "The last one").nodes).toHaveLength(TREE_MAX_NODES);
  });
});

describe("adding a child", () => {
  test("adds a last child, giving a leaf its first child", () => {
    const result = run(addChild, sent, "build", "Operations");
    expect(childrenIds(result, "build")).toEqual(["portal", "billing", "reporting", "u-1"]);
    const leaf = run(addChild, sent, "portal", "Accounts");
    expect(nodeOf(leaf, "portal")?.children).toEqual([{ id: "u-1", label: "Accounts" }]);
  });

  test(`is refused under a node at level ${TREE_MAX_DEPTH}, through the contract's limit`, () => {
    const deepest: TreeProps = { nodes: chain(TREE_MAX_DEPTH) };
    expect(run(addChild, deepest, `n${TREE_MAX_DEPTH}`, "Too deep")).toBe(deepest);
    const result = run(addChild, deepest, `n${TREE_MAX_DEPTH - 1}`, "Deep enough");
    expect(childrenIds(result, `n${TREE_MAX_DEPTH - 1}`)).toEqual([`n${TREE_MAX_DEPTH}`, "u-1"]);
  });

  test(`is refused at ${TREE_MAX_NODES} nodes`, () => {
    const full: TreeProps = { nodes: flat(TREE_MAX_NODES) };
    expect(run(addChild, full, "n0", "One too many")).toBe(full);
  });

  test.each([
    ["an empty name", "portal", ""],
    ["a name of 201 characters", "portal", "x".repeat(201)],
    ["a node the value does not hold", "nowhere", "New"],
  ])("changes nothing for %s", (_, nodeId, label) => {
    expect(run(addChild, sent, nodeId, label)).toBe(sent);
  });
});

describe("renaming a node", () => {
  test("changes its name and nothing else", () => {
    const result = run(rename, sent, "portal", "Customer portal: accounts");
    expect(nodeOf(result, "portal")).toEqual({
      id: "portal",
      label: "Customer portal: accounts",
      optimistic: 8,
      mostLikely: 12,
      pessimistic: 20,
    });
    expect(nodeOf(result, "billing")).toEqual(nodeOf(sent, "billing"));
  });

  test.each([
    ["its own name", "portal", "Customer portal"],
    ["an empty name", "portal", ""],
    ["a name of 201 characters", "portal", "x".repeat(201)],
    ["a node the value does not hold", "nowhere", "Name"],
  ])("changes nothing for %s", (_, nodeId, label) => {
    expect(run(rename, sent, nodeId, label)).toBe(sent);
  });
});

describe("setting a field", () => {
  test("sets a number column's field to a number", () => {
    const result = run(setField, sent, "ux", "mostLikely", 4);
    expect(nodeOf(result, "ux")).toMatchObject({ optimistic: 3, mostLikely: 4, pessimistic: 10 });
    expect(nodeOf(run(setField, withText, "b", "estimate", -0.5), "b")).toHaveProperty(
      "estimate",
      -0.5,
    );
  });

  test("sets a text column's field to text of up to 1,000 characters", () => {
    expect(nodeOf(run(setField, withText, "a", "owner", "Luca"), "a")?.owner).toBe("Luca");
    const text = "\u{1F600}".repeat(1_000);
    expect(nodeOf(run(setField, withText, "b", "owner", text), "b")?.owner).toBe(text);
  });

  test("removes an emptied field, never storing an empty string", () => {
    const number = run(setField, sent, "ux", "mostLikely", undefined);
    expect(nodeOf(number, "ux")).toEqual({
      id: "ux",
      label: "UX design",
      optimistic: 3,
      pessimistic: 10,
    });
    expect(nodeOf(run(setField, withText, "a", "owner", ""), "a")).not.toHaveProperty("owner");
    expect(nodeOf(run(setField, withText, "a", "owner", undefined), "a")).not.toHaveProperty(
      "owner",
    );
  });

  test.each<[string, TreeProps, string, string, string | number | undefined]>([
    ["the value it holds", sent, "ux", "mostLikely", 5],
    ["emptying a field it does not hold", withText, "b", "owner", undefined],
    ["an empty string for a field it does not hold", withText, "b", "owner", ""],
    ["text in a number column", sent, "ux", "mostLikely", "5"],
    ["a number in a text column", withText, "a", "owner", 5],
    ["text of 1,001 characters", withText, "a", "owner", "x".repeat(1_001)],
    ["a number that is not a number", sent, "ux", "mostLikely", Number.NaN],
    ["an infinite number", sent, "ux", "mostLikely", Number.POSITIVE_INFINITY],
    ["a field no column declares", sent, "ux", "owner", "Sara"],
    ["the name", sent, "ux", "label", "Renamed"],
    ["the ID", sent, "ux", "id", "renamed"],
    ["the children", withText, "a", "children", undefined],
    ["a node the value does not hold", sent, "nowhere", "mostLikely", 1],
  ])("changes nothing for %s", (_, tree, nodeId, field, value) => {
    expect(run(setField, tree, nodeId, field, value)).toBe(tree);
  });

  test("changes nothing in a Tree without columns", () => {
    const bare: TreeProps = { nodes: flat(1) };
    expect(run(setField, bare, "n0", "estimate", 1)).toBe(bare);
  });
});

describe("a work breakdown's estimates (molecules design decision 14; view spec, WBS values follow the edits)", () => {
  // The expanded UJ-2 work breakdown, the fixture Tree with `pert`; `sent` is the same Tree without.
  const wbs: TreeProps = uj2ExpandedQuestion.props.items[0].props;
  const withRisk: TreeProps = {
    ...wbs,
    columns: [...(wbs.columns ?? []), { field: "risk", label: "Risk", type: "number" }],
  };

  test("takes an estimate of 0 to 100,000 working days on a leaf", () => {
    expect(nodeOf(run(setField, wbs, "portal", "optimistic", 0), "portal")?.optimistic).toBe(0);
    expect(nodeOf(run(setField, wbs, "portal", "pessimistic", 100_000), "portal")).toHaveProperty(
      "pessimistic",
      100_000,
    );
    expect(estimateProblem(wbs, "optimistic", 0)).toBeUndefined();
    expect(estimateProblem(wbs, "pessimistic", 100_000)).toBeUndefined();
  });

  test.each<[string, number]>([
    ["-2", -2],
    ["100,001", 100_001],
    ["a fraction below 0", -0.5],
  ])("refuses %s with the reason, and returns the same value", (_, input) => {
    expect(run(setField, wbs, "portal", "mostLikely", input)).toBe(wbs);
    expect(estimateProblem(wbs, "mostLikely", input)).toBe(ESTIMATE_OUT_OF_RANGE);
  });

  test("says why in the contract's range", () => {
    expect(ESTIMATE_OUT_OF_RANGE).toBe("An estimate is 0 to 100,000 working days.");
  });

  test("gives no reason for an emptied estimate, another field, or a Tree without pert", () => {
    expect(estimateProblem(wbs, "optimistic", undefined)).toBeUndefined();
    expect(estimateProblem(withRisk, "risk", -2)).toBeUndefined();
    expect(nodeOf(run(setField, withRisk, "portal", "risk", -2), "portal")?.risk).toBe(-2);
    expect(estimateProblem(sent, "optimistic", -2)).toBeUndefined();
    expect(nodeOf(run(setField, sent, "ux", "optimistic", -2), "ux")?.optimistic).toBe(-2);
  });

  test("refuses editing a parent's estimate, through can and setField", () => {
    expect(can("editEstimate", wbs, "design")).toBe(false);
    expect(can("editEstimate", wbs, "build")).toBe(false);
    expect(run(setField, wbs, "design", "optimistic", 3)).toBe(wbs);
    expect(run(setField, wbs, "build", "pessimistic", undefined)).toBe(wbs);
    expect(can("editEstimate", wbs, "portal")).toBe(true);
    expect(can("editEstimate", wbs, "nowhere")).toBe(false);
    expect(can("editEstimate", wbs, undefined)).toBe(false);
  });

  test("a parent's other fields stay editable", () => {
    expect(nodeOf(run(setField, withRisk, "design", "risk", 1), "design")?.risk).toBe(1);
  });

  test("a Tree without pert edits a parent's estimate as a plain value", () => {
    expect(can("editEstimate", sent, "design")).toBe(true);
    expect(nodeOf(run(setField, sent, "design", "optimistic", 3), "design")?.optimistic).toBe(3);
  });
});

describe("removing a node", () => {
  test("removes a leaf, which takes one node", () => {
    expect(removedCount(sent, "reporting")).toBe(1);
    expect(childrenIds(run(remove, sent, "reporting"), "build")).toEqual(["portal", "billing"]);
  });

  test("removes a node with its branch, and counts every node it takes", () => {
    expect(removedCount(sent, "design")).toBe(4);
    const result = run(remove, sent, "design");
    expect(result.nodes.map((node) => node.id)).toEqual(["build"]);
    expect(nodeOf(result, "ux")).toBeUndefined();
  });

  test("drops the children list it empties, so the parent becomes a leaf", () => {
    const result = run(remove, withText, "b");
    expect(result.nodes).toEqual([{ id: "a", label: "A", owner: "Sara" }]);
  });

  test("may leave an empty Tree", () => {
    expect(run(remove, withText, "a").nodes).toEqual([]);
  });

  test("changes nothing, and counts nothing, for a node the value does not hold", () => {
    expect(run(remove, sent, "nowhere")).toBe(sent);
    expect(removedCount(sent, "nowhere")).toBe(0);
  });
});
