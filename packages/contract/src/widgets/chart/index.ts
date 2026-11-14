// The Chart (FR-11, chart-widget): a bar, line or pie chart whose highlighted data points are the
// result. Its schemas are standalone: they belong to no schema set until the entry is registered
// (design decision 10), and nothing compiles them when this module loads.

export { chartPropsProblems, chartResultProblems, chartResultShape } from "./checks.ts";
export {
  CHART_HIGHLIGHTS,
  CHART_KINDS,
  CHART_LABEL_MAX_CHARS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_POINTS,
  CHART_MAX_SERIES,
  CHART_PIE_MAX_SLICES,
  CHART_SCHEMA_IDS,
  CHART_TITLE_MAX_CHARS,
  CHART_UNIT_MAX_CHARS,
  CHART_VALUE_LIMIT,
  type ChartCategory,
  type ChartHighlights,
  type ChartItem,
  type ChartKind,
  type ChartPoint,
  type ChartProps,
  type ChartResult,
  type ChartSeries,
} from "./constants.ts";
export { CHART_KEYS, type ChartKeyAction } from "./keys.ts";
export { CHART_WIDGET } from "./widget.ts";
