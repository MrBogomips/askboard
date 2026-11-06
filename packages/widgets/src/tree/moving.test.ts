import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { dropOn } from "./model/drop.ts";
import { focusOn, openView } from "./model/focus.ts";
import { afterDrop, afterMove, isMove } from "./moving.ts";

const tree: TreeProps = Object.freeze({
  nodes: [
    { id: "a", label: "Alpha" },
    {
      id: "b",
      label: "Beta",
      children: [
        { id: "c", label: "Gamma", children: [{ id: "d", label: "Delta" }] },
        { id: "e", label: "Epsilon" },
      ],
    },
  ],
});

const idsOf = (value: TreeProps): string[] => {
  const walk = (nodes: TreeProps["nodes"]): string[] =>
    nodes.flatMap((node) => [node.id, ...walk(node.children ?? [])]);
  return walk(value.nodes);
};

describe("moving a node", () => {
  test("the moves are the four edits that move", () => {
    expect(
      ["moveUp", "moveDown", "indent", "outdent", "addAfter", "addChild", "remove"].map((edit) =>
        isMove(edit as Parameters<typeof isMove>[0]),
      ),
    ).toEqual([true, true, true, true, false, false, false]);
  });

  test("each move carries the branch, and the focus follows the node in its cell", () => {
    const onC = focusOn(openView(tree), tree, "c", 1);
    const down = afterMove("moveDown", tree, onC, "c");
    expect(idsOf(down.value)).toEqual(["a", "b", "e", "c", "d"]);
    expect(down.view.focus).toEqual({ nodeId: "c", cell: 1 });
    const out = afterMove("outdent", tree, onC, "c");
    expect(out.value.nodes.map((node) => node.id)).toEqual(["a", "b", "c"]);
    expect(idsOf(out.value)).toEqual(["a", "b", "e", "c", "d"]);
    const up = afterMove("moveUp", out.value, out.view, "c");
    expect(up.value.nodes.map((node) => node.id)).toEqual(["a", "c", "b"]);
  });

  test("an indent opens the new parent, so that the node shows", () => {
    const closed = { ...focusOn(openView(tree), tree, "e"), collapsed: new Set(["c"]) };
    const indented = afterMove("indent", tree, closed, "e");
    expect(idsOf(indented.value)).toEqual(["a", "b", "c", "d", "e"]);
    expect([...indented.view.collapsed]).toEqual([]);
    expect(indented.view.focus).toEqual({ nodeId: "e" });
  });

  test("a move that is not possible changes neither the value nor the view", () => {
    const onA = openView(tree);
    const refused = afterMove("moveUp", tree, onA, "a");
    expect(refused.value).toBe(tree);
    expect(refused.view).toBe(onA);
  });
});

describe("dropping a node", () => {
  const drop = (view: ReturnType<typeof openView>, nodeId: string, targetId: string, at: number) =>
    afterDrop(dropOn(tree, nodeId, targetId, at), tree, view, nodeId);

  test("a drop makes the move the buttons make, the focus following the node in its cell", () => {
    const onC = focusOn(openView(tree), tree, "c", 1);
    const dropped = drop(onC, "c", "e", 0.9);
    expect(idsOf(dropped.value)).toEqual(["a", "b", "e", "c", "d"]);
    expect(dropped.value).toEqual(afterMove("moveDown", tree, onC, "c").value);
    expect(dropped.view.focus).toEqual({ nodeId: "c", cell: 1 });
  });

  test("an into drop opens the target, so that the node shows", () => {
    const closed = { ...focusOn(openView(tree), tree, "e"), collapsed: new Set(["c"]) };
    const dropped = drop(closed, "e", "c", 0.5);
    expect(idsOf(dropped.value)).toEqual(["a", "b", "c", "d", "e"]);
    expect(dropped.view.collapsed.has("c")).toBe(false);
  });

  test("a refused drop and one that moves nothing give the same value and view", () => {
    const view = focusOn(openView(tree), tree, "b");
    for (const [nodeId, targetId, at] of [
      ["b", "d", 0.5],
      ["b", "b", 0.1],
      ["e", "c", 0.9],
    ] as const) {
      const dropped = drop(view, nodeId, targetId, at);
      expect(dropped.value).toBe(tree);
      expect(dropped.view).toBe(view);
    }
  });
});
