// The Timeline's drag as plain data (view-and-widgets spec: Timeline moves by drag; design decision
// 10): the props a drop makes, and where the dragged entry is drawn while the pointer moves. Pure.

import type { TimelineProps } from "@askboard/contract";
import { PIXELS_PER_DAY, type Zoom } from "../shared/time/scale.ts";
import type { TimelineLayout } from "./layout.ts";
import { type Drop, moveBy, moveToLane } from "./model.ts";

/**
 * The props after `drop`: the entry's days moved by the whole days it snapped to, then its lane the
 * one under the pointer. None for a click, for a drop that leaves the entry where it stands, and
 * for an entry the item lacks.
 */
export const afterDrop = (
  props: TimelineProps,
  entryId: string,
  drop: Drop,
): TimelineProps | undefined => {
  if (drop.kind === "click") return undefined;
  const later = moveBy(props, entryId, drop.days);
  const next = drop.lane === undefined ? later : moveToLane(later, entryId, drop.lane);
  return next === props ? undefined : next;
};

/**
 * How far the dragged entry is drawn from its place while the pointer moves: the whole days the
 * drop would move it, in pixels, and the distance from its lane's band to the target lane's. No
 * shift for a click, or for an entry the layout does not hold.
 */
export const previewOf = (
  layout: TimelineLayout,
  entryId: string,
  drop: Drop,
  zoom: Zoom,
): { readonly dx: number; readonly dy: number } => {
  const entry = layout.entries.find(({ id }) => id === entryId);
  if (drop.kind === "click" || entry === undefined) return { dx: 0, dy: 0 };
  const own = layout.lanes[entry.lane];
  const target = layout.lanes.find(({ id }) => id === drop.lane);
  return {
    dx: drop.days * PIXELS_PER_DAY[zoom],
    dy: own === undefined || target === undefined ? 0 : target.top - own.top,
  };
};
