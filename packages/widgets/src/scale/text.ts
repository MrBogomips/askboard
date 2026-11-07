// The Scale's texts (view-and-widgets spec: Scale as a slider, Scale as a rating; ux-update-draft
// block 2): values and the unit in the ask's locale, "Not set" in the ask's language while nothing
// is set. Pure: the string lookup is passed in.

import { formatNumber, type Locale, type ScaleProps } from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";
import { ratingValues } from "./model.ts";

const RANGE_SEPARATOR = " – ";

/**
 * The label of the scale's value: "Not set" for none, a value or a range as numbers in `locale`,
 * with the unit once after them ("12,5 %").
 */
export const valueLabel = (
  props: ScaleProps,
  values: readonly number[] | undefined,
  locale: Locale,
  text: Say,
): string => {
  if (values === undefined) return text("scale.notSet");
  const numbers = values.map((value) => formatNumber(value, locale)).join(RANGE_SEPARATOR);
  return props.unit === undefined ? numbers : `${numbers} ${props.unit}`;
};

/** The labels of a rating's toggles, one per step from `min` to `max`, in `locale`. */
export const ratingLabels = (props: ScaleProps, locale: Locale): readonly string[] =>
  ratingValues(props).map((value) => formatNumber(value, locale));
