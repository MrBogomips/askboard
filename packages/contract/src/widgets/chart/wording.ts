// How a request's wording reads a Chart's props (chart-widget, design decision 1): the expected
// shape and the field list of each of its objects, keyed `chart.props.series[].values`, and which
// element a path is in. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  CHART_LABEL_MAX_CHARS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_SERIES,
  CHART_TITLE_MAX_CHARS,
  CHART_UNIT_MAX_CHARS,
  CHART_VALUE_LIMIT,
} from "./constants.ts";

const NUMBER = `a number from -${CHART_VALUE_LIMIT.toFixed(0)} to ${CHART_VALUE_LIMIT.toFixed(0)}`;

export const CHART_EXPECTED: Readonly<Record<string, string>> = {
  "chart.props":
    "a Chart's props {kind, categories, series, title?, valueLabel?, categoryLabel?, unit?, highlights?}",
  "chart.props.kind": '"bar", "line" or "pie"',
  "chart.props.categories": `a list of 1 to ${CHART_MAX_CATEGORIES} categories, each {id, label}`,
  "chart.props.categories[]": "a category {id, label}",
  "chart.props.categories[].id": `${ID_SHAPE}, unique among the Chart's categories`,
  "chart.props.categories[].label": text(CHART_LABEL_MAX_CHARS),
  "chart.props.series": `a list of 1 to ${CHART_MAX_SERIES} series, each {id, label, values}`,
  "chart.props.series[]": "a series {id, label, values}",
  "chart.props.series[].id": `${ID_SHAPE}, unique among the Chart's series`,
  "chart.props.series[].label": text(CHART_LABEL_MAX_CHARS),
  "chart.props.series[].values": `a list with one value per category, in the categories' order: ${NUMBER}, or null for none`,
  "chart.props.series[].values[]": `${NUMBER}, or null for none`,
  "chart.props.title": text(CHART_TITLE_MAX_CHARS),
  "chart.props.valueLabel": text(CHART_LABEL_MAX_CHARS),
  "chart.props.categoryLabel": text(CHART_LABEL_MAX_CHARS),
  "chart.props.unit": text(CHART_UNIT_MAX_CHARS),
  "chart.props.highlights":
    '"many", "one" or "none": how many points the user may highlight, many when absent; with "none" the chart is only read and gives no result',
};

export const CHART_FIELDS: Readonly<Record<string, string>> = {
  "chart.props":
    "a Chart's props hold only kind, categories, series, title, valueLabel, categoryLabel, unit and highlights",
  "chart.props.categories[]": "a category holds only id and label",
  "chart.props.series[]": "a series holds only id, label and values",
};

/** The element a path from a Chart item is in, by its ID, worded `category "q1"` or `series "cost"`. */
export const chartElementOf = (item: unknown, rest: Segments): string | undefined => {
  const list = rest[1];
  if (!isRecord(item) || (list !== "categories" && list !== "series") || !isIndex(rest[2])) {
    return undefined;
  }
  const elements = isRecord(item.props) ? item.props[list] : undefined;
  const element: unknown = Array.isArray(elements) ? elements[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string"
    ? `${list === "series" ? "series" : "category"} "${id}"`
    : undefined;
};
