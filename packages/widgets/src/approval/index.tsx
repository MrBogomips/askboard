// The Approval's chunk (design decisions 5 and 8): it registers `approval` through the
// `CatalogRenderer` port, the one part of `view` a widget imports (AD-1, AD-9). An Approval has no
// props, so checking them throws on any; the item's error boundary then fails it and its question
// never counts as visible (AD-10). It reports its decision as the item's result and reads the
// changes of the question's other widget items from the board, through the shapes their chunks
// registered, for its summary (a whole-field change is named by its widget's name in the notice)
// and for refusing "Approve" beside them. Its facts tell the shell
// that "Approve with changes" requires the reason in the open prompt and that revising a verdict
// the agent has received asks first.

import { approvalNeedsReason, approvalResultShape } from "@askboard/contract";
import {
  componentFacts,
  type ItemProps,
  register,
  useLocale,
  useReadyAfterLayout,
  useStrings,
} from "@askboard/view/catalog";
import { useEffect, useMemo } from "react";
import { approvalPropsError, decisionOf, heldApprove, resultFor } from "./decision.ts";
import { summaryItemsOf } from "./items.ts";
import { summarise } from "./summary.ts";
import { ApprovalWidget } from "./widget.tsx";
import { valueWordsOf } from "./words.ts";

/** The catalog name, which is the Approval item's type. */
const APPROVAL = "approval";

/** An Approval item as the view hands it over, its props not checked yet. */
type UncheckedApprovalItem = {
  readonly type: "approval";
  readonly id: string;
  readonly props: unknown;
};

// The element shape the chunk of `type` registered for `props`, if its type has one to diff by.
const shapeOf = (type: string, props: object) => componentFacts(type)?.shape?.(props);

const Approval = ({
  item,
  questionId,
  result,
  onResultChange,
  disabled,
  ready,
  board,
}: ItemProps<UncheckedApprovalItem>) => {
  const problem = approvalPropsError(item.id, item.props);
  if (problem !== undefined) throw new Error(problem);
  const text = useStrings();
  const locale = useLocale();
  const summary = useMemo(
    () =>
      summarise({
        items: summaryItemsOf(board, questionId, item.id),
        shapeOf,
        locale,
        words: valueWordsOf(text),
        widgetName: (type) => {
          const name = componentFacts(type)?.name;
          return name === undefined ? type : text(name);
        },
      }),
    [board, questionId, item.id, locale, text],
  );
  // A held "Approve" that a change has made impossible is cleared, never left to the user to find.
  const stale = !disabled && heldApprove(result, summary.count);
  useEffect(() => {
    if (stale) onResultChange(undefined);
  }, [stale, onResultChange]);
  useReadyAfterLayout(ready);
  return (
    <ApprovalWidget
      itemId={item.id}
      decision={stale ? undefined : decisionOf(result)}
      summary={summary}
      disabled={disabled}
      onSelect={(value) => onResultChange(resultFor(value))}
    />
  );
};

// The facts the shell needs of the Approval (design decision 5): its name in the notice, the
// reason "Approve with changes" requires, the confirmation a received verdict's revision asks, and
// whether a result fits (`fits`): the contract's shape check, since an Approval has no props to
// check it against.
register(APPROVAL, Approval, {
  name: "change.widgetApproval",
  reason: (result) =>
    approvalNeedsReason(result)
      ? { label: "question.reasonRequired", missing: "question.reasonMissing" }
      : undefined,
  confirmsRevision: true,
  fits: (result) => approvalResultShape(result),
});
