import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { indicatorOf, leaveTarget, nestHint, overTarget, startDrag, tipOf } from "./dragging.ts";
import { type Drop, NEST_OFFSET } from "./drop.ts";

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
    expect(first).toEqual({
      nodeId: "billing",
      over: { targetId: "portal", drop: before, nestHint: false },
    });
    expect(overTarget(first, "billing", "portal", { ...before })).toBe(first);
    expect(overTarget(first, "billing", "portal", into)).not.toBe(first);
    expect(overTarget(first, "billing", "reporting", before)).not.toBe(first);
    expect(overTarget(first, "billing", "portal", own)).not.toBe(first);
    expect(
      overTarget(overTarget(first, "billing", "portal", own), "billing", "portal", deep),
    ).toEqual({ nodeId: "billing", over: { targetId: "portal", drop: deep, nestHint: false } });
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

// The hint under the grid (tree-edit-undo design decision 7; spec, "Tree nesting by drag needs a
// move to the right"): in the middle half of a row, without the offset, where a drop inside the
// row would be allowed, the tip says to move right; a refusal's tip wins.
const sent = treeBoardDocument.items[0].props.items[0].props;

describe("the nest hint", () => {
  test("is true in the middle half without the offset, where into is allowed", () => {
    for (const fraction of [0.25, 0.4, 0.5, 0.6, 0.75])
      expect(nestHint(sent, "billing", "portal", fraction, 0)).toBe(true);
    expect(nestHint(sent, "billing", "portal", 0.5, NEST_OFFSET - 1)).toBe(true);
  });

  test("is false with the offset, and in the top and bottom quarters", () => {
    expect(nestHint(sent, "billing", "portal", 0.5, NEST_OFFSET)).toBe(false);
    for (const fraction of [0, 0.1, 0.249, 0.751, 0.9, 1])
      expect(nestHint(sent, "billing", "portal", fraction, 0)).toBe(false);
  });

  test("is false where a drop inside the row is refused", () => {
    expect(nestHint(sent, "build", "portal", 0.5, 0)).toBe(false);
    expect(nestHint(sent, "build", "build", 0.5, 0)).toBe(false);
  });

  test("overTarget keeps it in the state, and a change of it is a new state", () => {
    const quiet = overTarget(undefined, "billing", "portal", before);
    const hinted = overTarget(quiet, "billing", "portal", before, true);
    expect(quiet.over?.nestHint).toBe(false);
    expect(hinted.over?.nestHint).toBe(true);
    expect(hinted).not.toBe(quiet);
    expect(overTarget(hinted, "billing", "portal", { ...before }, true)).toBe(hinted);
  });

  test("tipOf gives the hint, and a refusal's tip wins over it", () => {
    expect(tipOf(overTarget(undefined, "billing", "portal", before, true))).toEqual({
      key: "tree.drag.nestHint",
    });
    expect(tipOf(overTarget(undefined, "billing", "portal", before, false))).toBeUndefined();
    expect(tipOf(overTarget(undefined, "build", "portal", own, true))).toEqual({
      key: "tree.drag.ownBranch",
    });
  });
});
