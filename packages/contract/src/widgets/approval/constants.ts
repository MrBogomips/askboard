// The Approval's constants and types (approval-scale-ranking, design decision 1): the verdicts a
// result holds, the schemas' IDs and the shapes of an item and its result. Each frozen constant is
// marked pure, so that a view chunk drops those it does not use.

/** The verdicts of an Approval's result, in the order the board shows them. */
export const APPROVAL_DECISIONS = /* @__PURE__ */ Object.freeze([
  "approve",
  "approve-with-changes",
  "reject",
] as const);

export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const APPROVAL_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:approval-props",
  result: "urn:askboard:output:approval-result",
} as const);

/** An Approval's result: the verdict alone; the reason is the answer's note. */
export type ApprovalResult = { readonly decision: ApprovalDecision };

export type ApprovalItem = {
  readonly type: "approval";
  readonly id: string;
  readonly props: Readonly<Record<string, never>>;
};
