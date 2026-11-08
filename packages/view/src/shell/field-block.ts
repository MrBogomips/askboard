// The field block in the shell (form-widget, design decision 5; view-and-widgets spec: A field check
// blocks Answer, Answer names the field to fix; AD-10, AD-20, NFR-10): the first field of a question,
// in document order and at any depth, that stops "Answer" because it holds an entry, because its
// value fails its field check, or because it is required and empty. Every reader of what used to be
// atoms' entry block goes through it: the card's state, "Answer", "Accept recommended", "Select
// recommended", Submit and the ready mark. The checks are the facts each field chunk registered
// (`ComponentFacts.check`, the contract's functions): the shell imports no registry and restates no
// check. An item the card makes read-only on a revision it cannot show (`readOnlyItemsOf`) is
// skipped by every reader: its result points into the content of the revision the answer names,
// so a check against the shown content says nothing, and the user could not act on a hint
// (document-review, design decision 15). Plain functions, tested without a DOM.

import type { FieldCheckFailure, Locale } from "@askboard/contract";
import { type ComponentFacts, componentFacts } from "../catalog/port.ts";
import { nestedItemById, valueItemsOf } from "../nested-items.ts";
import { t } from "../strings/index.ts";
import type { ViewQuestion } from "../view-document.ts";
import { isEntryType } from "./entries.ts";

/** The facts a widget type's chunk registered, if any (the shell's one lookup). */
export type CheckFactsOf = (type: string) => ComponentFacts | undefined;

/**
 * Why a field blocks: it holds text it cannot read (`entry`), its value fails its check (`check`),
 * or it is required and holds no value (`required`).
 */
export type FieldBlockKind = "entry" | "check" | "required";

/** The first blocking field of the question, with the label it shows. */
export type FieldBlock = {
  readonly itemId: string;
  readonly label: string;
  readonly kind: FieldBlockKind;
  /** Why a `check` block fails, when the check said (the hint of a detached annotation reads it). */
  readonly failure?: FieldCheckFailure;
};

// The text prop `name` of the item `itemId`, wherever it nests, or none when it holds no non-empty
// text there.
const textPropOf = (question: ViewQuestion, itemId: string, name: string): string | undefined => {
  const props = nestedItemById(question.props.items, itemId)?.props;
  const value =
    typeof props === "object" && props !== null && Object.hasOwn(props, name)
      ? (props as Readonly<Record<string, unknown>>)[name]
      : undefined;
  return typeof value === "string" && value !== "" ? value : undefined;
};

/** The label an item shows: its `label` prop as text, else its ID. */
export const labelOf = (question: ViewQuestion, itemId: string): string =>
  textPropOf(question, itemId, "label") ?? itemId;

/**
 * The failure of one item's check against the result held for it, if its type registered one and
 * the item fails it. Never throws on a type that registered none.
 */
export const itemCheckFailure = (
  item: { readonly type: string; readonly props: unknown },
  result: unknown,
  factsOf: CheckFactsOf = componentFacts,
): FieldCheckFailure | undefined => factsOf(item.type)?.check?.(result, item.props);

/**
 * The first field of `question` that blocks "Answer", in document order and at any depth, or none.
 * An entry comes first for its own item, then the item's check against the result the user holds
 * (`results`, the draft's results); a check that fails for want of a value is `required`, one that
 * fails on a value is `check`. Layouts are not fields; an item whose type registered no check never
 * blocks. The entries and results are the ones the card follows, never the answer's. An item in
 * `readOnly`, the card's read-only set, is no field here, whatever it holds.
 */
export const fieldBlock = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
  results: ReadonlyMap<string, unknown>,
  factsOf: CheckFactsOf = componentFacts,
  readOnly?: ReadonlySet<string>,
): FieldBlock | undefined => {
  for (const item of valueItemsOf(question.props.items)) {
    if (readOnly?.has(item.id) === true) continue;
    const block = (kind: FieldBlockKind, failure?: FieldCheckFailure): FieldBlock => ({
      itemId: item.id,
      label: labelOf(question, item.id),
      kind,
      ...(failure === undefined ? {} : { failure }),
    });
    if (isEntryType(item.type) && entries.get(item.id) !== undefined) return block("entry");
    const result = results.get(item.id);
    const failure = itemCheckFailure(item, result, factsOf);
    if (failure === undefined) continue;
    return result === undefined ? block("required") : block("check", failure);
  }
  return undefined;
};

/** Whether a field of the question blocks: "Answer" is then disabled. */
export const holdsBlock = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
  results: ReadonlyMap<string, unknown>,
  factsOf: CheckFactsOf = componentFacts,
  readOnly?: ReadonlySet<string>,
): boolean => fieldBlock(question, entries, results, factsOf, readOnly) !== undefined;

// The hint of a detached annotation (document-review, design decision 8): "Delete the detached
// comments in {title} first.", the title being the item's `title` as text, else "the document".
const detachedHint = (question: ViewQuestion, itemId: string, language: Locale): string => {
  const title = textPropOf(question, itemId, "title");
  return title === undefined
    ? t(language, "documentReview.hintUntitled")
    : t(language, "documentReview.hint", { label: title });
};

/**
 * What the disabled "Answer" is described by while a field blocks: "Correct {label} first." for an
 * entry or a value that fails its check, "Complete {label} first." for an empty required field,
 * naming the first field, the label as text; none while no field blocks.
 */
export const answerHint = (
  question: ViewQuestion,
  entries: ReadonlyMap<string, unknown>,
  results: ReadonlyMap<string, unknown>,
  language: Locale,
  factsOf: CheckFactsOf = componentFacts,
  readOnly?: ReadonlySet<string>,
): string | undefined => {
  const block = fieldBlock(question, entries, results, factsOf, readOnly);
  if (block === undefined) return undefined;
  if (block.failure?.code === "detached") return detachedHint(question, block.itemId, language);
  return t(language, block.kind === "required" ? "question.requiredHint" : "question.entryHint", {
    label: block.label,
  });
};
