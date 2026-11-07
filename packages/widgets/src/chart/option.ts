// The Chart's ECharts option (design decision 4): built from the checked props, the highlighted
// points, the theme's tokens, the ask's locale and the canvas's size, as data, so a test reads it
// without drawing. Pure; the component hands it to the library.
//
// Rules the tests hold it to: no animation; every `formatter` a function that builds AskBoard's own
// text (a string template would be substituted in a loop, and a value holding `{b}` read on a later
// pass); every agent string through `chartText` once; hover changes no colour (`emphasis` disabled),
// so only the tooltip and the cursor answer; the cursor is a pointer only where a click highlights.

import type { ChartPoint, ChartProps, Locale } from "@askboard/contract";
import {
  barLayout,
  type ChartBox,
  hasLegend,
  MARKER_SIZE,
  PIE_RADIUS_RATIO,
  plotRect,
  VALUE_LABEL_WIDTH,
  valueExtent,
} from "./layout.ts";
import { isHighlighted } from "./model.ts";
import { chartText, formatChartValue } from "./text.ts";

/** The tokens a chart reads, as the theme resolves them (DESIGN: Colors, Chart). */
export type ChartTokens = {
  /** `chart-1` to `chart-5`, in order. */
  readonly chart: readonly string[];
  readonly border: string;
  readonly mutedForeground: string;
  readonly popover: string;
  readonly popoverForeground: string;
  readonly change: string;
  readonly card: string;
  readonly fontSans: string;
  /** The badge type size, in pixels. */
  readonly badgeSize: number;
};

/** What the option is built from. */
export type ChartContext = {
  readonly props: ChartProps;
  /** The highlighted points: the held result's, or the shown one's. */
  readonly highlighted: readonly ChartPoint[];
  readonly tokens: ChartTokens;
  readonly locale: Locale;
  readonly box: ChartBox;
  /** The item may not change: a click highlights nothing and the cursor is the default. */
  readonly disabled: boolean;
};

/** The option, as plain data the library takes. */
export type ChartOption = Readonly<Record<string, unknown>>;

const RING_WIDTH = 2;
const BAR_RADIUS = 4;
const LEGEND_SWATCH = 12;
const LEGEND_TEXT_MIN = 48;
const LEGEND_TEXT_MAX = 160;

const colourOf = (tokens: ChartTokens, index: number): string =>
  tokens.chart[index] ?? tokens.chart[tokens.chart.length - 1] ?? tokens.mutedForeground;

const textStyle = ({ tokens }: ChartContext) => ({
  color: tokens.mutedForeground,
  fontSize: tokens.badgeSize,
  fontFamily: tokens.fontSans,
});

// A point's border: the change ring if it is highlighted, else the card's own (a slice's gap).
const borderOf = (context: ChartContext, point: ChartPoint, ring: string | undefined) =>
  isHighlighted(context.highlighted, point)
    ? { borderColor: context.tokens.change, borderWidth: RING_WIDTH }
    : {
        borderColor: ring ?? context.tokens.card,
        borderWidth: ring === undefined ? 0 : RING_WIDTH,
      };

const cursorOf = ({ props, disabled }: ChartContext): "pointer" | "default" =>
  props.highlights === "none" || disabled ? "default" : "pointer";

const pointOf = (props: ChartProps, series: number, category: number): ChartPoint => ({
  series: props.series[series]?.id ?? "",
  category: props.categories[category]?.id ?? "",
});

const barSeries = (context: ChartContext, gapPercent: string) =>
  context.props.series.map((series, at) => {
    const color = colourOf(context.tokens, at);
    return {
      type: "bar",
      name: chartText(series.label),
      cursor: cursorOf(context),
      barCategoryGap: "20%",
      barGap: gapPercent,
      itemStyle: { color },
      emphasis: { disabled: true },
      data: series.values.map((value, index) =>
        value === null
          ? null
          : {
              value,
              itemStyle: {
                color,
                borderRadius:
                  value < 0 ? [0, 0, BAR_RADIUS, BAR_RADIUS] : [BAR_RADIUS, BAR_RADIUS, 0, 0],
                ...borderOf(context, pointOf(context.props, at, index), undefined),
              },
            },
      ),
    };
  });

const lineSeries = (context: ChartContext) =>
  context.props.series.map((series, at) => {
    const color = colourOf(context.tokens, at);
    return {
      type: "line",
      name: chartText(series.label),
      cursor: cursorOf(context),
      symbol: "circle",
      symbolSize: MARKER_SIZE,
      connectNulls: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      emphasis: { disabled: true },
      data: series.values.map((value, index) =>
        value === null
          ? null
          : {
              value,
              itemStyle: {
                color,
                ...borderOf(context, pointOf(context.props, at, index), undefined),
              },
            },
      ),
    };
  });

