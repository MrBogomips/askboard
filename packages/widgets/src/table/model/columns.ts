// The Table's columns and how a cell shows (table-widget, design decisions 3 and 9; view-and-widgets
// spec: Typed cells in the ask's locale): which columns the user edits, how each type aligns, and the
// text a value takes in the ask's locale, as the contract's formats give it (AskBoard's own, never
// `Intl`): a number with its unit after a space, money at its currency's minor units, a date in the
// locale's numeric form, a toggle as on, off or unset. Plain functions, tested without a DOM.

import {
  formatDate,
  formatMoney,
  formatNumber,
  type Locale,
  type TableColumn,
  type TableColumnType,
} from "@askboard/contract";
import { say } from "@askboard/view/catalog";

/** A column the user edits: any column without a formula. */
export const isInputColumn = (column: TableColumn): boolean => column.formula === undefined;

/** The columns the user edits, in order. */
export const inputColumns = (columns: readonly TableColumn[]): readonly TableColumn[] =>
  columns.filter(isInputColumn);

/** Numbers and money read from the right, a toggle from the middle, the rest from the left. */
export type Alignment = "start" | "center" | "end";

export const alignmentOf = (type: TableColumnType): Alignment => {
  switch (type) {
    case "number":
    case "money":
      return "end";
    case "toggle":
      return "center";
    default:
      return "start";
  }
};

/** The three states of a toggle cell: unset is a state of its own, apart from off. */
export type ToggleState = "on" | "off" | "unset";

export const toggleState = (value: unknown): ToggleState =>
  value === true ? "on" : value === false ? "off" : "unset";

/** What `aria-checked` says of a toggle cell: true, false, or mixed when unset. */
export const ariaChecked = (value: unknown): "true" | "false" | "mixed" =>
  value === true ? "true" : value === false ? "false" : "mixed";

/** The toggle's next state on Space: unset to on, then off and on again (design decision 9). */
export const nextToggle = (value: unknown): boolean => value !== true;

const TOGGLE_KEYS = {
  on: "table.on",
  off: "table.off",
  unset: "table.notSet",
} as const;

/**
 * The text a cell shows for `value` in the ask's locale and language. An empty cell shows nothing
 * (a toggle shows "Not set"); a value of the wrong kind for its column, which a graph in error can
 * hand a formula cell, shows as "—", never as a guess.
 */
export const shownCell = (
  column: TableColumn,
  value: unknown,
  locale: Locale,
  language: Locale,
): string => {
  if (column.type === "toggle") return say(language, TOGGLE_KEYS[toggleState(value)]);
  if (value === undefined || value === null) return "";
  const wrong = say(language, "table.noValue");
  switch (column.type) {
    case "text":
      return typeof value === "string" ? value : wrong;
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return wrong;
      const figure = formatNumber(value, locale);
      return column.unit === undefined ? figure : `${figure} ${column.unit}`;
    }
    case "money":
      return typeof value === "string" && column.currency !== undefined
        ? safely(() => formatMoney(value, column.currency as string, locale), wrong)
        : wrong;
    case "date":
      return typeof value === "string" ? safely(() => formatDate(value, locale), wrong) : wrong;
  }
};

// A format throws a `RangeError` for text it cannot read: the cell shows no value then.
const safely = (format: () => string, otherwise: string): string => {
  try {
    return format();
  } catch (error) {
    if (error instanceof RangeError) return otherwise;
    throw error;
  }
};
