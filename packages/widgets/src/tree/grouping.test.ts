import { describe, expect, test } from "bun:test";
import { TREE_MAX_DEPTH, type TreeNode, type TreeProps } from "@askboard/contract";
import { treeBoardDocument, uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { BoardContent } from "@askboard/view/catalog";
import { chain } from "../../test/tree-model.ts";
import { type GroupEdit, grouped, groupKey, groupQuestionOf } from "./grouping.ts";
import { linkedDependents } from "./linked.ts";
import { dropOn } from "./model/drop.ts";

// When an edit asks before it makes a leaf a group (view spec, Making a work package a group asks
// first; design decision 1): a pure rule over the value, no React.
const [question] = uj2ExpandedBoardDocument.items;
const [WBS, PLAN] = question.props.items;
const PERT = WBS.props;
const PLAIN = treeBoardDocument.items[0].props.items[0].props;
const board: Pick<BoardContent, "items" | "shown"> = { items: [WBS, PLAN], shown: new Map() };

const into = (nodeId: string, targetId: string, tree: TreeProps = PERT): GroupEdit => ({
  kind: "drop",
  nodeId,
  drop: dropOn(tree, nodeId, targetId, 0.5),
});
const indent = (nodeId: string): GroupEdit => ({ kind: "indent", nodeId });
const addChild = (nodeId: string): GroupEdit => ({ kind: "addChild", nodeId });

describe("which leaf an edit would make a group", () => {
  test("names the leaf a drop into it, an indent under it and an Add child on it give a first child", () => {
    expect(grouped(PERT, into("billing", "portal"))).toBe("portal");
    expect(grouped(PERT, indent("billing"))).toBe("portal");
    expect(grouped(PERT, addChild("portal"))).toBe("portal");
    expect(grouped(PERT, addChild("reporting"))).toBe("reporting");
  });

  test("names nothing for a drop before or after a node", () => {
    for (const fraction of [0.1, 0.9]) {
      const drop = dropOn(PERT, "billing", "portal", fraction);
      expect(grouped(PERT, { kind: "drop", nodeId: "billing", drop })).toBeUndefined();
    }
  });

  test("names nothing for a drop into a parent, an indent under a parent and an Add child on a parent", () => {
    expect(grouped(PERT, into("billing", "design"))).toBeUndefined();
    expect(grouped(PERT, indent("build"))).toBeUndefined();
    expect(grouped(PERT, addChild("design"))).toBeUndefined();
  });

  test("names nothing for an indent of a first child, which is refused", () => {
    expect(grouped(PERT, indent("ux"))).toBeUndefined();
    expect(grouped(PERT, indent("design"))).toBeUndefined();
  });

  test("names nothing for a refused drop, an own-branch drop or one past the depth limit", () => {
    const own = into("build", "portal");
    expect(own).toMatchObject({ drop: { kind: "refused", reason: "own-branch" } });
    expect(grouped(PERT, own)).toBeUndefined();

    const a: TreeNode = { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] };
    const tall: TreeProps = { nodes: [a, ...chain(TREE_MAX_DEPTH)] };
    const deep = into("a", `n${TREE_MAX_DEPTH}`, tall);
    expect(deep).toMatchObject({ drop: { kind: "refused", reason: "depth" } });
    expect(grouped(tall, deep)).toBeUndefined();

    // An indent under a leaf that would put the branch past the depth limit.
    const crowded: TreeProps = { nodes: [{ id: "leaf", label: "Leaf" }, ...chain(TREE_MAX_DEPTH)] };
    expect(grouped(crowded, indent("n1"))).toBeUndefined();
    // The same indent of a shallow branch is allowed.
    const shallow: TreeProps = { nodes: [{ id: "leaf", label: "Leaf" }, ...chain(2)] };
    expect(grouped(shallow, indent("n1"))).toBe("leaf");
  });

  test("names nothing for an unknown node or target", () => {
    expect(grouped(PERT, indent("nope"))).toBeUndefined();
    expect(grouped(PERT, addChild("nope"))).toBeUndefined();
    expect(
      grouped(PERT, { kind: "drop", nodeId: "nope", drop: { kind: "into", targetId: "portal" } }),
    ).toBeUndefined();
    expect(
      grouped(PERT, { kind: "drop", nodeId: "billing", drop: { kind: "into", targetId: "nope" } }),
    ).toBeUndefined();
  });
});

const counted = (ids: readonly string[]): number => linkedDependents(board, WBS.id, ids);

