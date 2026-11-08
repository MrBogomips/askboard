// The grid's current cell and keys (table-widget, design decisions 9 and 10; view-and-widgets spec:
// The Table at the keyboard): view state the component holds beside the draft, never in it. The
// ARIA grid pattern: the arrow keys move the current cell, Home and End go to the row's first and
// last cell, Enter or F2 opens the editor on an input cell, Space switches a toggle cell, Escape
// cancels an open editor. A key with a modifier is not the Table's (Alt and Cmd with an arrow
// navigate the browser's history), and neither is one pressed while an input method composes.
// Every function is pure and gives the same value when nothing changes; a row or field named
// `__proto__` or `constructor` is only data.

import type { TableProps } from "@askboard/contract";
import { inputColumns, isInputColumn, nextToggle } from "./columns.ts";

/** A cell of the grid: a row's ID and a column's field. */
export type TableFocus = { readonly rowId: string; readonly field: string };

/** A key press: the fields of a DOM or React keyboard event the Table reads. */
export type TableKey = {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** An input method is composing: the key is the composition's, never the Table's. */
  readonly isComposing?: boolean;
};

/** What the reducer reads: the value shown, the current cell, whether an editor is open. */
export type KeyContext = {
  readonly props: TableProps;
  readonly focus: TableFocus | undefined;
  readonly editing: boolean;
  /** An answered, locked or Snapshot Table: it navigates and edits nothing. */
  readonly readOnly: boolean;
};

/**
 * What a key does: move the current cell, open the editor on it, switch the toggle cell to a
 * value, cancel the open editor, or nothing (the key is the browser's or the editor's).
 */
export type KeyAction =
  | { readonly kind: "focus"; readonly focus: TableFocus }
  | { readonly kind: "edit" }
  | { readonly kind: "toggle"; readonly value: boolean }
  | { readonly kind: "cancel" }
  | { readonly kind: "none" };

const NONE: KeyAction = Object.freeze({ kind: "none" });

const focusOf = (rowId: string, field: string): TableFocus => Object.freeze({ rowId, field });

/** The first cell of the grid, or undefined when the Table holds no row (or no column). */
export const openFocus = (props: TableProps): TableFocus | undefined => {
  const row = props.rows[0];
  const column = props.columns[0];
  return row === undefined || column === undefined ? undefined : focusOf(row.id, column.field);
};

/**
 * `focus` when it names a cell of the grid, else the cell the grid falls back to: the same row's
 * first cell when only its field is gone, else the first cell of the grid.
 */
export const settleFocus = (
  props: TableProps,
  focus: TableFocus | undefined,
): TableFocus | undefined => {
  if (focus === undefined) return openFocus(props);
  const row = props.rows.find((candidate) => candidate.id === focus.rowId);
  if (row === undefined) return openFocus(props);
  if (props.columns.some((column) => column.field === focus.field)) return focus;
  const first = props.columns[0];
  return first === undefined ? undefined : focusOf(row.id, first.field);
};

/** The current cell after a row is added: the row's first input cell, else its first cell. */
export const focusAfterAdd = (props: TableProps, rowId: string): TableFocus | undefined => {
  const column = inputColumns(props.columns)[0] ?? props.columns[0];
  return column === undefined ? undefined : focusOf(rowId, column.field);
};

type Move = "up" | "down" | "left" | "right" | "home" | "end";

const MOVES: Readonly<Record<string, Move>> = Object.freeze({
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "home",
  End: "end",
});

const moved = (props: TableProps, from: TableFocus, move: Move): KeyAction => {
  const row = props.rows.findIndex((candidate) => candidate.id === from.rowId);
  const column = props.columns.findIndex((candidate) => candidate.field === from.field);
  const last = props.columns.length - 1;
  let nextRow = row;
  let nextColumn = column;
  if (move === "up") nextRow = Math.max(0, row - 1);
  else if (move === "down") nextRow = Math.min(props.rows.length - 1, row + 1);
  else if (move === "left") nextColumn = Math.max(0, column - 1);
  else if (move === "right") nextColumn = Math.min(last, column + 1);
  else nextColumn = move === "home" ? 0 : last;
  if (nextRow === row && nextColumn === column) return NONE;
  const target = focusOf(
    (props.rows[nextRow] as { readonly id: string }).id,
    (props.columns[nextColumn] as { readonly field: string }).field,
  );
  return { kind: "focus", focus: target };
};

/** What `key` does in the grid, given its value, its current cell and whether it is being edited. */
export const tableKey = (key: TableKey, context: KeyContext): KeyAction => {
  const { props, editing, readOnly } = context;
  if (key.isComposing === true) return NONE;
  if (key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return NONE;
  if (editing) return key.key === "Escape" ? { kind: "cancel" } : NONE;
  const move = Object.hasOwn(MOVES, key.key) ? MOVES[key.key] : undefined;
  if (move !== undefined) {
    const landed = settleFocus(props, context.focus);
    if (landed === undefined) return NONE;
    if (landed !== context.focus) return { kind: "focus", focus: landed };
    return moved(props, landed, move);
  }
  const focus = context.focus;
  if (readOnly || focus === undefined) return NONE;
  const column = props.columns.find((candidate) => candidate.field === focus.field);
  if (column === undefined || !isInputColumn(column)) return NONE;
  if (key.key === "Enter" || key.key === "F2") return { kind: "edit" };
  if (key.key === " " && column.type === "toggle") {
    const row = props.rows.find((candidate) => candidate.id === focus.rowId);
    const held =
      row !== undefined && Object.hasOwn(row, column.field) ? row[column.field] : undefined;
    return { kind: "toggle", value: nextToggle(held) };
  }
  return NONE;
};
