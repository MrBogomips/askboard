// The Approval's rules that its schemas cannot say (approval-scale-ranking, design decision 2):
// what its result requires of the answer it travels in, which `ask-core` runs where the answer's
// changes exist and the board runs before it sends, reading one rule (`approvalNeedsReason`).
//
// Plain ECMAScript with no JSON and no Ajv: the approval chunk bundles it. Nothing throws on a
// value it cannot read as an Approval's result; it gives no problem, since the schema refuses it.

import type { Problem } from "../../validate.ts";
import type { WidgetAnswer } from "../registry.ts";

const isDecision = (result: unknown, decision: string): boolean =>
  typeof result === "object" &&
  result !== null &&
  (result as { readonly decision?: unknown }).decision === decision;

/**
 * Whether the answer that carries `result` must carry the reason in its note: approving with
 * changes always has one. The board reads it to require the note, `approvalAnswerProblems` to
 * refuse an answer without one.
 */
export const approvalNeedsReason = (result: unknown): boolean =>
  isDecision(result, "approve-with-changes");

/** The reason of an answer: a note holding a character other than white space. */
const hasReason = (note: string | undefined): boolean => note !== undefined && /\S/.test(note);

/**
 * What an Approval's result requires of its answer: `approve-with-changes` needs a note holding a
 * character other than white space, and `approve` cannot travel in an answer whose changes name an
 * element (F-63). `reject` and an approval with nothing changed need nothing.
 */
export const approvalAnswerProblems = (
  result: unknown,
  answer: WidgetAnswer,
): readonly string[] => [
  ...(approvalNeedsReason(result) && !hasReason(answer.note)
    ? ["approving with changes needs the reason in the note"]
    : []),
  ...(isDecision(result, "approve") && answer.changed
    ? ["an answer that changes the content approves with changes"]
    : []),
];

/** An Approval has no props, so the schema says it all. */
export const approvalPropsProblems = (): readonly Problem[] => [];
