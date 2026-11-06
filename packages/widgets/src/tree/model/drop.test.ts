import { describe, expect, test } from "bun:test";
import { TREE_MAX_DEPTH, TREE_MAX_NODES, type TreeNode, type TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import {
  chain,
  flat,
  generator,
  idsOf,
  isDeepFrozen,
  randomEdit,
} from "../../../test/tree-model.ts";
import { applyDrop, type Drop, type DropZone, dropOn, zoneOf } from "./drop.ts";
import { indent, moveDown, moveUp, outdent } from "./edits.ts";

// The drop's zones and moves (spec, "Tree drag and drop", "Tree drops that are refused"; design
// decision 5): a pure decision, whose moves keep the buttons' limits and which every drop reaches
// a position the four button moves also reach.
const sent = treeBoardDocument.items[0].props.items[0].props;

type Outline = string | [string, Outline[]];
const outline = (nodes: readonly TreeNode[]): Outline[] =>
  nodes.map((node) => (node.children === undefined ? node.id : [node.id, outline(node.children)]));

const DESIGN: Outline = ["design", ["ux", "architecture", "prototype"]];

const FRACTION: Readonly<Record<DropZone, number>> = { before: 0.1, after: 0.9, into: 0.5 };

/** Drops `nodeId` on `targetId` in `zone`, checking the input is untouched and a result is valid and frozen. */
const drop = (value: TreeProps, nodeId: string, targetId: string, zone: DropZone): TreeProps => {
  const copy = structuredClone(value);
  const decided = dropOn(value, nodeId, targetId, FRACTION[zone]);
  const result = applyDrop(value, nodeId, decided);
  expect(value).toEqual(copy);
  if (result !== value) {
    const checked = validateTreeProps(result, "edited");
    expect(checked.ok ? [] : checked.problems).toEqual([]);
    expect(isDeepFrozen(result)).toBe(true);
  }
  return result;
};

describe("the zones", () => {
  test("the top quarter is before, the bottom quarter after, the middle into", () => {
    expect(
      [0, 0.1, 0.249, 0.25, 0.5, 0.75, 0.751, 0.9, 1].map((fraction) => zoneOf(fraction)),
    ).toEqual(["before", "before", "before", "into", "into", "into", "after", "after", "after"]);
  });
});

describe("dropping", () => {
  test("before a node puts the node first under the target's parent (Reordering)", () => {
    expect(outline(drop(sent, "reporting", "portal", "before").nodes)).toEqual([
      DESIGN,
      ["build", ["reporting", "portal", "billing"]],
    ]);
    expect(outline(drop(sent, "billing", "portal", "before").nodes)).toEqual([
      DESIGN,
      ["build", ["billing", "portal", "reporting"]],
    ]);
  });

  test("after a node puts it right behind, carrying its branch", () => {
    expect(outline(drop(sent, "design", "build", "after").nodes)).toEqual([
      ["build", ["portal", "billing", "reporting"]],
      DESIGN,
    ]);
    expect(outline(drop(sent, "portal", "reporting", "after").nodes)).toEqual([
      DESIGN,
      ["build", ["billing", "reporting", "portal"]],
    ]);
  });

  test("into a node makes the node its last child (Indenting by drop)", () => {
    expect(outline(drop(sent, "billing", "portal", "into").nodes)).toEqual([
      DESIGN,
      ["build", [["portal", ["billing"]], "reporting"]],
    ]);
    expect(outline(drop(sent, "build", "design", "into").nodes)).toEqual([
      [
        "design",
        ["ux", "architecture", "prototype", ["build", ["portal", "billing", "reporting"]]],
      ],
    ]);
  });

  test("after its parent makes the node a sibling of it (Outdenting by drop)", () => {
    expect(outline(drop(sent, "reporting", "build", "after").nodes)).toEqual([
      DESIGN,
      ["build", ["portal", "billing"]],
      "reporting",
    ]);
  });

  test("into a parent whose only child leaves it works, the parent keeping its place", () => {
    const one: TreeProps = {
      nodes: [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }],
    };
    expect(drop(one, "b", "a", "into")).toBe(one);
    const two: TreeProps = { nodes: [...one.nodes, { id: "c", label: "C" }] };
    expect(outline(drop(two, "c", "a", "into").nodes)).toEqual([["a", ["b", "c"]]]);
  });

  test("keeps the node's ID", () => {
    const moved = drop(sent, "billing", "portal", "before");
    expect(idsOf(moved.nodes).toSorted()).toEqual(idsOf(sent.nodes).toSorted());
  });
});

