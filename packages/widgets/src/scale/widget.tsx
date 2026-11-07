// The Scale's block (view-and-widgets spec: Scale as a slider, Scale as a rating, Result widgets
// read-only): the value label above the control, "Not set" until a value is set, then the slider
// or the rating, and under a slider the labels of its two ends. The value is the item's result, or
// none; nothing is set until the user sets it (AD-10).

import type { Locale, ScaleProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { ENDS, SCALE, VALUE, VALUE_UNSET } from "./classes.ts";
import { ScaleRating } from "./rating.tsx";
import { ScaleSlider } from "./slider.tsx";
import { valueLabel } from "./text.ts";

export const ScaleWidget = ({
  props,
  values,
  locale,
  labelledBy,
  disabled,
  onFirst,
  onValues,
  onPress,
}: {
  readonly props: ScaleProps;
  readonly values: readonly number[] | undefined;
  readonly locale: Locale;
  readonly labelledBy: string;
  readonly disabled: boolean;
  readonly onFirst: (value: number) => void;
  readonly onValues: (values: readonly number[]) => void;
  readonly onPress: (index: string) => void;
}) => {
  const text = useStrings();
  const rating = props.display === "rating";
  return (
    <div className={SCALE} data-scale="">
      <p className={values === undefined ? VALUE_UNSET : VALUE} data-scale-value="">
        {valueLabel(props, values, locale, text)}
      </p>
      {rating ? (
        <ScaleRating
          props={props}
          values={values}
          locale={locale}
          labelledBy={labelledBy}
          disabled={disabled}
          onPress={onPress}
        />
      ) : (
        <>
          <ScaleSlider
            props={props}
            values={values}
            labelledBy={labelledBy}
            disabled={disabled}
            onFirst={onFirst}
            onValues={onValues}
          />
          {props.minLabel === undefined && props.maxLabel === undefined ? null : (
            <div className={ENDS}>
              <span>{props.minLabel}</span>
              <span>{props.maxLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
