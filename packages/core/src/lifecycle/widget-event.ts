// The widget fields of a logged answer event (widget-answers design decision 6, step 3, and the
// fold; widget-registry design decision 6): the `changes`, `results` and `derived` of an answer in
// reference addressing, computed once, when the answer is appended, from the revision the answer
// names (AD-9, AD-20). The full edited values, the results and the derived values as sent are kept
// apart from the log, by the cursor of the event. Plain ECMAScript (AD-1).

import {
  ANSWER_EVENT_MAX_CHARS,
  type AnswerEvent,
  type Change,
  fieldCheckMessage,
  fieldCheckProp,
  type QuestionProps,
  WIDGET_TYPES,
  type WidgetType,
  widgetAnswerProblems,
  widgetFieldCheck,
} from "@askboard/contract";
import { answerInReferenceAddressing, referenceAddressing } from "../molecules/addressing.ts";
import type { ExpansionMap } from "../molecules/map.ts";
import type { WidgetContent } from "./widget-values.ts";

type Json = Readonly<Record<string, unknown>>;

/** What ask-core keeps of an answer's widget content: its question, values, results and derived values. */
export type KeptAnswer = {
  readonly itemId: string;
  /** The full edited value of each widget item the answer changed, by expanded item ID. */
  readonly values: Json;
  /** The result each widget item the answer gave one for, by expanded item ID, whole. */
  readonly results: Json;
  /** The derived values as the board sent them, by expanded address. */
  readonly derived: Json;
};

/** The `changes`, `results` and `derived` an answer event carries; a field with nothing in it is left out. */
export type WidgetFields = {
  readonly changes?: readonly Change[];
  readonly results?: Json;
  readonly derived?: Json;
};

/**
 * The reference addresses two result keys share, when they do: the event holds one result per
 * address, so an answer whose results would collide is refused, never silently cut (AD-10).
 */
export const sharedResultAddress = (map: ExpansionMap, results: Json): string | undefined => {
  const toReference = referenceAddressing(map).toReference;
  const seen = new Set<string>();
  for (const key of Object.keys(results)) {
    const address = toReference(key);
    if (seen.has(address)) return address;
    seen.add(address);
  }
  return undefined;
};

/**
 * The event's widget fields for `content`, checked against the revision `props`, in reference
 * addressing through `map`.
 */
export const widgetFieldsOf = (
  map: ExpansionMap,
  props: QuestionProps,
  content: WidgetContent,
  types: readonly WidgetType[] = WIDGET_TYPES,
): WidgetFields => {
  const addressed = answerInReferenceAddressing(
    map,
    { props },
    content.sent,
    content.values,
    content.derived,
    types,
  );
  const results = referenceAddressing(map).results(content.results);
  return {
    ...(addressed.changes.length === 0 ? {} : { changes: addressed.changes }),
    ...(Object.keys(results).length === 0 ? {} : { results }),
    ...(Object.keys(addressed.derived).length === 0 ? {} : { derived: addressed.derived }),
  };
};

/**
 * Why the answer's note and changes do not satisfy what its results require, if they do not (the
 * registry's answer checks, approval-scale-ranking's design decisions 2 and 3): the first problem of
 * the first result that has one, naming its item. It reads the content `widgetContentOf` has
 * already checked, so each key names an item of the question, and runs after the result checks.
 */
export const answerRequirementProblem = (
  content: WidgetContent,
  fields: WidgetFields,
  note: string | undefined,
  types: readonly WidgetType[] = WIDGET_TYPES,
): string | undefined => {
  const answer = { note, changed: (fields.changes?.length ?? 0) > 0 };
  for (const [id, result] of Object.entries(content.results)) {
    const item = content.sent.find((sent) => sent.id === id);
    if (item === undefined) continue;
    const [first] = widgetAnswerProblems({ type: item.type, id }, result, answer, types);
    if (first !== undefined) return first;
  }
  return undefined;
};

/**
 * Why a field of the question fails its check against the answer's results, if one does (form-widget
 * design decisions 2 and 3): the first item, in document order and at any depth, whose type's
 * `fieldCheck` fails for its result, or for none when the answer gives it none. The sentence names
 * the item and the check. The checks run on the items as sent (a field takes no edited value) and
 * are the contract's own, the view's too. The TextField's `pattern` is no check here: the session
 * process runs no agent pattern on user text (NFR-10, AD-8). Called for answers only, so a decline
 * and a note are unaffected, after `answerRequirementProblem`.
 */
export const fieldCheckProblem = (
  content: WidgetContent,
  types: readonly WidgetType[] = WIDGET_TYPES,
): string | undefined => {
  for (const item of content.sent) {
    const result = Object.hasOwn(content.results, item.id) ? content.results[item.id] : undefined;
    const failure = widgetFieldCheck(item, result, types);
    if (failure === undefined) continue;
    return `item "${item.id}" ${fieldCheckMessage(failure)} (${fieldCheckProp(failure)})`;
  }
  return undefined;
};

/**
 * The event as `collect` returns it: over `ANSWER_EVENT_MAX_CHARS` serialized, it is logged
 * without `changes`, `results` and `derived` and with `tooLarge: true`, and `fetch` has them
 * (FR-20, AD-6). An event within the limit is returned as it is.
 */
export const withinLimit = (event: AnswerEvent): AnswerEvent => {
  if (JSON.stringify(event).length <= ANSWER_EVENT_MAX_CHARS) return event;
  const { changes: _changes, results: _results, derived: _derived, ...rest } = event;
  return { ...rest, tooLarge: true };
};
