// What a Chart says aloud and under the plot (design decision 4; view-and-widgets spec: A Chart's
// points read aloud, Highlighting data points): pure text from the props, the ask's locale and the
// strings. The agent's own words go through `chartText`, so a control character shows as its
// escape and the chart library's markup is broken, as on the canvas.

import type { ChartPoint, ChartProps, Locale } from "@askboard/contract";
import { chartText, formatChartValue } from "./text.ts";

/** What the strings are asked for: `say(key, slots)` of the catalogue. */
export type ChartSay = (
  key: "chart.highlighted" | "chart.noPoints" | "chart.points",
  slots?: Readonly<Record<string, string | number>>,
) => string;

/** What a reading needs besides the point. */
export type ReadingContext = {
  readonly locale: Locale;
  readonly say: ChartSay;
  readonly highlighted?: boolean;
};

/**
 * "category, series: value unit", with ", highlighted" for a highlighted point; empty for a point
 * the props do not hold or that has no value.
 */
export const pointReading = (
  props: ChartProps,
  point: ChartPoint,
  { locale, say, highlighted = false }: ReadingContext,
): string => {
  const series = props.series.find(({ id }) => id === point.series);
  const index = props.categories.findIndex(({ id }) => id === point.category);
  const category = props.categories[index];
  const value = series?.values[index];
  if (series === undefined || category === undefined || typeof value !== "number") return "";
  const reading = `${chartText(category.label)}, ${chartText(series.label)}: ${formatChartValue(value, locale, props.unit)}`;
  return highlighted ? `${reading}, ${say("chart.highlighted")}` : reading;
};

/** The counter under the plot: no point, or how many are highlighted. */
export const counterText = (count: number, say: ChartSay): string =>
  count === 0 ? say("chart.noPoints") : say("chart.points", { count });
