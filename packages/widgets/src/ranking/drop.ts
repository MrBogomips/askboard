// The Ranking's drag as plain data (view-and-widgets spec: Ranking reorder; design decision 8): the
// state a drag is in, which row shows the line and on which side, and the order a drop makes. Pure.

import { dropAt } from "./model.ts";

/** A drag in progress: the row dragged and, while the pointer is over another row, which and where. */
export type DragState = {
  readonly dragging: string;
  readonly over?: { readonly targetId: string; readonly fraction: number };
};

/** Which side of a row the drop indicator draws its line on. */
export type Indicator = "before" | "after";

/**
 * The line `rowId` shows while `drag` runs: before it in its top half, after it from half down,
 * none for any other row or for the row being dragged.
 */
export const indicatorOf = (drag: DragState | undefined, rowId: string): Indicator | undefined => {
  if (drag?.over === undefined || drag.over.targetId !== rowId || drag.dragging === rowId) {
    return undefined;
  }
  return drag.over.fraction < 0.5 ? "before" : "after";
};

/**
 * The order after dropping `id` on `targetId` at `fraction` of its height, or none when the drop
 * leaves the order as it is or names a row the order lacks.
 */
export const afterDrop = (
  order: readonly string[],
  id: string,
  targetId: string,
  fraction: number,
): readonly string[] | undefined => {
  const next = dropAt(order, id, targetId, fraction);
  return next === order ? undefined : next;
};
