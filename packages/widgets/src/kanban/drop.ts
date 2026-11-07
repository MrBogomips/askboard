// The Kanban's drag as plain data (view-and-widgets spec: Kanban moves by drag; design decision 9):
// the state a drag is in, which column shows the drop indicator, and the props a drop makes. Pure.

import type { KanbanProps } from "@askboard/contract";
import { moveTo } from "./model.ts";

/** A drag in progress: the card dragged and, while the pointer is over a column, which. */
export type DragState = { readonly dragging: string; readonly over?: string };

/**
 * The indicator `columnId` shows while `drag` runs: the Tree's "into" outline while a card of
 * another column is over it, none otherwise. `cardColumn` is the dragged card's column.
 */
export const indicatorOf = (
  drag: DragState | undefined,
  columnId: string,
  cardColumn: string | undefined,
): "into" | undefined => (drag?.over === columnId && cardColumn !== columnId ? "into" : undefined);

/**
 * The props after dropping `cardId` on `columnId`, or none when the drop leaves them as they are or
 * names a card or column the item lacks.
 */
export const afterDrop = (
  props: KanbanProps,
  cardId: string,
  columnId: string,
): KanbanProps | undefined => {
  const next = moveTo(props, cardId, columnId);
  return next === props ? undefined : next;
};
