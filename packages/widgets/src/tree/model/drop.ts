// What a drop of a dragged row does (spec, "Tree drag and drop", "Tree drops that are refused";
// design decision 5; tree-edit-undo design decision 7): a pure decision from the pointer's place on
// the target row, how far right of where the drag started it is, the dragged node and the target,
// and the move it makes. The top quarter of the row means before it, the bottom quarter after it;
// the middle half the last child of it once the pointer is one indent step right of where the drag
// started, else before it in the upper half and after it in the lower. The moves are the edits' `moveBefore`,
// `moveAfter` and `moveInto`, which keep the limits the buttons keep (`relocationProblem`), so a
// drag and the buttons agree by construction.

import type { TreeProps } from "@askboard/contract";
import { moveAfter, moveBefore, moveInto, relocationProblem } from "./edits.ts";

/** Where on a target row a drop lands. */
export type DropZone = "before" | "after" | "into";

/** Why a drop is refused: on the node itself or inside its branch, or past the depth limit. */
export type DropRefusal = "own-branch" | "depth";

/** A drop: the move it makes and the node it is made against, or its refusal. */
export type Drop =
  | { readonly kind: DropZone; readonly targetId: string }
  | { readonly kind: "refused"; readonly reason: DropRefusal };

/** The share of a row's height at its top (before) and at its bottom (after). */
export const EDGE_SHARE = 0.25;

/**
 * How far right of where the drag started the pointer must be, in CSS pixels, to drop inside a row:
 * one indent step (DESIGN.md, Tree: `spacing.lg` per level).
 */
export const NEST_OFFSET = 16;

/**
 * The zone of a pointer `fraction` of the way down a row, from 0 at its top to 1 at its bottom, and
 * `offset` pixels right of where the drag started (negative to the left).
 */
export const zoneOf = (fraction: number, offset: number): DropZone => {
  if (fraction < EDGE_SHARE) return "before";
  if (fraction > 1 - EDGE_SHARE) return "after";
  if (offset >= NEST_OFFSET) return "into";
  return fraction < 0.5 ? "before" : "after";
};

const MOVES = Object.freeze({ before: moveBefore, after: moveAfter, into: moveInto });

/**
 * What dropping `nodeId` on `targetId`, at `fraction` of the target row's height and `offset` pixels
 * right of where the drag started, does: the move, or its refusal. A drop where the node already is gives a move that changes nothing.
 */
export const dropOn = (
  value: TreeProps,
  nodeId: string,
  targetId: string,
  fraction: number,
  offset: number,
): Drop => {
  const kind = zoneOf(fraction, offset);
  const reason = relocationProblem(value, nodeId, targetId, kind);
  return reason === undefined ? { kind, targetId } : { kind: "refused", reason };
};

/** The value after the drop; the same value for a refused drop or one that moves nothing. */
export const applyDrop = (value: TreeProps, nodeId: string, drop: Drop): TreeProps =>
  drop.kind === "refused" ? value : MOVES[drop.kind](value, nodeId, drop.targetId);