describe("the question an edit asks", () => {
  test("names the leaf, its estimates, its task and the tasks that depend on it", () => {
    const context = { planned: true, countDependents: counted };
    const expected = { label: "Customer portal", estimates: true, task: true, dependents: 1 };
    expect(groupQuestionOf(PERT, into("billing", "portal"), context)).toEqual(expected);
    expect(groupQuestionOf(PERT, indent("billing"), context)).toEqual(expected);
    expect(groupQuestionOf(PERT, addChild("portal"), context)).toEqual(expected);
  });

  test("counts the leaf's own ID only", () => {
    const asked: (readonly string[])[] = [];
    const context = {
      planned: true,
      countDependents: (ids: readonly string[]) => {
        asked.push(ids);
        return 0;
      },
    };
    groupQuestionOf(PERT, addChild("portal"), context);
    expect(asked).toEqual([["portal"]]);
  });

  test("names the estimates and no task when no plan names the Tree", () => {
    const context = { planned: false, countDependents: () => 0 };
    expect(groupQuestionOf(PERT, addChild("portal"), context)).toEqual({
      label: "Customer portal",
      estimates: true,
      task: false,
      dependents: 0,
    });
  });

  test("names the task and no estimates for a leaf with no estimate under a plan", () => {
    const bare: TreeProps = {
      ...PERT,
      nodes: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta", optimistic: 1, mostLikely: 2, pessimistic: 3 },
      ],
    };
    const context = { planned: true, countDependents: () => 0 };
    expect(groupQuestionOf(bare, addChild("a"), context)).toEqual({
      label: "Alpha",
      estimates: false,
      task: true,
      dependents: 0,
    });
  });

  test("a partly estimated leaf holds estimates", () => {
    const partly: TreeProps = {
      ...PERT,
      nodes: [{ id: "a", label: "Alpha", mostLikely: 4 }],
    };
    const context = { planned: false, countDependents: () => 0 };
    expect(groupQuestionOf(partly, addChild("a"), context)).toMatchObject({ estimates: true });
  });

  test("asks nothing for a leaf with no estimate and no plan, or a plain Tree with no plan", () => {
    const bare: TreeProps = { ...PERT, nodes: [{ id: "a", label: "Alpha" }] };
    const none = { planned: false, countDependents: () => 0 };
    expect(groupQuestionOf(bare, addChild("a"), none)).toBeUndefined();
    expect(groupQuestionOf(PLAIN, addChild("billing"), none)).toBeUndefined();
    expect(groupQuestionOf(PLAIN, indent("billing"), none)).toBeUndefined();
    expect(groupQuestionOf(PLAIN, into("billing", "portal", PLAIN), none)).toBeUndefined();
  });

  test("a plain Tree a plan names asks about the task alone, and its estimate fields count for nothing", () => {
    const context = { planned: true, countDependents: () => 2 };
    expect(groupQuestionOf(PLAIN, addChild("portal"), context)).toEqual({
      label: "Customer portal",
      estimates: false,
      task: true,
      dependents: 2,
    });
  });

  test("asks nothing for an edit that names no leaf", () => {
    const context = { planned: true, countDependents: counted };
    expect(groupQuestionOf(PERT, addChild("design"), context)).toBeUndefined();
    expect(groupQuestionOf(PERT, addChild("nope"), context)).toBeUndefined();
  });
});

// The question's key (design decision 3, X-2): a new key mounts a new question, and so an edit that
// would group another leaf is never the same question re-worded in place.
describe("the question's key", () => {
  test("two indents of one node that name different leaves have different keys", () => {
    const edit = indent("billing");
    expect(groupKey(edit, "portal")).not.toBe(groupKey(edit, "reporting"));
    expect(groupKey(edit, "portal")).toBe(groupKey(edit, "portal"));
  });

  test("an indent, an Add child and a drop of one node have keys of their own", () => {
    const keys = [
      groupKey(indent("billing"), "portal"),
      groupKey(addChild("billing"), "portal"),
      groupKey(into("billing", "portal"), "portal"),
    ];
    expect(new Set(keys).size).toBe(3);
  });

  test("a drop's key holds its node, its target and its leaf", () => {
    const key = groupKey(into("billing", "portal"), "portal");
    expect(key).toContain("billing");
    expect(key).toContain("portal");
    expect(groupKey(into("billing", "portal"), "portal")).not.toBe(
      groupKey(into("billing", "reporting"), "reporting"),
    );
    expect(groupKey(into("billing", "portal"), "portal")).not.toBe(
      groupKey(into("billing", "portal"), "reporting"),
    );
  });

  test("a refused drop's key holds its node and its leaf", () => {
    const refused = into("build", "portal");
    expect(refused).toMatchObject({ drop: { kind: "refused" } });
    expect(groupKey(refused, "portal")).toContain("build");
    expect(groupKey(refused, "portal")).not.toBe(groupKey(refused, "reporting"));
  });
});
