// The Kanban at the keyboard (view-and-widgets spec: Kanban at the keyboard; design decision 9):
// the arrow keys move the current card and never a card; "Move to…" acts only for a current card
// of a Kanban that can change, and offers the other columns. Pure.

import type { KeyPress } from "@askboard/contract";
import type { KanbanColumnView, KanbanKey } from "./model.ts";

const KEYS: Readonly<Record<string, KanbanKey>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * The arrow key as the model takes it, or none for any other key: an arrow held with no modifier
 * only, so that Alt with an arrow (history) and the rest stay the browser's (keyboard-shortcuts-
 * help, design decision 7).
 */
export const kanbanKeyOf = (press: KeyPress): KanbanKey | undefined =>
  press.hold === "none" && !press.composing && Object.hasOwn(KEYS, press.key)
    ? KEYS[press.key]
    : undefined;

/** The tools of the toolbar, each enabled or not. */
export type KanbanTools = { readonly moveTo: boolean };

const holds = (columns: readonly KanbanColumnView[], card: string): boolean =>
  columns.some(({ cards }) => cards.some(({ id }) => id === card));

/** "Move to…" acts for a current card the columns hold, while the Kanban can change. */
export const kanbanTools = (
  current: string | undefined,
  disabled: boolean,
  columns: readonly KanbanColumnView[],
): KanbanTools => ({
  moveTo: !disabled && current !== undefined && holds(columns, current),
});

/** The columns "Move to…" lists: all but the current card's, in the agent's order. */
export const otherColumns = (
  columns: readonly KanbanColumnView[],
  current: string | undefined,
): readonly { readonly id: string; readonly label: string }[] =>
  columns
    .filter(({ cards }) => cards.some(({ id }) => id === current))
    .flatMap(({ id: own }) =>
      columns.filter(({ id }) => id !== own).map(({ id, label }) => ({ id, label })),
    );
