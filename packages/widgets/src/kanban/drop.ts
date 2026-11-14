// The Kanban's drag as plain data (view-and-widgets spec: Kanban moves by drag; design decisions 6
// and 9; kanban-order): the place under the pointer, the state a drag is in, which column shows
// the outline and which card the line, and the props a drop makes. Pure.

import type { KanbanProps } from "@askboard/contract";
import { placeIn } from "./model.ts";

/** A drag in progress: the card dragged and, while the pointer is over a column, where it would land. */
export type DragState = {
  readonly dragging: string;
  readonly over?: { readonly column: string; readonly slot: number };
};

/** Which side of a card the drop line is drawn on. */
export type LineSide = "before" | "after";

/**
 * The line a drop would draw: on the side of one card of the column, or, in a column that holds no
 * other card, at the top of the column.
 */
export type DropLine = { readonly card: string; readonly side: LineSide } | { readonly top: true };

/**
 * The slot under the pointer among a column's other cards: how many have their vertical middle
 * above the pointer (a pointer on a middle counts that card as above), so a drop goes before the
 * first card whose middle is below the pointer, else last. `middles` are the other cards' middles
 * in the column's order, in the pointer's coordinates.
 */
export const slotAt = (middles: readonly number[], clientY: number): number =>
  middles.filter((middle) => middle <= clientY).length;

/**
 * The indicator `columnId` shows while `drag` runs: the Tree's "into" outline while a card of
 * another column is over it, none otherwise. `cardColumn` is the dragged card's column.
 */
export const indicatorOf = (
  drag: DragState | undefined,
  columnId: string,
  cardColumn: string | undefined,
): "into" | undefined =>
  drag?.over?.column === columnId && cardColumn !== columnId ? "into" : undefined;

/**
 * The line `columnId` shows while `drag` runs, given the IDs of its cards in order: before the
 * card at the slot among the column's other cards, or after the last; at the top of a column that
 * holds no other card. None where the pointer is over another column and where the drop would
 * change nothing (the dragged card's own place in its own column).
 */
export const lineOf = (
  drag: DragState | undefined,
  columnId: string,
  ids: readonly string[],
): DropLine | undefined => {
  if (drag?.over === undefined || drag.over.column !== columnId) return undefined;
  const others = ids.filter((id) => id !== drag.dragging);
  const slot = Math.min(others.length, Math.max(0, drag.over.slot));
  if (ids.indexOf(drag.dragging) === slot) return undefined;
  const before = others[slot];
  if (before !== undefined) return { card: before, side: "before" };
  const last = others[others.length - 1];
  return last === undefined ? { top: true } : { card: last, side: "after" };
};

/**
 * The props after dropping `cardId` in `columnId` at `slot`, or none when the drop leaves them as
 * they are or names a card or column the item lacks. A raw value: the draft arranges it.
 */
export const afterDrop = (
  props: KanbanProps,
  cardId: string,
  columnId: string,
  slot: number,
): KanbanProps | undefined => {
  const next = placeIn(props, cardId, columnId, slot);
  return next === props ? undefined : next;
};
