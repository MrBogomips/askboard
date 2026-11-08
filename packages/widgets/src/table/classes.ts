// The Table's classes (DESIGN.md: Widget frame, Table, Focus ring, Change highlight, Field error),
// from the design tokens as the Tree's are, which this file reuses where the look is the same. Every
// class is written out in full, so that Tailwind finds it in the chunk's own sources, and no element
// takes a `style` attribute (AD-8). Every element that shows agent or user text wraps a word with no
// space in it (`WRAP`), so that a grid of 200-character words stays inside its frame, which scrolls
// sideways when the grid is wider (DESIGN Wide widgets). The view's root font is 13px.

import type { TableColumnType } from "@askboard/contract";
import {
  ADDED_BAR,
  CHANGE_DOT,
  CHANGED_FIELD,
  COUNTER,
  COUNTER_TEXT,
  FIELD_ERROR,
  FOCUS_RING,
  FRAME,
  NOT_SELECTABLE,
  TOOL,
  TOOLS,
} from "../tree/classes.ts";

export {
  ADDED_BAR,
  CHANGE_DOT,
  CHANGED_FIELD,
  COUNTER,
  COUNTER_TEXT,
  FIELD_ERROR,
  FOCUS_RING,
  FRAME,
  NOT_SELECTABLE,
  TOOL,
  TOOLS,
};

/** The toolbar row on `muted`, below the grid: Tab leaves the grid for it (spec: The Table at the keyboard). */
export const TOOLBAR =
  "flex h-[32px] items-center gap-2 rounded-b-md border-t border-border bg-muted px-2";

/** A word of any length wraps inside its box. */
export const WRAP = "[overflow-wrap:anywhere]";

/** The frame's scroll box: a grid wider than the frame scrolls here, never widening the board. */
export const SCROLL = "max-w-full overflow-x-auto";

/** The grid: fixed layout, so that its columns share the frame and long words wrap. */
export const GRID = "w-full min-w-[640px] table-fixed border-collapse";

/** The caption, the Table's `label`, above the header row. */
export const CAPTION = `px-2 py-1.5 text-left text-body font-semibold text-foreground ${WRAP}`;

/** The header row of column labels on `muted`. */
export const HEADER_ROW = "h-header-row bg-muted text-label text-muted-foreground uppercase";

const HEADER_BASE = `px-2 py-1 align-top ${WRAP}`;

/** A column's header by its type: as wide and aligned as its cells. */
export const HEADER: Readonly<Record<TableColumnType, string>> = {
  number: `${HEADER_BASE} text-right`,
  money: `${HEADER_BASE} text-right`,
  toggle: `${HEADER_BASE} text-center`,
  text: `${HEADER_BASE} text-left`,
  date: `${HEADER_BASE} text-left`,
};

/** The mark under a computed column's label. */
export const COMPUTED = "block normal-case font-normal text-muted-foreground";

/** A row, as tall as the header row, with a rule above it. */
export const ROW = "min-h-header-row border-t border-border text-body text-foreground";

/** The current row: a `primary-subtle` fill. */
export const CURRENT_ROW = "bg-primary-subtle";

const CELL_BASE = `px-2 py-1 align-top ${WRAP}`;

/** A cell by its column's type: numbers and money right-aligned in the code face. */
export const CELL: Readonly<Record<TableColumnType, string>> = {
  number: `${CELL_BASE} text-right font-mono text-code`,
  money: `${CELL_BASE} text-right font-mono text-code`,
  toggle: `${CELL_BASE} text-center`,
  text: `${CELL_BASE} text-left`,
  date: `${CELL_BASE} text-left`,
};

/** A computed cell or total whose value differs from the board as sent: the derived mark. */
export const DERIVED = "bg-change-subtle";

/** A cell's text that is an unread entry: the destructive border, as the input atoms' is. */
export const ENTRY = "rounded-md border border-destructive px-1";

/** A formula in error, or no value: muted. */
export const NO_VALUE = "text-muted-foreground";

/** The Total row, semibold, with a rule above it. */
export const TOTAL_ROW =
  "min-h-header-row border-t-2 border-border bg-muted text-body font-semibold text-foreground";

/** The field error over the grid: column problems, one per column. */
export const GRID_ERRORS = "flex flex-col px-2 pt-1";

export const GRID_ERROR = `text-body text-destructive-text ${WRAP}`;

/** The error line under a row, as the Tree's. */
export const ROW_ERROR = `${FIELD_ERROR} ${WRAP}`;

/** The refusal beside the toolbar's counter: the 200th row's. */
export const REFUSAL = `min-w-0 truncate text-control text-destructive-text`;

/** The cell editor: a text input in the input atoms' look. */
export const EDITOR_BOX = "flex min-w-0 flex-col gap-0.5";

const EDITOR_BASE =
  "h-[28px] w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-body " +
  "text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-ring aria-invalid:border-destructive";

export const EDITOR = EDITOR_BASE;

export const NUMBER_EDITOR = `${EDITOR_BASE} text-right font-mono text-code`;

/** The echo of what the typed text reads as, "= 960,00 USD". */
export const ECHO = `text-control text-muted-foreground ${WRAP}`;

/** A cell the grid has hidden from sight but a screen reader reads: the formula's description. */
export const HIDDEN_TEXT = "sr-only";
