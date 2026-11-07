// The Approval summary as the board shows it (view-and-widgets spec: The Approval summary;
// DESIGN.md: Approval summary): a title counting the changes, or "No changes", one line per
// change, and "and N more" past the limit. The names and values are the agent's and the user's
// content, shown as text (AD-8).

import { useStrings } from "@askboard/view/catalog";
import {
  DOT,
  FIELD,
  KIND,
  LINE,
  LINES,
  MORE,
  NAME,
  NEXT,
  PREVIOUS,
  SUMMARY,
  SUMMARY_TITLE,
} from "./classes.ts";
import type { Summary, SummaryLine } from "./summary.ts";

const KIND_KEYS = {
  add: "approval.added",
  remove: "approval.removed",
  move: "approval.moved",
} as const;

// One line: a field's previous value struck through before the new one, or what was done to the
// element.
const Line = ({ line }: { readonly line: SummaryLine }) => {
  const text = useStrings();
  return (
    <li className={LINE} data-summary-line="">
      <span aria-hidden="true" className={DOT} />
      <span className={NAME}>{line.name}</span>
      {line.op === "set" ? (
        <>
          <span className={FIELD}>{line.field}</span>
          <del className={PREVIOUS}>{line.previous}</del>
          <ins className={NEXT}>{line.next}</ins>
        </>
      ) : (
        <span className={KIND}>{text(KIND_KEYS[line.op])}</span>
      )}
    </li>
  );
};

export const ApprovalSummary = ({ summary }: { readonly summary: Summary }) => {
  const text = useStrings();
  const title =
    summary.count === 0
      ? text("widget.noChanges")
      : text("approval.title", { count: summary.count });
  return (
    <div className={SUMMARY} data-approval-summary="">
      <p className={SUMMARY_TITLE} data-summary-title="">
        {title}
      </p>
      {summary.lines.length === 0 ? null : (
        <ul className={LINES}>
          {summary.lines.map((line) => (
            // The generic diff gives each operation on a target once.
            <Line
              key={`${line.op}.${line.itemId}.${line.elementId}.${line.field ?? ""}`}
              line={line}
            />
          ))}
        </ul>
      )}
      {summary.more === 0 ? null : (
        <p className={MORE} data-summary-more="">
          {text("approval.more", { count: summary.more })}
        </p>
      )}
    </div>
  );
};
