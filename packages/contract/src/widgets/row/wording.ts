// How a request's wording reads a Row's props (layouts, design decision 1), keyed
// `row.props.widths`. Nothing here validates.

import type { Segments } from "../../problems.ts";
import { LAYOUT_CHILD_FIELDS, LAYOUT_CHILD_ITEM, LAYOUT_CHILD_TYPE } from "../shared/layouts.ts";
import { ID_SHAPE } from "../wording-parts.ts";
import { ROW_MAX_ITEMS, ROW_MAX_WEIGHT, ROW_MIN_ITEMS, ROW_MIN_WEIGHT } from "./constants.ts";

export const ROW_EXPECTED: Readonly<Record<string, string>> = {
  "row.props": "a Row's props {items, widths?}",
  "row.props.items": `a list of ${ROW_MIN_ITEMS} to ${ROW_MAX_ITEMS} items to show side by side`,
  "row.props.items[]": LAYOUT_CHILD_ITEM,
  "row.props.items[].type": LAYOUT_CHILD_TYPE,
  "row.props.widths": `an object whose keys are the IDs of the Row's items and whose values are weights, each a whole number from ${ROW_MIN_WEIGHT} to ${ROW_MAX_WEIGHT}`,
  "row.props.widths.{item}": `a whole number from ${ROW_MIN_WEIGHT} to ${ROW_MAX_WEIGHT}, keyed by ${ID_SHAPE}`,
};

export const ROW_FIELDS: Readonly<Record<string, string>> = {
  "row.props": "a Row's props hold only items and widths",
  "row.props.items[]": LAYOUT_CHILD_FIELDS,
};

/** A map key of a Row's widths is `{item}`. */
export const rowRest = (rest: Segments): Segments =>
  rest[1] === "widths" && rest.length > 2
    ? [rest[0] as string, "widths", "{item}", ...rest.slice(3)]
    : rest;
