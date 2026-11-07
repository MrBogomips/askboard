// The Chart's chunk (design decisions 4 and 8): it registers `chart` through the `CatalogRenderer`
// port, the one part of `view` a widget imports (AD-1, AD-9), and holds the chart library's canvas
// renderer. The view hands a Chart's props over as data, unchecked, so the Chart checks them as an
// agent's with the contract's plain checks and throws on a problem: the item's error boundary then
// fails it and its question never counts as visible (AD-10). It highlights nothing until the user
// highlights a point, and reports the highlighted points as the item's result; none is no result.

import { type ChartProps, chartResultProblems, chartResultShape } from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useLocale,
  useStrings,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { highlightedPoints } from "./model.ts";
import { checkedChartProps } from "./props.ts";
import { ChartWidget } from "./widget.tsx";

/** The catalog name, which is the Chart item's type. */
const CHART = "chart";

/** A Chart item as the view hands it over, its props not checked yet. */
type UncheckedChartItem = {
  readonly type: "chart";
  readonly id: string;
  readonly props: unknown;
};

const Chart = ({
  item,
  questionId,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedChartItem>) => {
  const sent: ChartProps = useMemo(
    () => checkedChartProps(item.id, item.props),
    [item.id, item.props],
  );
  const highlighted = useMemo(() => highlightedPoints(result), [result]);
  return (
    <ChartWidget
      props={sent}
      itemId={item.id}
      labelledBy={questionTextId(questionId)}
      highlighted={highlighted}
      locale={useLocale()}
      say={useStrings()}
      disabled={disabled}
      ready={ready}
      onResult={onResultChange}
    />
  );
};

// The facts the shell needs of the Chart (widget-registry, design decision 8): its name in the
// notice, and whether a result fits its props, by the contract's shape and props checks (`fits`),
// the two `widgetResultFits` runs. It edits nothing and asks for no reason or confirmation.
register(CHART, Chart, {
  name: "change.widgetChart",
  fits: (result, props) =>
    chartResultShape(result) && chartResultProblems(result, props).length === 0,
});
