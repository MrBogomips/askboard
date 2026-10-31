import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { focusOn, openView } from "./model/focus.ts";
import { afterMove, isMove } from "./moving.ts";

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
