// Cell entries in the shell (table-widget, design decision 8; view-and-widgets spec: Cell entries in
// the draft; AD-10, AD-20): the text a Table's cell holds that gives no value, by item ID and by
// cell (`row.field`), kept in a store of its own beside the draft record, apart from the item's
// value. An entry is at most `ENTRY_MAX_CHARS` code points, at most `CELL_ENTRIES_MAX` to an item,
// and belongs only to a Table; it is mirrored under the draft record's `cellEntries`, restored after
// a reload, dropped with the item and never part of an answer. An entry whose key names no input cell
// of the value the item holds is dropped on restore and on "Keep mine", so none is left that no cell
// shows (review U-1). Plain functions, tested without a DOM.

import { CELL_ENTRIES_MAX } from "@askboard/contract";
import { valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { DraftStore } from "./draft-store.ts";
import { cutEntry } from "./entries.ts";

/** One Table's cell entries: `row.field` to the text typed, in the order they were first held. */
export type CellEntries = ReadonlyMap<string, string>;

/** What an item shows while it holds none: the one shared empty map. */
export const NO_CELL_ENTRIES: CellEntries = new Map();

/** The widget type whose items hold cell entries. */
export const CELL_ENTRY_ITEM_TYPE = "table";

// The draft record's rule for a cell key, a row ID, a dot and a column's field (the board
// protocol's `cellEntries` schema); a key outside it never reaches the mirror, which would be
// refused whole.
const CELL_KEY = /^[A-Za-z0-9_-]{1,64}\.[a-z][A-Za-z0-9]{0,63}$/;

/** The items of a question that may hold cell entries, in its order, at every depth of its layouts. */
export const cellEntryIdsOf = (question: ViewQuestion): readonly string[] =>
  valueItemsOf(question.props.items)
    .filter((item) => item.type === CELL_ENTRY_ITEM_TYPE)
    .map((item) => item.id);

/**
 * The cell entries a map makes: each text cut at `ENTRY_MAX_CHARS` code points, an empty or non-text
 * entry and a key that is no `row.field` left out, at most `CELL_ENTRIES_MAX`; none when nothing is
 * left, or when the value is no map. Keys stay own keys of the map, so `__proto__.rate` is data.
 */
export const cutCellEntries = (value: unknown): CellEntries | undefined => {
  if (!(value instanceof Map)) return undefined;
  const kept: [string, string][] = [];
  for (const [key, text] of value) {
    if (kept.length === CELL_ENTRIES_MAX) break;
    const cut = typeof key === "string" && CELL_KEY.test(key) ? cutEntry(text) : undefined;
    if (cut !== undefined) kept.push([key, cut]);
  }
  return kept.length === 0 ? undefined : new Map(kept);
};

/** Whether two cell entries hold the same cells and texts (none and none are the same). */
export const sameCellEntries = (a: unknown, b: unknown): boolean => {
  if (a === undefined || b === undefined) return a === b;
  if (!(a instanceof Map) || !(b instanceof Map)) return a === b;
  return a.size === b.size && [...a].every(([key, text]) => b.get(key) === text);
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const own = (record: Readonly<Record<string, unknown>>, key: string): unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * The input cells of a Table's props or edited value, `row.field`: each row with each column that
 * has no formula, never the row's `id`. A value that is no Table gives none.
 */
export const inputCellsOf = (props: unknown): ReadonlySet<string> => {
  const cells = new Set<string>();
  if (!isRecord(props)) return cells;
  const columns = own(props, "columns");
  const rows = own(props, "rows");
  if (!Array.isArray(columns) || !Array.isArray(rows)) return cells;
  const fields = columns.flatMap((column) => {
    const field = isRecord(column) ? own(column, "field") : undefined;
    const computed = isRecord(column) && own(column, "formula") !== undefined;
    return typeof field === "string" && field !== "id" && !computed ? [field] : [];
  });
  for (const row of rows) {
    const id = isRecord(row) ? own(row, "id") : undefined;
    if (typeof id === "string") for (const field of fields) cells.add(`${id}.${field}`);
  }
  return cells;
};

/**
 * The entries that name an input cell of the Table `props` holds, none when none does (review U-1):
 * the same map when every entry stays.
 */
export const fitCellEntries = (entries: CellEntries, props: unknown): CellEntries | undefined => {
  const cells = inputCellsOf(props);
  const kept = [...entries].filter(([key]) => cells.has(key));
  if (kept.length === 0) return undefined;
  return kept.length === entries.size ? entries : new Map(kept);
};

/**
 * The cell entries an item shows: the ones it holds, never while the card shows an answer in their
 * place (the answer being sent, or the logged one), whose cells are read-only.
 */
export const cellEntriesShown = (
  shown: unknown,
  shownResult: unknown,
  held: unknown,
): CellEntries =>
  shown === undefined && shownResult === undefined && held instanceof Map
    ? (held as CellEntries)
    : NO_CELL_ENTRIES;

/**
 * Drops each item's cell entries whose item the document no longer holds as a Table: an update that
 * removed the item, or changed its type under the same ID, leaves no entry that nothing can correct.
 */
export const dropStaleCellEntries = (document: ViewDocument, store: DraftStore): void => {
  const held = new Set(questionsOf(document).flatMap((question) => cellEntryIdsOf(question)));
  const stale = [...store.record().keys()].filter((itemId) => !held.has(itemId));
  if (stale.length === 0) return;
  store.update(Object.fromEntries(stale.map((itemId) => [itemId, undefined])));
};

/** Clears the cell entries of every Table of the question; without a store, nothing. */
export const clearCellEntries = (question: ViewQuestion, store: DraftStore | undefined): void => {
  for (const itemId of cellEntryIdsOf(question)) store?.set(itemId, undefined);
};