describe("a drop that changes nothing", () => {
  test("where the node already is gives the same value", () => {
    expect(drop(sent, "billing", "reporting", "before")).toBe(sent);
    expect(drop(sent, "billing", "portal", "after")).toBe(sent);
    expect(drop(sent, "reporting", "build", "into")).toBe(sent);
    expect(drop(sent, "design", "build", "before")).toBe(sent);
    expect(drop(sent, "build", "design", "after")).toBe(sent);
  });

  test("on the node itself, or an unknown node, is refused or changes nothing", () => {
    expect(dropOn(sent, "portal", "portal", 0.5)).toEqual({
      kind: "refused",
      reason: "own-branch",
    });
    expect(applyDrop(sent, "ghost", { kind: "before", targetId: "portal" })).toBe(sent);
    expect(applyDrop(sent, "portal", { kind: "before", targetId: "ghost" })).toBe(sent);
  });
});

describe("refused drops", () => {
  test("onto the node and inside its own branch, whatever the zone", () => {
    for (const zone of ["before", "after", "into"] as const) {
      expect(dropOn(sent, "build", "portal", FRACTION[zone])).toEqual({
        kind: "refused",
        reason: "own-branch",
      });
      expect(dropOn(sent, "build", "build", FRACTION[zone])).toEqual({
        kind: "refused",
        reason: "own-branch",
      });
      expect(drop(sent, "build", "portal", zone)).toBe(sent);
    }
  });

  const A: TreeNode = { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] };
  const tall: TreeProps = { nodes: [A, ...chain(TREE_MAX_DEPTH)] };

  test(`a drop that would put a node at level ${TREE_MAX_DEPTH + 1} is refused with the depth`, () => {
    const refused: Drop = { kind: "refused", reason: "depth" };
    expect(dropOn(tall, "a", `n${TREE_MAX_DEPTH - 1}`, 0.5)).toEqual(refused);
    expect(dropOn(tall, "a", `n${TREE_MAX_DEPTH}`, 0.1)).toEqual(refused);
    expect(drop(tall, "a", `n${TREE_MAX_DEPTH}`, "after")).toBe(tall);
    expect(dropOn(tall, "a1", `n${TREE_MAX_DEPTH}`, 0.5)).toEqual(refused);
  });

  test("the deepest fit is allowed", () => {
    expect(dropOn(tall, "a", `n${TREE_MAX_DEPTH - 2}`, 0.5).kind).toBe("into");
    expect(dropOn(tall, "a", `n${TREE_MAX_DEPTH - 1}`, 0.1).kind).toBe("before");
    const next = drop(tall, "a", `n${TREE_MAX_DEPTH - 2}`, "into");
    expect(next).not.toBe(tall);
  });

  test("a leaf may go to the deepest level", () => {
    const deepest: TreeProps = { nodes: [...chain(TREE_MAX_DEPTH - 1), { id: "x", label: "X" }] };
    expect(drop(deepest, "x", `n${TREE_MAX_DEPTH - 1}`, "into")).not.toBe(deepest);
  });
});

describe("a Tree at the node limit", () => {
  test(`still takes a drop: a move never changes the ${TREE_MAX_NODES} nodes`, () => {
    const full: TreeProps = { nodes: flat(TREE_MAX_NODES) };
    const moved = drop(full, "n0", `n${TREE_MAX_NODES - 1}`, "after");
    expect(idsOf(moved.nodes)).toHaveLength(TREE_MAX_NODES);
    expect(idsOf(moved.nodes).at(-1)).toBe("n0");
    const into = drop(full, "n0", "n1", "into");
    expect(into.nodes).toHaveLength(TREE_MAX_NODES - 1);
  });
});

// Every Tree that moving `nodeId` alone by the four buttons gives, the first being `value`.
const byButtons = (value: TreeProps, nodeId: string): ReadonlySet<string> => {
  const seen = new Set<string>([JSON.stringify(value.nodes)]);
  const queue = [value];
  for (const current of queue) {
    for (const move of [moveUp, moveDown, indent, outdent]) {
      const next = move(current, nodeId);
      const key = JSON.stringify(next.nodes);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen;
};

describe("every position a drop reaches is reachable with the buttons (property)", () => {
  const check = (value: TreeProps): void => {
    for (const nodeId of idsOf(value.nodes)) {
      const reachable = byButtons(value, nodeId);
      for (const targetId of idsOf(value.nodes)) {
        for (const zone of ["before", "after", "into"] as const) {
          const result = drop(value, nodeId, targetId, zone);
          expect({
            nodeId,
            targetId,
            zone,
            reached: reachable.has(JSON.stringify(result.nodes)),
          }).toEqual({
            nodeId,
            targetId,
            zone,
            reached: true,
          });
        }
      }
    }
  };

  test("on the fixture, a tall branch and a flat list", () => {
    check(sent);
    check({ nodes: [A_TALL, ...chain(TREE_MAX_DEPTH)] });
    check({ nodes: flat(6) });
  });

  test("on random Trees", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = generator(seed);
      let value: TreeProps = sent;
      for (let step = 0; step < 14; step += 1) [, value] = randomEdit(random, value);
      if (idsOf(value.nodes).length <= 14) check(value);
    }
  });
});

const A_TALL: TreeNode = { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] };
