import { describe, expect, test } from "bun:test";
import { indicatorOf, leaveTarget, overTarget, startDrag, tipOf } from "./dragging.ts";
import type { Drop } from "./drop.ts";

// The state of a drag (design decision 5): the node dragged and the row the pointer is over, with
// the drop there; the indicator of each row and the tip of a refused drop come from it.
const before: Drop = { kind: "before", targetId: "portal" };
const into: Drop = { kind: "into", targetId: "portal" };
const own: Drop = { kind: "refused", reason: "own-branch" };
const deep: Drop = { kind: "refused", reason: "depth" };

describe("the drag state", () => {
  test("starts on the node, over no row", () => {
    expect(startDrag("billing")).toEqual({ nodeId: "billing" });
    expect(Object.isFrozen(startDrag("billing"))).toBe(true);
  });

  test("follows the pointer over a row, and stays the same object while nothing differs", () => {
    const first = overTarget(startDrag("billing"), "billing", "portal", before);
    expect(first).toEqual({ nodeId: "billing", over: { targetId: "portal", drop: before } });
    expect(overTarget(first, "billing", "portal", { ...before })).toBe(first);
    expect(overTarget(first, "billing", "portal", into)).not.toBe(first);
    expect(overTarget(first, "billing", "reporting", before)).not.toBe(first);
    expect(overTarget(first, "billing", "portal", own)).not.toBe(first);
    expect(
      overTarget(overTarget(first, "billing", "portal", own), "billing", "portal", deep),
    ).toEqual({ nodeId: "billing", over: { targetId: "portal", drop: deep } });
  });

  test("a refusal of the same reason is the same state", () => {
    const refused = overTarget(undefined, "build", "portal", own);
    expect(overTarget(refused, "build", "portal", { ...own })).toBe(refused);
  });

  test("leaving a row clears it, unless the pointer is already over another", () => {
    const over = overTarget(undefined, "billing", "portal", before);
    expect(leaveTarget(over, "portal")).toEqual({ nodeId: "billing" });
    const next = overTarget(over, "billing", "reporting", into);
    expect(leaveTarget(next, "portal")).toBe(next);
    expect(leaveTarget(undefined, "portal")).toBeUndefined();
  });
});

describe("the indicator of a row", () => {
  test("is the zone of the drop on the row the pointer is over, and none on any other", () => {
    for (const drop of [before, into, { kind: "after", targetId: "portal" } as const]) {
      const state = overTarget(undefined, "billing", "portal", drop);
      expect(indicatorOf(state, "portal")).toBe(drop.kind);
      expect(indicatorOf(state, "billing")).toBeUndefined();
    }
  });

  test("reads refused for a drop that is not allowed", () => {
    expect(indicatorOf(overTarget(undefined, "build", "portal", own), "portal")).toBe("refused");
    expect(indicatorOf(overTarget(undefined, "leaf", "b8", deep), "b8")).toBe("refused");
  });

  test("is none without a drag", () => {
    expect(indicatorOf(undefined, "portal")).toBeUndefined();
    expect(indicatorOf(startDrag("billing"), "portal")).toBeUndefined();
  });
});

describe("the tip", () => {
  test("names the reason of a refused drop: its own branch, or the limit of levels", () => {
    expect(tipOf(overTarget(undefined, "build", "portal", own))).toEqual({
      key: "tree.drag.ownBranch",
    });
    expect(tipOf(overTarget(undefined, "leaf", "b8", deep))).toEqual({
      key: "tree.drag.depth",
      max: 8,
    });
  });

  test("is none for an allowed drop and without a drag", () => {
    expect(tipOf(overTarget(undefined, "billing", "portal", before))).toBeUndefined();
    expect(tipOf(startDrag("billing"))).toBeUndefined();
    expect(tipOf(undefined)).toBeUndefined();
  });
});
