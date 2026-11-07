// The Timeline's chunk (design decision 10): it registers `timeline` through the `CatalogRenderer`
// port, the one part of `view` a widget imports (AD-1, AD-9). The view hands a Timeline's props over
// as data, unchecked, so the Timeline checks them as an agent's with its own shape check and the
// contract's plain check and throws on a problem: the item's error boundary then fails it and its
// question never counts as visible (AD-10). It shows its draft value's entries, else the agent's; a
// move puts the whole edited props into the draft, and a move back of every entry clears the item's
// value. The Timeline gives no result: its answer is the `set`s of its entries' lanes and days
// (AD-20). Entries move by pointer drag, with no drag library.

import { TIMELINE_SHAPE, type TimelineProps } from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { valueFor } from "./model.ts";
import { checkedTimelineProps, shownProps, valueFits } from "./props.ts";
import { TimelineWidget } from "./widget.tsx";

/** The catalog name, which is the Timeline item's type. */
const TIMELINE = "timeline";

/** A Timeline item as the view hands it over, its props not checked yet. */
type UncheckedTimelineItem = {
  readonly type: "timeline";
  readonly id: string;
  readonly props: unknown;
};

const Timeline = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  ready,
}: ItemProps<UncheckedTimelineItem, TimelineProps>) => {
  const sent = useMemo(() => checkedTimelineProps(item.id, item.props), [item.id, item.props]);
  const shown = useMemo(() => shownProps(item.id, sent, value), [item.id, sent, value]);
  useReadyAfterLayout(ready);
  return (
    <TimelineWidget
      sent={sent}
      shown={shown}
      labelledBy={questionTextId(questionId)}
      disabled={disabled}
      onChange={(next) => onValueChange(valueFor(sent, next))}
    />
  );
};

// The facts the shell needs of the Timeline (widget-registry, design decision 8): the shape of its
// entries, for the agent's change, its name in the notice, and the check of a value it holds across a
// revision. It gives no result.
register(TIMELINE, Timeline, {
  shape: () => TIMELINE_SHAPE,
  name: "change.widgetTimeline",
  valueFits,
});