const pieSeries = (context: ChartContext) => {
  const { props, tokens } = context;
  const series = props.series[0];
  return [
    {
      type: "pie",
      name: chartText(series?.label ?? ""),
      cursor: cursorOf(context),
      center: ["50%", "50%"],
      radius: [0, `${PIE_RADIUS_RATIO * 100}%`],
      startAngle: 90,
      clockwise: true,
      selectedMode: false,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: tokens.card, borderWidth: RING_WIDTH },
      emphasis: { disabled: true },
      label: {
        show: true,
        position: "outside",
        ...textStyle(context),
        formatter: (params: { dataIndex: number }) =>
          chartText(props.categories[params.dataIndex]?.label ?? ""),
      },
      labelLine: { lineStyle: { color: tokens.border } },
      data: (series?.values ?? []).map((value, index) => {
        const name = chartText(props.categories[index]?.label ?? "");
        const itemStyle = {
          color: colourOf(tokens, index),
          ...borderOf(context, pointOf(props, 0, index), tokens.card),
        };
        return value === null
          ? { name, value: 0, itemStyle, label: { show: false }, labelLine: { show: false } }
          : { name, value, itemStyle };
      }),
    },
  ];
};

// The tooltip's text, from the props by the event's two indexes alone: nothing the library read
// from the data (a name, a value) is shown, so nothing of it is parsed or substituted.
const tooltipText =
  ({ props, locale }: ChartContext) =>
  (params: { seriesIndex: number; dataIndex: number }): string => {
    const series = props.series[params.seriesIndex];
    const category = props.categories[params.dataIndex];
    const value = series?.values[params.dataIndex];
    if (series === undefined || category === undefined || typeof value !== "number") return "";
    return `${chartText(category.label)}\n${chartText(series.label)}: ${formatChartValue(value, locale, props.unit)}`;
  };

const tooltip = (context: ChartContext) => ({
  show: true,
  trigger: "item",
  renderMode: "richText",
  confine: true,
  backgroundColor: context.tokens.popover,
  borderColor: context.tokens.border,
  borderWidth: 1,
  padding: [6, 8],
  textStyle: {
    color: context.tokens.popoverForeground,
    fontSize: context.tokens.badgeSize,
    fontFamily: context.tokens.fontSans,
  },
  formatter: tooltipText(context),
});

const legend = (context: ChartContext, left: number) => {
  const { props, box } = context;
  const room = (box.width - left) / props.series.length - LEGEND_SWATCH - 24;
  return {
    show: true,
    type: "plain",
    orient: "horizontal",
    left,
    top: 4,
    icon: "roundRect",
    itemWidth: LEGEND_SWATCH,
    itemHeight: LEGEND_SWATCH,
    itemGap: 12,
    selectedMode: false,
    data: props.series.map((series) => ({ name: chartText(series.label) })),
    textStyle: {
      ...textStyle(context),
      width: Math.round(Math.min(LEGEND_TEXT_MAX, Math.max(LEGEND_TEXT_MIN, room))),
      overflow: "truncate",
    },
  };
};

const axisName = (
  label: string | undefined,
  extra: Record<string, unknown>,
  context: ChartContext,
) =>
  label === undefined
    ? {}
    : { name: chartText(label), nameTextStyle: textStyle(context), ...extra };

const axes = (context: ChartContext) => {
  const { props, tokens, locale, box } = context;
  const plot = plotRect(props, box);
  const { band } = barLayout(props, plot);
  const { min, max, interval } = valueExtent(props);
  return {
    grid: { left: plot.x, top: plot.y, width: plot.width, height: plot.height },
    xAxis: {
      type: "category",
      boundaryGap: true,
      data: props.categories.map((category) => chartText(category.label)),
      axisLine: { lineStyle: { color: tokens.border } },
      axisTick: { show: false },
      axisLabel: {
        ...textStyle(context),
        hideOverlap: true,
        width: Math.max(24, Math.floor(band) - 8),
        overflow: "truncate",
      },
      ...axisName(props.categoryLabel, { nameLocation: "middle", nameGap: 32 }, context),
    },
    yAxis: {
      type: "value",
      min,
      max,
      interval,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens.border } },
      axisLabel: {
        ...textStyle(context),
        width: VALUE_LABEL_WIDTH,
        overflow: "truncate",
        formatter: (value: number) => formatChartValue(value, locale, props.unit),
      },
      ...axisName(
        props.valueLabel,
        { nameLocation: "end", nameTextStyle: { ...textStyle(context), align: "left" } },
        context,
      ),
    },
  };
};

/** The option for a Chart, drawn on a canvas of `context.box`. */
export const chartOption = (context: ChartContext): ChartOption => {
  const { props, tokens } = context;
  const base = {
    animation: false,
    color: [...tokens.chart],
    textStyle: { fontFamily: tokens.fontSans },
    tooltip: tooltip(context),
  };
  if (props.kind === "pie") return { ...base, series: pieSeries(context) };
  const plot = plotRect(props, context.box);
  const { barWidth, gap } = barLayout(props, plot);
  const gapPercent = `${barWidth > 0 ? (gap / barWidth) * 100 : 0}%`;
  return {
    ...base,
    ...axes(context),
    ...(hasLegend(props) ? { legend: legend(context, plot.x) } : {}),
    series: props.kind === "bar" ? barSeries(context, gapPercent) : lineSeries(context),
  };
};
