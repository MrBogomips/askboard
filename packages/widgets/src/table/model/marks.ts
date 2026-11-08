// The change highlight's marks for a Table (table-widget, design decision 9; view-and-widgets spec:
// Changes shown apart): what the user changed against the Table as the agent sent it, per cell, and
// the count "Your changes: N". For display only: the model builds no `changes` (AD-20). N counts
// changed input cells, rows added and rows deleted; the cells of an added row are not counted
// again, and a reordered Table counts no move, which the contract's diff would refuse. Rows are
// found in `Map`s and `Set`s, so an ID or a field named `__proto__` or `constructor` is only data.

import type { Locale, TableProps } from "@askboard/contract";
import { say } from "@askboard/view/catalog";
import { isInputColumn } from "./columns.ts";

export type TableMarks = {
  /** Row ID to the input fields whose value changed, for each row both versions hold. */
  readonly changed: ReadonlyMap<string, ReadonlySet<string>>;
  /** The IDs of the rows the user added. */
  readonly added: ReadonlySet<string>;
  /** The IDs of the rows the user deleted, in the sent order. */
  readonly removed: readonly string[];
  /** Changed cells, added rows and deleted rows, each once. */
  readonly count: number;
};

export const NO_MARKS: TableMarks = Object.freeze({
  changed: new Map<string, ReadonlySet<string>>(),
  added: new Set<string>(),
  removed: Object.freeze<string[]>([]),
  count: 0,
});

/** A cell's key in a set of cells: `row.field` (an ID and a field hold no dot). */
export const cellKey = (rowId: string, field: string): string => `${rowId}.${field}`;

/** Whether the cell is one the user changed. */
export const cellChanged = (marks: TableMarks, rowId: string, field: string): boolean =>
  marks.changed.get(rowId)?.has(field) ?? false;

const held = (row: Readonly<Record<string, unknown>>, field: string): unknown =>
  Object.hasOwn(row, field) ? row[field] : undefined;

/** The marks of `edited` against `sent`. */
export const marksOf = (sent: TableProps, edited: TableProps): TableMarks => {
  const sentRows = new Map(sent.rows.map((row) => [row.id, row]));
  const editedIds = new Set(edited.rows.map((row) => row.id));
  const inputs = edited.columns.filter(isInputColumn);
  const changed = new Map<string, ReadonlySet<string>>();
  const added = new Set<string>();
  let count = 0;
  for (const row of edited.rows) {
    const before = sentRows.get(row.id);
    if (before === undefined) {
      added.add(row.id);
      count += 1;
      continue;
    }
    const fields = new Set(
      inputs.map(({ field }) => field).filter((field) => held(before, field) !== held(row, field)),
    );
    if (fields.size > 0) changed.set(row.id, fields);
    count += fields.size;
  }
  const removed = sent.rows.map((row) => row.id).filter((id) => !editedIds.has(id));
  count += removed.length;
  if (count === 0) return NO_MARKS;
  return Object.freeze({ changed, added, removed: Object.freeze(removed), count });
};

/** The toolbar's counter: "No changes", else "Your changes: N". */
export const changeCounter = (marks: TableMarks, language: Locale): string =>
  marks.count === 0
    ? say(language, "table.noChanges")
    : say(language, "table.changes", { count: marks.count });
