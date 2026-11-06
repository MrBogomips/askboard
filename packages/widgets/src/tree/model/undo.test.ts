import { describe, expect, test } from "bun:test";
import type { TreeNode, TreeProps } from "@askboard/contract";
import { applyAdjustment, planAdjustment } from "./adjust.ts";
import { rename } from "./edits.ts";
import { selectAll } from "./selection.ts";
import { draftAfterUndo, liveSlot, slotOf } from "./undo.ts";

// The adjustment's undo (design decision 4; spec, Tree adjustment undo).
const leaf = (id: string, mostLikely: number): TreeNode => ({ id, label: id, mostLikely });
const SENT = {
  pert: true,
  columns: [{ field: "mostLikely", label: "Most likely", type: "number" }],
  nodes: [leaf("a", 10), leaf("b", 20)],
} as unknown as TreeProps;
const adjust = (value: TreeProps) => {
  const plan = planAdjustment(value, selectAll(value), ["mostLikely"], 100);
  return applyAdjustment(value, plan);
};

describe("the undo slot", () => {
  test("after an adjustment it is live, and undoing restores every value in one step", () => {
    const after = adjust(SENT);
    const slot = slotOf(SENT, after);
    expect(after.nodes.map((node) => node.mostLikely)).toEqual([11, 22]);
    expect(liveSlot(slot, after, false)).toBe(slot);
    expect(slot.before.nodes.map((node) => node.mostLikely)).toEqual([10, 20]);
  });

  test("the draft is empty again after undoing the only change, and holds the value otherwise", () => {
    const slot = slotOf(SENT, adjust(SENT));
    expect(draftAfterUndo(slot, SENT)).toBeUndefined();
    const renamed = rename(SENT, "a", "Alpha");
    const second = slotOf(renamed, adjust(renamed));
    expect(draftAfterUndo(second, SENT)).toBe(renamed);
  });

  test("another edit empties it: the value no longer is the one the adjustment gave", () => {
    const after = adjust(SENT);
    const slot = slotOf(SENT, after);
    expect(liveSlot(slot, rename(after, "a", "Alpha"), false)).toBeUndefined();
  });

  test("a read-only Tree has none, and neither has an empty slot", () => {
    const after = adjust(SENT);
    expect(liveSlot(slotOf(SENT, after), after, true)).toBeUndefined();
    expect(liveSlot(undefined, after, false)).toBeUndefined();
  });
});
