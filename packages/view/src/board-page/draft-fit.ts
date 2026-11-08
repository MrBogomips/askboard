// The draft mirror keeps whole questions that fit (oversized-acts, design decision 4; AD-20): a
// record over the draft limit is mirrored without the work of whole questions, the largest first,
// until it fits, never with part of a question's work. Pure: the controller decides what to show.

import { DRAFT_RECORD_MAX_CHARS, type DraftRecord, draftRecordChars } from "@askboard/contract";

export type FittedDraft = {
  /** The record to mirror: the one given when it fits, else it without the questions left out. */
  readonly record: DraftRecord;
  /** The questions left out, in the order they were removed: empty when the record fits. */
  readonly leftOut: readonly string[];
};

type Sized = { readonly id: string; readonly size: number; readonly rank: number };

// The characters one question takes in the record's JSON: its key, the colon and its work.
const sizedQuestions = (record: DraftRecord, order: readonly string[]): Sized[] =>
  Object.entries(record.questions).map(([id, work], index) => {
    const at = order.indexOf(id);
    return {
      id,
      size: JSON.stringify(id).length + 1 + JSON.stringify(work).length,
      // Board order breaks ties; a question the order does not name follows, in record order.
      rank: at === -1 ? order.length + index : at,
    };
  });

/**
 * The record that `board-host` is sent, with the questions left out; `undefined` when it cannot be
 * made to fit, which only a record whose fields outside its questions pass the limit is. Each
 * question is measured once, by its own JSON, and the result is checked by the record's own count.
 */
export const fitDraftRecord = (
  record: DraftRecord,
  order: readonly string[],
): FittedDraft | undefined => {
  const total = draftRecordChars(record);
  if (total <= DRAFT_RECORD_MAX_CHARS) return { record, leftOut: [] };
  const sized = sizedQuestions(record, order).sort((a, b) => b.size - a.size || a.rank - b.rank);
  const all = sized.length;
  const leftOut: string[] = [];
  let length = total;
  // Each removal takes the question's entry and, while any remain, one comma between entries.
  for (const { id, size } of sized) {
    if (length <= DRAFT_RECORD_MAX_CHARS) break;
    const commas = leftOut.length + 1 < all ? 1 : 0;
    length -= size + commas;
    leftOut.push(id);
  }
  const removed = new Set(leftOut);
  const kept = Object.fromEntries(
    Object.entries(record.questions).filter(([id]) => !removed.has(id)),
  );
  const fitted: DraftRecord = { ...record, questions: kept };
  return draftRecordChars(fitted) <= DRAFT_RECORD_MAX_CHARS
    ? { record: fitted, leftOut }
    : undefined;
};
