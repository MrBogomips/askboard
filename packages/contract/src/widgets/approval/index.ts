// The Approval (FR-11, approval-scale-ranking): a verdict on its question's content, `approve`,
// `approve-with-changes` or `reject`, with the reason in the answer's note. Its schemas are
// standalone: they belong to no schema set until the entry is registered (design decision 10), and
// nothing compiles them when this module loads.

export {
  approvalAnswerProblems,
  approvalNeedsReason,
  approvalPropsProblems,
  noteHoldsReason,
} from "./checks.ts";
export {
  APPROVAL_DECISIONS,
  APPROVAL_SCHEMA_IDS,
  type ApprovalDecision,
  type ApprovalItem,
  type ApprovalResult,
} from "./constants.ts";
export { APPROVAL_WIDGET } from "./widget.ts";
