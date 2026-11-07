// Entries in the shell (atoms, design decision 3; view-and-widgets spec: An entry blocks Answer;
// AD-10, AD-20): text a NumberField, MoneyField or DateField cannot read, or whose value a bound
// refuses, is kept in the draft record as the item's entry, apart from its value and its result. An
// entry is at most `ENTRY_MAX_CHARS` code points, belongs only to an item of those three types, goes
// with its item when an update removes it, is never part of an answer, and while any item of a
// question holds one the question's "Answer" is disabled and its description names the first field
// to correct. Plain functions, tested without a DOM.

import { ENTRY_MAX_CHARS, type Locale } from "@askboard/contract";
import { t } from "../strings/index.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { DraftStore } from "./draft-store.ts";

/** The widget types whose items hold an entry; a TextField and a Toggle never do (decision 3). */
export const ENTRY_ITEM_TYPES: readonly string[] = Object.freeze([
  "number-field",
  "money-field",
  "date-field",
]);

export const isEntryType = (type: string): boolean => ENTRY_ITEM_TYPES.includes(type);

/**
 * The items of a question that may hold an entry, in its order: the widget items of an entry type.
 * What an entry store holds for any other ID, such as an item whose type changed under the same ID
 * or one an update removed, is no entry of the question.
 */
export const entryIdsOf = (question: ViewQuestion): readonly string[] =>
  (question.props.items ?? []).filter((item) => isEntryType(item.type)).map((item) => item.id);

/**
 * The entry a text makes: the text cut at `ENTRY_MAX_CHARS` code points, or none when it is no text
 * or is empty.
 */
export const cutEntry = (text: unknown): string | undefined => {
  if (typeof text !== "string" || text === "") return undefined;
  const points = Array.from(text);
  return points.length <= ENTRY_MAX_CHARS ? text : points.slice(0, ENTRY_MAX_CHARS).join("");
};

/** The first item of the question, in its order, that holds an entry, with the label it shows. */
export type EntryBlock = { readonly itemId: string; readonly label: string };

const labelOf = (question: ViewQuestion, itemId: string): string => {
  const props = (question.props.items ?? []).find((item) => item.id === itemId)?.props;
  const label =
    typeof props === "object" && props !== null && Object.hasOwn(props, "label")
      ? (props as { readonly label?: unknown }).label
      : undefined;
  return typeof label === "string" && label !== "" ? label : itemId;
};

export const entryBlock = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
): EntryBlock | undefined => {
  const itemId = entryIdsOf(question).find((id) => entries.get(id) !== undefined);
  return itemId === undefined ? undefined : { itemId, label: labelOf(question, itemId) };
};

/** Whether an item of the question holds an entry: its "Answer" is then disabled. */
export const holdsEntry = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
): boolean => entryBlock(question, entries) !== undefined;

/**
 * What the disabled "Answer" is described by while the question holds an entry: "Correct {label}
 * first." naming the first field in error, the label as text; none while it holds none.
 */
export const answerHint = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
  language: Locale,
): string | undefined => {
  const block = entryBlock(question, entries);
  return block === undefined
    ? undefined
    : t(language, "question.entryHint", { label: block.label });
};

/**
 * Drops each entry whose item the document no longer holds as an item of an entry type: an update
 * that removed the item, or changed its type under the same ID, leaves no entry that nothing can
 * correct.
 */
export const dropStaleEntries = (document: ViewDocument, entries: DraftStore): void => {
  const held = new Set(questionsOf(document).flatMap((question) => entryIdsOf(question)));
  const stale = [...entries.record().keys()].filter((itemId) => !held.has(itemId));
  if (stale.length === 0) return;
  entries.update(Object.fromEntries(stale.map((itemId) => [itemId, undefined])));
};
