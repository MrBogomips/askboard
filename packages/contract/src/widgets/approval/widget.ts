// The Approval's registry entry (approval-scale-ranking, design decisions 1 and 2): its schemas,
// the answer's requirements of its result, wording, example and teaching text. It imports no
// runtime value of `validate.ts`, `sets.ts` or a schema set module (the registry's import rule).
// An Approval edits nothing and derives nothing: it gives a verdict.

import type { WidgetType } from "../registry.ts";
import approvalProps from "./approval-props.json" with { type: "json" };
import approvalResult from "./approval-result.json" with { type: "json" };
import { approvalAnswerProblems, approvalPropsProblems, approvalResultShape } from "./checks.ts";
import { APPROVAL_EXPECTED, APPROVAL_FIELDS } from "./wording.ts";

export const APPROVAL_WIDGET: WidgetType = {
  type: "approval",
  noun: "an Approval",
  props: approvalProps,
  propsProblems: approvalPropsProblems,
  result: {
    schema: approvalResult,
    shape: approvalResultShape,
    answerProblems: approvalAnswerProblems,
  },
  wording: { expected: APPROVAL_EXPECTED, fields: APPROVAL_FIELDS },
  example: { item: { type: "approval", id: "verdict", props: {} } },
  help: {
    mouse:
      "Press Approve, Approve with changes or Reject. For changes, write the reason in the note that opens.",
    answer:
      "The agent receives your decision, your reason if you gave one, and any changes you made to the question's other items.",
  },
  skill: {
    use: "a decision on its question's content: approve, approve with changes or reject; put it last in the question it approves",
    notes: [
      "The reason arrives as the answer's `note`; `approve-with-changes` always has one.",
      "An answer that edits the question's other items never carries `approve`.",
    ],
  },
};
