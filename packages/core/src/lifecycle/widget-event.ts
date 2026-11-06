// The widget fields of a logged answer event (widget-answers design decision 6, step 3, and the
// fold): the `changes` and `derived` of an answer in reference addressing, computed once, when the
// answer is appended, from the revision the answer names (AD-9, AD-20). The full edited values and
// derived values as sent are kept apart from the log, by the cursor of the event. Plain
// ECMAScript (AD-1).

import type { Change, QuestionProps } from "@askboard/contract";
import { answerInReferenceAddressing } from "../molecules/addressing.ts";
import type { ExpansionMap } from "../molecules/map.ts";
import type { WidgetContent } from "./widget-values.ts";

type Json = Readonly<Record<string, unknown>>;

/** What ask-core keeps of an answer's widget content: its question, edited values and derived values. */
export type KeptAnswer = {
  readonly itemId: string;
  /** The full edited value of each widget item the answer changed, by expanded item ID. */
  readonly values: Json;
  /** The derived values as the board sent them, by expanded address. */
  readonly derived: Json;
};

/** The `changes` and `derived` an answer event carries; a field with nothing in it is left out. */
export type WidgetFields = {
  readonly changes?: readonly Change[];
  readonly derived?: Json;
};

/**
 * The event's widget fields for `content`, checked against the revision `props`, in reference
 * addressing through `map`.
 */
export const widgetFieldsOf = (
  map: ExpansionMap,
  props: QuestionProps,
  content: WidgetContent,
): WidgetFields => {
  const addressed = answerInReferenceAddressing(
    map,
    { props },
    content.sent,
    content.values,
    content.derived,
  );
  return {
    ...(addressed.changes.length === 0 ? {} : { changes: addressed.changes }),
    ...(Object.keys(addressed.derived).length === 0 ? {} : { derived: addressed.derived }),
  };
};
