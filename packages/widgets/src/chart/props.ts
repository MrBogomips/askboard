// A Chart's props as the component takes them (design decision 4): the view hands props over as
// data, unchecked, so the shape the schema would give is checked here, then the contract's own
// checks of what a schema cannot say. A problem throws, naming the item; the item's error boundary
// then fails it and its question never counts as visible (AD-10).

import {
  CHART_HIGHLIGHTS,
  CHART_KINDS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_SERIES,
  CHART_VALUE_LIMIT,
  type ChartProps,
  chartPropsProblems,
} from "@askboard/contract";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): boolean => typeof value === "string";

const optional = (value: unknown, ok: (value: unknown) => boolean): boolean =>
  value === undefined || ok(value);

const isValue = (value: unknown): boolean =>
  value === null ||
  (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= CHART_VALUE_LIMIT);

const listOf = (value: unknown, max: number): readonly unknown[] | undefined =>
  Array.isArray(value) && value.length >= 1 && value.length <= max ? value : undefined;

const oneOf = (list: readonly string[], value: unknown): boolean =>
  typeof value === "string" && list.includes(value);

const categoryProblem = (category: unknown): boolean =>
  !isRecord(category) || !text(category.id) || !text(category.label);

const seriesProblem = (series: unknown): boolean =>
  !isRecord(series) ||
  !text(series.id) ||
  !text(series.label) ||
  !Array.isArray(series.values) ||
  !series.values.every(isValue);

// What the schema says of the fields: a kind of the three, 1 to 100 categories and 1 to 5 series
// of the right fields, values numbers within the limit or null, the optional texts texts, the
// highlights one of the three.
const shapeProblem = (props: unknown): string | undefined => {
  if (!isRecord(props)) return "its props are no object";
  if (!oneOf(CHART_KINDS, props.kind)) return "kind is not bar, line or pie";
  const categories = listOf(props.categories, CHART_MAX_CATEGORIES);
  if (categories === undefined) {
    return `categories is not a list of 1 to ${CHART_MAX_CATEGORIES}`;
  }
  const series = listOf(props.series, CHART_MAX_SERIES);
  if (series === undefined) return `series is not a list of 1 to ${CHART_MAX_SERIES}`;
  if (categories.some(categoryProblem)) return "a category is no ID and label";
  if (series.some(seriesProblem)) return "a series is no ID, label and list of numbers or nulls";
  const wrong = (
    [
      ["title", optional(props.title, text)],
      ["valueLabel", optional(props.valueLabel, text)],
      ["categoryLabel", optional(props.categoryLabel, text)],
      ["unit", optional(props.unit, text)],
      ["highlights", optional(props.highlights, (value) => oneOf(CHART_HIGHLIGHTS, value))],
    ] as const
  ).find(([, ok]) => !ok);
  return wrong === undefined ? undefined : `${wrong[0]} is of the wrong type`;
};

/** The props as an agent's Chart, or an error naming the item and each problem. */
export const checkedChartProps = (itemId: string, props: unknown): ChartProps => {
  const shape = shapeProblem(props);
  const problems =
    shape === undefined
      ? chartPropsProblems(props).map(({ path, message }) => `${path}: ${message}`)
      : [shape];
  if (problems.length === 0) return props as ChartProps;
  throw new Error(`the Chart "${itemId}" refuses its props: ${problems.join("; ")}`);
};
