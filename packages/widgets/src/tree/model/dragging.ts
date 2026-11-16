// What the view holds while a row is dragged (design decision 5): the dragged node and where the
// pointer is, with what a drop there would do. View state, never draft: a drag changes nothing
// until it drops. Each function returns the state as it was when nothing changes, so that a pointer
// moving within one zone of one row causes no render.

import { TREE_MAX_DEPTH, type TreeProps } from "@askboard/contract";
import { type Drop, type DropRefusal, type DropZone, EDGE_SHARE, NEST_OFFSET } from "./drop.ts";
import { relocationProblem } from "./edits.ts";

/**
 * The drop's place: the row the pointer is over, what dropping on it does, and whether the tip
 * should say to move right to drop inside (`nestHint`).
 */
export type DragOver = {
  readonly targetId: string;
  readonly drop: Drop;
  readonly nestHint: boolean;
};

/** A drag under way: the node, and the row it is over, if any. */
export type DragState = { readonly nodeId: string; readonly over?: DragOver };

/** How a row shows a drag: the zone the drop would land in, or that it is not allowed. */
export type DropIndicator = DropZone | "refused";

export const startDrag = (nodeId: string): DragState => Object.freeze({ nodeId });

const sameDrop = (a: Drop, b: Drop): boolean =>
  a.kind === b.kind &&
  (a.kind === "refused"
    ? a.reason === (b as typeof a).reason
    : a.targetId === (b as typeof a).targetId);

/**
 * Whether the tip says "Move right to drop inside": the pointer is in the row's middle half without
 * the offset that nests, and a drop inside the row would be allowed.
 */
export const nestHint = (
  value: TreeProps,
  nodeId: string,
  targetId: string,
  fraction: number,
  offset: number,
): boolean =>
  fraction >= EDGE_SHARE &&
  fraction <= 1 - EDGE_SHARE &&
  offset < NEST_OFFSET &&
  relocationProblem(value, nodeId, targetId, "into") === undefined;

/** The drag with the pointer over `targetId`, where a drop does `drop`; `state` when nothing differs. */
export const overTarget = (
  state: DragState | undefined,
  nodeId: string,
  targetId: string,
  drop: Drop,
  hint = false,
): DragState => {
  if (
    state?.nodeId === nodeId &&
    state.over?.targetId === targetId &&
    state.over.nestHint === hint &&
    sameDrop(state.over.drop, drop)
  )
    return state;
  return Object.freeze({ nodeId, over: Object.freeze({ targetId, drop, nestHint: hint }) });
};

/** The drag once the pointer left `targetId`'s row; `state` when it is over another row. */
export const leaveTarget = (
  state: DragState | undefined,
  targetId: string,
): DragState | undefined => (state?.over?.targetId === targetId ? startDrag(state.nodeId) : state);

/** How the row `nodeId` shows `state`: its indicator, or none. */
export const indicatorOf = (
  state: DragState | undefined,
  nodeId: string,
): DropIndicator | undefined => {
  const over = state?.over;
  if (over?.targetId !== nodeId) return undefined;
  return over.drop.kind === "refused" ? "refused" : over.drop.kind;
};

/** The catalogue string, and its slots, that tell why a drop is refused. */
export type DragTip =
  | { readonly key: "tree.drag.nestHint" }
  | { readonly key: "tree.drag.ownBranch" }
  | { readonly key: "tree.drag.depth"; readonly max: number };

const TIPS: Readonly<Record<DropRefusal, DragTip>> = Object.freeze({
  "own-branch": { key: "tree.drag.ownBranch" },
  depth: { key: "tree.drag.depth", max: TREE_MAX_DEPTH },
});

/**
 * The tip for the drag: why a drop is refused, which wins, else to move right to drop inside where
 * the pointer is in the middle of a row without the offset.
 */
export const tipOf = (state: DragState | undefined): DragTip | undefined => {
  const over = state?.over;
  if (over === undefined) return undefined;
  if (over.drop.kind === "refused") return TIPS[over.drop.reason];
  return over.nestHint ? { key: "tree.drag.nestHint" } : undefined;
};
