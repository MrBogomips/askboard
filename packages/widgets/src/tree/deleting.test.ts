import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { afterDelete, deletedWith, deleteQuestionOf } from "./deleting.ts";
import { focusOn, openView } from "./model/focus.ts";

const tree: TreeProps = Object.freeze({
  nodes: [
    { id: "a", label: "Alpha" },
    {
      id: "b",
      label: "Beta",
      children: [
        { id: "c", label: "Gamma" },
        { id: "d", label: "Delta", children: [{ id: "e", label: "Epsilon" }] },
      ],
    },
  ],
});

describe("deleting a node", () => {
  test("asks first only for a node with children, naming it and counting the nodes under it", () => {
    expect(["a", "b", "c", "d", "e", "missing"].map((id) => deleteQuestionOf(tree, id))).toEqual([
      undefined,
      { label: "Beta", under: 3 },
      undefined,
      { label: "Delta", under: 1 },
      undefined,
      undefined,
    ]);
  });

  test("says how many nodes go with it, in the singular for one", () => {
    expect(deletedWith(1)).toBe("and the node under it will be deleted.");
    expect(deletedWith(3)).toBe("and the 3 nodes under it will be deleted.");
  });

  test("takes the branch out and moves the focus by the value that held it, keeping the column", () => {
    const deleted = afterDelete(tree, focusOn(openView(tree), tree, "d", 1), "d");
    expect(deleted.value.nodes[1]).toEqual({
      id: "b",
      label: "Beta",
      children: [{ id: "c", label: "Gamma" }],
    });
    expect(deleted.view.focus).toEqual({ nodeId: "c", cell: 1 });
    const parent = afterDelete(deleted.value, deleted.view, "c");
    expect(parent.view.focus).toEqual({ nodeId: "b", cell: 1 });
    expect(parent.value.nodes[1]).toEqual({ id: "b", label: "Beta" });
    expect(afterDelete(tree, openView(tree), "a").view.focus).toEqual({ nodeId: "b" });
  });

  test("keeps a focus outside the branch, as after a question answered from elsewhere", () => {
    const onAlpha = focusOn(openView(tree), tree, "a", 1);
    const deleted = afterDelete(tree, onAlpha, "d");
    expect(deleted.view.focus).toEqual({ nodeId: "a", cell: 1 });
    const inBranch = afterDelete(tree, focusOn(openView(tree), tree, "e"), "d");
    expect(inBranch.view.focus).toEqual({ nodeId: "c" });
    const collapsed = { ...onAlpha, collapsed: new Set(["d"]) };
    expect([...afterDelete(tree, collapsed, "d").view.collapsed]).toEqual([]);
  });
});
