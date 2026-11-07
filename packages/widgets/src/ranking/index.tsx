// The Ranking's chunk (design decision 8): it registers `ranking` through the `CatalogRenderer`
// port, the one part of `view` a widget imports (AD-1, AD-9). The view hands a Ranking's props over
// as data, unchecked, so the Ranking checks them as an agent's with the contract's plain checks and
// throws on a problem: the item's error boundary then fails it and its question never counts as
// visible (AD-10). An untouched Ranking reports no result; a move, a drop or "Keep this order"
// reports `{order}`, the IDs of every element in the user's order.

import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { holdsOrder, orderOf } from "./model.ts";
import { checkedRankingProps } from "./props.ts";
import { RankingWidget } from "./widget.tsx";

/** The catalog name, which is the Ranking item's type. */
const RANKING = "ranking";

/** A Ranking item as the view hands it over, its props not checked yet. */
type UncheckedRankingItem = {
  readonly type: "ranking";
  readonly id: string;
  readonly props: unknown;
};

const Ranking = ({
  item,
  questionId,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedRankingItem>) => {
  const sent = useMemo(() => checkedRankingProps(item.id, item.props), [item.id, item.props]);
  useReadyAfterLayout(ready);
  return (
    <RankingWidget
      rankingId={item.id}
      props={sent}
      order={orderOf(result, sent)}
      held={holdsOrder(result, sent)}
      labelledBy={questionTextId(questionId)}
      disabled={disabled}
      onOrder={(order) => onResultChange({ order: [...order] })}
    />
  );
};

// The facts the shell needs of the Ranking (widget-registry, design decision 8): its name in the
// notice. It edits nothing and asks for no reason or confirmation.
register(RANKING, Ranking, { name: "change.widgetRanking" });
