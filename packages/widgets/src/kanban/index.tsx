// The Kanban's chunk (design decision 9): it registers `kanban` through the `CatalogRenderer` port,
// the one part of `view` a widget imports (AD-1, AD-9). The view hands a Kanban's props over as
// data, unchecked, so the Kanban checks them as an agent's with its own shape check and the
// contract's plain check and throws on a problem: the item's error boundary then fails it and its
// question never counts as visible (AD-10). It shows its draft value's cards, else the agent's; a
// move puts the whole edited props into the draft, and a move back of every card clears the item's
// value. The Kanban gives no result: its answer is the `set`s of its cards' columns (AD-20). The
// drag library is the `dnd` chunk's.

import { KANBAN_SHAPE, type KanbanProps } from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { valueFor } from "./model.ts";
import { checkedKanbanProps, shownProps, valueFits } from "./props.ts";
import { KanbanWidget } from "./widget.tsx";

/** The catalog name, which is the Kanban item's type. */
const KANBAN = "kanban";

/** A Kanban item as the view hands it over, its props not checked yet. */
type UncheckedKanbanItem = {
  readonly type: "kanban";
  readonly id: string;
  readonly props: unknown;
};

const Kanban = ({
  item,
  questionId,
  value,
  onValueChange,
  disabled,
  ready,
}: ItemProps<UncheckedKanbanItem, KanbanProps>) => {
  const sent = useMemo(() => checkedKanbanProps(item.id, item.props), [item.id, item.props]);
  const shown = useMemo(() => shownProps(item.id, sent, value), [item.id, sent, value]);
  useReadyAfterLayout(ready);
  return (
    <KanbanWidget
      kanbanId={item.id}
      sent={sent}
      shown={shown}
      labelledBy={questionTextId(questionId)}
      disabled={disabled}
      onChange={(next) => onValueChange(valueFor(sent, next))}
    />
  );
};

// The facts the shell needs of the Kanban (widget-registry, design decision 8): the shape of its
// cards, for the agent's change, its name in the notice, and the check of a value it holds across a
// revision. It gives no result.
register(KANBAN, Kanban, {
  shape: () => KANBAN_SHAPE,
  name: "change.widgetKanban",
  valueFits,
});
