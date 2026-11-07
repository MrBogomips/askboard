// The Chart's constants and types (chart-widget, design decision 1): the limits of its props and
// result, the schemas' IDs and the shapes of an item and its result. Each frozen constant is marked
// pure, so that a view chunk drops those it does not use.

export const CHART_KINDS = /* @__PURE__ */ Object.freeze(["bar", "line", "pie"] as const);
export const CHART_HIGHLIGHTS = /* @__PURE__ */ Object.freeze(["many", "one", "none"] as const);

/** A chart holds 1 to this many categories. */
export const CHART_MAX_CATEGORIES = 100;
/** A chart holds 1 to this many series: one palette slot each, never cycled. */
export const CHART_MAX_SERIES = 5;
/** A pie holds at most this many slices. */
export const CHART_PIE_MAX_SLICES = 5;
/** A value lies within this many either way. */
export const CHART_VALUE_LIMIT = 1e15;
/** A result holds 1 to this many points: every number of a chart of 5 series by 100 categories. */
export const CHART_MAX_POINTS = 500;
export const CHART_LABEL_MAX_CHARS = 60;
export const CHART_TITLE_MAX_CHARS = 120;
export const CHART_UNIT_MAX_CHARS = 20;

export const CHART_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:chart-props",
  result: "urn:askboard:output:chart-result",
} as const);

export type ChartKind = (typeof CHART_KINDS)[number];
export type ChartHighlights = (typeof CHART_HIGHLIGHTS)[number];

export type ChartCategory = { readonly id: string; readonly label: string };

/** One series: a number, or `null` for a gap, per category, in the categories' order. */
export type ChartSeries = {
  readonly id: string;
  readonly label: string;
  readonly values: readonly (number | null)[];
};

export type ChartProps = {
  readonly kind: ChartKind;
  readonly categories: readonly ChartCategory[];
  readonly series: readonly ChartSeries[];
  readonly title?: string;
  readonly valueLabel?: string;
  readonly categoryLabel?: string;
  readonly unit?: string;
  readonly highlights?: ChartHighlights;
};

export type ChartItem = {
  readonly type: "chart";
  readonly id: string;
  readonly props: ChartProps;
};

/** One highlighted data point: the series and the category it lies at. */
export type ChartPoint = { readonly series: string; readonly category: string };

/** A Chart's result: the points the user highlighted. */
export type ChartResult = { readonly points: readonly ChartPoint[] };
