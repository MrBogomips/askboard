// Entries in the shell (atoms, design decision 3; view-and-widgets spec: An entry blocks Answer;
// AD-10, AD-20): text a NumberField, MoneyField or DateField cannot read, or whose value a bound
// refuses, is kept in the draft record as the item's entry, apart from its value and its result. An
// entry is at most `ENTRY_MAX_CHARS` code points, belongs only to an item of those three types, goes
// with its item when an update removes it, is never part of an answer, and while any item of a
// question holds one the question's "Answer" is disabled (the field block, `field-block.ts`, reads
// them with the fields' checks and names the first field to fix). A Table's cell entries are the
// same block, fed through `entriesWithCells` (`cell-entries.ts`; table-widget, design decision 8).
// Plain functions, tested without a DOM.

import { ENTRY_MAX_CHARS } from "@askboard/contract";
import { valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ShownOf } from "./agent-change.ts";
import type { DraftStore } from "./draft-store.ts";

/** The widget types whose items hold a plain entry, the text of one field (decision 3). */
const FIELD_ENTRY_TYPES: readonly string[] = Object.freeze([
  "number-field",
  "money-field",
  "date-field",
]);

/**
 * The widget types whose items can block "Answer" with unreadable text: the three fields, which hold
 * one entry, and the Table, which holds one per cell (table-widget, design decision 8); a TextField
 * and a Toggle never do. The readers look at these items, through `entriesWithCells`.
 */
export const ENTRY_ITEM_TYPES: readonly string[] = Object.freeze([...FIELD_ENTRY_TYPES, "table"]);

/** Whether an item of the type holds a plain entry: the three fields, not the Table, whose cells hold theirs. */
export const isEntryType = (type: string): boolean => FIELD_ENTRY_TYPES.includes(type);

/**
 * The items of a question that may hold an entry, in its order: the widget items of an entry type.
 * What an entry store holds for any other ID, such as an item whose type changed under the same ID
 * or one an update removed, is no entry of the question.
 */
export const entryIdsOf = (question: ViewQuestion): readonly string[] =>
  valueItemsOf(question.props.items)
    .filter((item) => ENTRY_ITEM_TYPES.includes(item.type))
    .map((item) => item.id);

/**
 * The items of a question that hold a plain entry, in its order: what the entries store may hold and
 * the draft record's `entries` may name; a Table's cells are the cell entries store's.
 */
export const fieldEntryIdsOf = (question: ViewQuestion): readonly string[] =>
  valueItemsOf(question.props.items)
    .filter((item) => isEntryType(item.type))
    .map((item) => item.id);

/**
 * The entry a text makes: the text cut at `ENTRY_MAX_CHARS` code points, or none when it is no text
 * or is empty.
 */
export const cutEntry = (text: unknown): string | undefined => {
  if (typeof text !== "string" || text === "") return undefined;
  const points = Array.from(text);
  return points.length <= ENTRY_MAX_CHARS ? text : points.slice(0, ENTRY_MAX_CHARS).join("");
};

/**
 * The IDs `read` gives for the question and, where the card shows another revision of it (`shown`,
 * after "Keep mine" with no reload), for that revision too: the work kept across an update names the
 * items of either, in the order of the question's then the shown revision's (document-review, design
 * decision 15). The question's own list when the card shows the question itself.
 */
export const idsOver = (
  read: (question: ViewQuestion) => readonly string[],
  question: ViewQuestion,
  shown: ViewQuestion,
): readonly string[] =>
  shown === question ? read(question) : [...new Set([...read(question), ...read(shown)])];

/**
 * Drops each entry whose item neither the document's question nor the question as the card shows it
 * (`shownOf`) holds as an item of an entry type: an update that removed the item, or changed its
 * type under the same ID, leaves no entry that nothing can correct. An entry on an item only the
 * shown revision holds stays: the card shows that revision after "Keep mine", where the user can
 * correct it, and the answer names it (document-review, design decision 15; review S-1 of 6.17).
 * With no `shownOf`, or once a reload left the page no earlier revision to show, the current one.
 */
export const dropStaleEntries = (
  document: ViewDocument,
  entries: DraftStore,
  shownOf?: ShownOf,
): void => {
  const held = new Set(
    questionsOf(document).flatMap((question) =>
      idsOver(fieldEntryIdsOf, question, shownOf?.(question) ?? question),
    ),
  );
  const stale = [...entries.record().keys()].filter((itemId) => !held.has(itemId));
  if (stale.length === 0) return;
  entries.update(Object.fromEntries(stale.map((itemId) => [itemId, undefined])));
};
