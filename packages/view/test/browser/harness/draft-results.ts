// The result a widget item holds in the draft record the view mirrored (approval-scale-ranking,
// task 5b.4; spec view-and-widgets, the "THEN the draft holds ..." clauses): the latest record
// decides, a question with no unsent work has no entry, and an item with no result has none. Works
// on the widget host's `drafts` and on the board page's `sentDrafts`. Not a test file.

import type { DraftRecord } from "@askboard/contract";
import type { ViewMessage } from "../../../src/view-protocol.ts";

/** The records a run mirrored: the widget host's `draft` messages or the board page's records. */
export type DraftSource = readonly (DraftRecord | ViewMessage)[];

// The record of an entry: a record itself, or the `draft` message holding one.
const recordOf = (entry: DraftSource[number]): DraftRecord | undefined =>
  "questions" in entry ? entry : "record" in entry ? entry.record : undefined;

/** The latest mirrored record's result of `itemId` in `questionId`; undefined when it holds none. */
export const draftResultOf = (drafts: DraftSource, questionId: string, itemId: string): unknown => {
  const latest = drafts.at(-1);
  if (latest === undefined) return undefined;
  const questions = recordOf(latest)?.questions;
  if (questions === undefined || !Object.hasOwn(questions, questionId)) return undefined;
  const results = questions[questionId]?.results;
  return results !== undefined && Object.hasOwn(results, itemId) ? results[itemId] : undefined;
};

/** Whether that result deeply equals `expected`, key order aside; `undefined` expects none. */
export const draftHolds = (
  drafts: DraftSource,
  questionId: string,
  itemId: string,
  expected: unknown,
): boolean => Bun.deepEquals(draftResultOf(drafts, questionId, itemId), expected, true);
