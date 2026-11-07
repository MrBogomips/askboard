// The Approval's decisions as plain data (view-and-widgets spec: Approval decisions, Approving a
// question that holds changes; design decision 8): what the held result says, what a press puts in
// the draft, and what "Approve" does beside changes. Pure.

import { APPROVAL_DECISIONS, type ApprovalDecision, type ApprovalResult } from "@askboard/contract";

const isDecision = (value: unknown): value is ApprovalDecision =>
  APPROVAL_DECISIONS.some((decision) => decision === value);

/** The decision a held result names, else none: a result of any other shape holds no decision. */
export const decisionOf = (result: unknown): ApprovalDecision | undefined => {
  if (typeof result !== "object" || result === null) return undefined;
  const { decision } = result as { readonly decision?: unknown };
  return isDecision(decision) ? decision : undefined;
};

/**
 * The result a press puts in the draft: the pressed decision, or none for the empty value a toggle
 * group reports when its pressed item is pressed again.
 */
export const resultFor = (value: string): ApprovalResult | undefined =>
  isDecision(value) ? { decision: value } : undefined;

/** Whether `decision` may be selected while the question holds `changes` changes: not "Approve". */
export const selectable = (decision: ApprovalDecision, changes: number): boolean =>
  !(decision === "approve" && changes > 0);

/** Whether the held result is an "Approve" that a change has made impossible (F-63). */
export const heldApprove = (result: unknown, changes: number): boolean =>
  decisionOf(result) === "approve" && changes > 0;

/** What an Approval's props lack to be its own: it has none. The message names the item. */
export const approvalPropsError = (itemId: string, props: unknown): string | undefined =>
  typeof props === "object" &&
  props !== null &&
  !Array.isArray(props) &&
  Object.keys(props).length === 0
    ? undefined
    : `the Approval "${itemId}" refuses its props: an Approval has none`;
