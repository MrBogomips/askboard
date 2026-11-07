// The Approval's block (view-and-widgets spec: Approval decisions, Approving a question that holds
// changes, Result widgets read-only; design decision 8): the decisions as a Radix Toggle Group,
// one Tab stop whose arrow keys move between them, under the "Approval" label, and the summary of
// the question's changes beside them. A decision only selects: pressing it reports the result, and
// pressing the selected one again reports none. "Approve" cannot be selected beside changes.

import type { ApprovalDecision } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { ToggleGroup } from "radix-ui";
import { BLOCK, CHECK, DECISION, DECISIONS, GROUP, SECTION_LABEL } from "./classes.ts";
import { selectable } from "./decision.ts";
import type { Summary } from "./summary.ts";
import { ApprovalSummary } from "./summary-view.tsx";

const DECISION_KEYS = {
  approve: "approval.approve",
  "approve-with-changes": "approval.approveWithChanges",
  reject: "approval.reject",
} as const;

const ORDER: readonly ApprovalDecision[] = ["approve", "approve-with-changes", "reject"];

export const ApprovalWidget = ({
  itemId,
  decision,
  summary,
  disabled,
  onSelect,
}: {
  readonly itemId: string;
  /** The decision shown selected, if any. */
  readonly decision: ApprovalDecision | undefined;
  readonly summary: Summary;
  /** The question is answered, being sent or locked: nothing can be selected. */
  readonly disabled: boolean;
  /** A decision was pressed: its value, or the empty value when the selected one was pressed again. */
  readonly onSelect: (value: string) => void;
}) => {
  const text = useStrings();
  const labelId = `${itemId}:approval`;
  return (
    <div className={BLOCK} data-approval="">
      <div className={DECISIONS}>
        <span id={labelId} className={SECTION_LABEL}>
          {text("approval.label")}
        </span>
        <ToggleGroup.Root
          type="single"
          className={GROUP}
          aria-labelledby={labelId}
          value={decision ?? ""}
          disabled={disabled}
          onValueChange={onSelect}
        >
          {ORDER.map((value) => (
            <ToggleGroup.Item
              key={value}
              value={value}
              className={DECISION}
              disabled={!selectable(value, summary.count)}
            >
              {decision === value ? (
                <span aria-hidden="true" className={CHECK}>
                  ✓
                </span>
              ) : null}
              {text(DECISION_KEYS[value])}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
      <ApprovalSummary summary={summary} />
    </div>
  );
};
