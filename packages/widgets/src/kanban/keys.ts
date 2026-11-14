// The Kanban at the keyboard (view-and-widgets spec: Kanban at the keyboard; design decision 9;
// kanban-order, design decision 5): the arrow keys with no modifier make a card current, Alt+Shift
// with the arrow keys, Home and End and exactly one of Ctrl and Cmd with Shift and the arrow keys
// move it within its column, and no other press acts. Each tool acts only where the current card
// of a Kanban that can change can make its move; "Move to…" offers the other columns. Pure.

import type { KeyPress } from "@askboard/contract";
import type { KanbanColumnView, KanbanKey, KanbanMove } from "./model.ts";

const CURSOR: Readonly<Record<string, KanbanKey>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Alt+Shift: one place up or down, or the top or bottom; Ctrl or Cmd with Shift: the top or bottom.
const ALT_SHIFT: Readonly<Record<string, KanbanMove>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "top",
  End: "bottom",
};
const COMMAND_SHIFT: Readonly<Record<string, KanbanMove>> = {
  ArrowUp: "top",
  ArrowDown: "bottom",
};

/** What a press on the cards' Tab stop does: make a card current, or move the current card. */
export type KanbanPress =
  | { readonly kind: "cursor"; readonly key: KanbanKey }
  | { readonly kind: "move"; readonly move: KanbanMove };

const named = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/**
 * The press as the Kanban takes it, or none: the arrow keys with no modifier make a card current,
 * and the moves of `KANBAN_KEYS` (`move.up`, `move.down`, `move.top` and `move.bottom`, held as
 * Alt+Shift or as exactly one of Ctrl and Cmd with Shift) move it within its column. A press the
 * table does not bind, under any other hold and while an input method composes, does nothing and
 * keeps its default (keyboard-shortcuts-help, design decisions 7 and 9; kanban-order, decision 5).
 */
export const kanbanPressOf = (press: KeyPress): KanbanPress | undefined => {
  if (press.composing) return undefined;
  switch (press.hold) {
    case "none": {
      const key = named(CURSOR, press.key);
      return key === undefined ? undefined : { kind: "cursor", key };
    }
    case "alt+shift":
    case "mod+shift": {
      const move = named(press.hold === "alt+shift" ? ALT_SHIFT : COMMAND_SHIFT, press.key);
      return move === undefined ? undefined : { kind: "move", move };
    }
    default:
      return undefined;
  }
};

/** The tools of the toolbar, each enabled or not. */
export type KanbanTools = {
  readonly moveTo: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly top: boolean;
  readonly bottom: boolean;
};

const OFF: KanbanTools = { moveTo: false, up: false, down: false, top: false, bottom: false };

/**
 * "Move to…" acts for a current card the columns hold, while the Kanban can change; "Move up" and
 * "To top" also while it is not first in its column, "Move down" and "To bottom" while not last.
 */
export const kanbanTools = (
  current: string | undefined,
  disabled: boolean,
  columns: readonly KanbanColumnView[],
): KanbanTools => {
  const cards = columns.find(({ cards: held }) => held.some(({ id }) => id === current))?.cards;
  if (disabled || current === undefined || cards === undefined) return OFF;
  const at = cards.findIndex(({ id }) => id === current);
  return {
    moveTo: true,
    up: at > 0,
    top: at > 0,
    down: at < cards.length - 1,
    bottom: at < cards.length - 1,
  };
};

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
