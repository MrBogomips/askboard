// The Scale's chunk (design decision 8): it registers `scale` through the `CatalogRenderer` port,
// the one part of `view` a widget imports (AD-1, AD-9). The view hands a Scale's props over as
// data, unchecked, so the Scale checks them as an agent's with the contract's plain checks and
// throws on a problem: the item's error boundary then fails it and its question never counts as
// visible (AD-10). It shows nothing set until the user sets it, and reports its value as the
// item's result, `{value}` or `{low, high}` with `range`; a rating cleared reports none.

import { type ScaleProps, scaleResultProblems, scaleResultShape } from "@askboard/contract";
import {
  type ItemProps,
  questionTextId,
  register,
  useLocale,
  useReadyAfterLayout,
} from "@askboard/view/catalog";
import { useMemo } from "react";
import { ratingChange, sliderChange } from "./change.ts";
import { firstResult, valuesOf } from "./model.ts";
import { checkedScaleProps } from "./props.ts";
import { ScaleWidget } from "./widget.tsx";

/** The catalog name, which is the Scale item's type. */
const SCALE = "scale";

/** A Scale item as the view hands it over, its props not checked yet. */
type UncheckedScaleItem = {
  readonly type: "scale";
  readonly id: string;
  readonly props: unknown;
};

const Scale = ({
  item,
  questionId,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedScaleItem>) => {
  const sent: ScaleProps = useMemo(
    () => checkedScaleProps(item.id, item.props),
    [item.id, item.props],
  );
  const locale = useLocale();
  useReadyAfterLayout(ready);
  return (
    <ScaleWidget
      props={sent}
      values={valuesOf(sent, result)}
      locale={locale}
      labelledBy={questionTextId(questionId)}
      disabled={disabled}
      onFirst={(value) => onResultChange(firstResult(sent, value))}
      onValues={(values) => onResultChange(sliderChange(sent, values))}
      onPress={(index) => onResultChange(ratingChange(sent, index))}
    />
  );
};

// The facts the shell needs of the Scale (widget-registry, design decision 8): its name in the
// notice, and whether a result fits its props, by the contract's shape and props checks (`fits`),
// the two `widgetResultFits` runs. It edits nothing
// and asks for no reason or confirmation.
register(SCALE, Scale, {
  name: "change.widgetScale",
  fits: (result, props) =>
    scaleResultShape(result) && scaleResultProblems(result, props).length === 0,
});
