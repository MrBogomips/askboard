import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import {
  enterNewName,
  PENDING_NAME,
  pendingAdd,
  viewOfAdd,
  viewWithoutAdd,
  withPending,
} from "./adding.ts";
import { NAME_TOO_LONG } from "./entry.ts";
import { focusOn, openView } from "./model/focus.ts";

const tree: TreeProps = Object.freeze({
  columns: [{ field: "days", label: "Days", type: "number" }],
  nodes: [
    { id: "a", label: "Alpha", days: 1 },
    { id: "b", label: "Beta", children: [{ id: "c", label: "Gamma" }] },
  ],
});

const empty: TreeProps = Object.freeze({ nodes: [] });

const idsOf = (value: TreeProps): string[] => {
  const walk = (nodes: TreeProps["nodes"]): string[] =>
    nodes.flatMap((node) => [node.id, ...walk(node.children ?? [])]);
  return walk(value.nodes);
};

describe("a pending add", () => {
  test("starts from the focus when the add is possible there, and from nowhere only after", () => {
    expect(pendingAdd("addAfter", tree, { nodeId: "a", cell: 1 })).toEqual({
      edit: "addAfter",
      anchor: { nodeId: "a", cell: 1 },
    });
    expect(pendingAdd("addChild", tree, { nodeId: "c" })).toEqual({
      edit: "addChild",
      anchor: { nodeId: "c" },
    });
    expect(pendingAdd("addAfter", empty, undefined)).toEqual({
      edit: "addAfter",
      anchor: undefined,
    });
    expect(pendingAdd("addChild", empty, undefined)).toBeUndefined();
    expect(pendingAdd("addAfter", tree, { nodeId: "missing" })).toBeUndefined();
  });

  test("shows its node, named for display only, after the anchor or as its last child", () => {
    const after = withPending(tree, { edit: "addAfter", anchor: { nodeId: "a" } });
    expect(idsOf(after)).toEqual(["a", "u-1", "b", "c"]);
    expect(after.nodes[1]).toEqual({ id: "u-1", label: PENDING_NAME });
    const child = withPending(tree, { edit: "addChild", anchor: { nodeId: "b" } });
    expect(idsOf(child)).toEqual(["a", "b", "c", "u-1"]);
    expect(idsOf(withPending(empty, { edit: "addAfter", anchor: undefined }))).toEqual(["u-1"]);
    expect(withPending(tree, undefined)).toBe(tree);
    expect(idsOf(tree)).toEqual(["a", "b", "c"]);
  });

  test("its name adds the node; an empty name adds nothing, and an overlong one is refused", () => {
    const add = { edit: "addChild", anchor: { nodeId: "a" } } as const;
    const entry = enterNewName(tree, add, "Delta");
    expect(entry.kind).toBe("value");
    if (entry.kind !== "value") throw new Error("no value");
    expect(entry.value.nodes[0]).toEqual({
      id: "a",
      label: "Alpha",
      days: 1,
      children: [{ id: "u-1", label: "Delta" }],
    });
    expect(enterNewName(tree, add, "")).toEqual({ kind: "value", value: tree });
    expect(enterNewName(tree, add, "x".repeat(201))).toEqual({
      kind: "refused",
      reason: NAME_TOO_LONG,
    });
    const after = enterNewName(empty, { edit: "addAfter", anchor: undefined }, "First");
    expect(after.kind === "value" && after.value.nodes).toEqual([{ id: "u-1", label: "First" }]);
  });

  test("the view focuses the new node's name, expanding its parent, and goes back once it is gone", () => {
    const collapsed = { ...openView(tree), collapsed: new Set(["b"]) };
    const add = { edit: "addChild", anchor: { nodeId: "b", cell: 1 } } as const;
    const adding = viewOfAdd(focusOn(collapsed, tree, "b", 1), tree, add);
    expect(adding.focus).toEqual({ nodeId: "u-1", cell: 0 });
    expect([...adding.collapsed]).toEqual([]);
    expect(viewWithoutAdd(adding, tree, add).focus).toEqual({ nodeId: "b", cell: 1 });
    const first = viewOfAdd(openView(empty), empty, { edit: "addAfter", anchor: undefined });
    expect(first.focus).toEqual({ nodeId: "u-1", cell: 0 });
    expect(viewWithoutAdd(first, empty, { edit: "addAfter", anchor: undefined })).toBe(first);
  });
});
