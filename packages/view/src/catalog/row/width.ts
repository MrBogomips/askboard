// The Row's widths (layouts, design decision 7): each item's weight and the width the Row needs to
// sit side by side. Plain functions, tested without a DOM.

import { ROW_MAX_WEIGHT, ROW_MIN_WEIGHT, rowPropsProblems } from "@askboard/contract";
import { isRecord } from "../layouts/layout.ts";

/** The narrowest an item may be while the Row is side by side. */
export const ROW_MIN_ITEM_PX = 240;

// The weight of each item, in order: its entry in `widths` as an own property, else 1.
export const weightsOf = (itemId: string, props: unknown, ids: readonly string[]): number[] => {
  const problems = rowPropsProblems(props);
  if (problems.length > 0) {
    throw new Error(`the Row "${itemId}" refuses its props: ${problems[0]?.message}`);
  }
  const widths =
    isRecord(props) && Object.hasOwn(props, "widths") && isRecord(props.widths) ? props.widths : {};
  return ids.map((id) => {
    if (!Object.hasOwn(widths, id)) return 1;
    const weight = widths[id];
    if (
      !Number.isInteger(weight) ||
      (weight as number) < ROW_MIN_WEIGHT ||
      (weight as number) > ROW_MAX_WEIGHT
    ) {
      throw new Error(
        `the Row "${itemId}" holds a weight for "${id}" that is no whole number from 1 to 4`,
      );
    }
    return weight as number;
  });
};

/** The width the Row needs to sit side by side: its smallest item still gets the minimum. */
export const widthNeeded = (weights: readonly number[]): number =>
  (ROW_MIN_ITEM_PX * weights.reduce((sum, weight) => sum + weight, 0)) / Math.min(...weights);
