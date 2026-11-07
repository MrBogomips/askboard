// The Scale's rating (view-and-widgets spec: Scale as a rating; DESIGN.md: Toggle group): one
// joined toggle per step from `min` to `max`, the minimum and maximum labels at the ends, none
// pressed until the user presses one; the pressed step pressed again clears the value. A Radix
// Toggle Group, `single`, whose toggles are named by their value in the ask's locale.

import type { Locale, ScaleProps } from "@askboard/contract";
import { ToggleGroup } from "radix-ui";
import { RATING, RATING_LABEL, TOGGLE, TOGGLES } from "./classes.ts";
import { ratingValues } from "./model.ts";
import { ratingLabels } from "./text.ts";

export const ScaleRating = ({
  props,
  values,
  locale,
  labelledBy,
  disabled,
  onPress,
}: {
  readonly props: ScaleProps;
  readonly values: readonly number[] | undefined;
  readonly locale: Locale;
  readonly labelledBy: string;
  readonly disabled: boolean;
  /** A toggle was pressed: its place among the steps as text, or the empty value to clear. */
  readonly onPress: (index: string) => void;
}) => {
  const labels = ratingLabels(props, locale);
  const held = values?.[0];
  const at = held === undefined ? -1 : ratingValues(props).indexOf(held);
  return (
    <div className={RATING}>
      {props.minLabel === undefined ? null : <span className={RATING_LABEL}>{props.minLabel}</span>}
      <ToggleGroup.Root
        type="single"
        className={TOGGLES}
        aria-labelledby={labelledBy}
        value={at < 0 ? "" : String(at)}
        disabled={disabled}
        onValueChange={onPress}
      >
        {labels.map((label, index) => (
          <ToggleGroup.Item
            // biome-ignore lint/suspicious/noArrayIndexKey: a step is its place among the steps
            key={index}
            value={String(index)}
            className={TOGGLE}
          >
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {props.maxLabel === undefined ? null : <span className={RATING_LABEL}>{props.maxLabel}</span>}
    </div>
  );
};
