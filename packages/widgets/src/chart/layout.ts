// The Chart's layout (design decision 4): the grid, the value axis and where each point lies, in
// pure functions of the props and the box the canvas fills. The option sets exactly these numbers
// (fixed insets, an explicit value extent and bar gaps), so a test can click a point by position
// and read what it hit. No DOM, no chart library.

import type { ChartPoint, ChartProps } from "@askboard/contract";

/** The plot is 320px high and as wide as the widget frame (DESIGN, Chart). */
export const PLOT_HEIGHT = 320;
/** Bars of a category are 2px apart. */
export const BAR_GAP_PX = 2;
/** A fifth of a category's band is left between categories. */
export const CATEGORY_GAP_RATIO = 0.2;
/** A marker is 8px across. */
export const MARKER_SIZE = 8;
/** A pie's outer radius, as a share of half the box's shorter side. */
export const PIE_RADIUS_RATIO = 0.6;

export const GRID_LEFT = 80;
export const VALUE_LABEL_WIDTH = 64;
export const GRID_RIGHT = 16;
export const TOP_PAD = 8;
export const LEGEND_ROW = 28;
export const NAME_ROW = 20;
export const AXIS_LABEL_ROW = 28;

/** The canvas's size in pixels. */
export type ChartBox = { readonly width: number; readonly height: number };

/** A rectangle in the canvas's pixels. */
export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** The legend names the series of a bar or line chart of two or more. */
export const hasLegend = (props: ChartProps): boolean =>
  props.kind !== "pie" && props.series.length >= 2;

/** The plot: the whole canvas for a pie, else the grid inside the labels, legend and names. */
export const plotRect = (props: ChartProps, box: ChartBox): Rect => {
  if (props.kind === "pie") return { x: 0, y: 0, width: box.width, height: box.height };
  const top =
    TOP_PAD + (hasLegend(props) ? LEGEND_ROW : 0) + (props.valueLabel === undefined ? 0 : NAME_ROW);
  const bottom = AXIS_LABEL_ROW + (props.categoryLabel === undefined ? 0 : NAME_ROW);
  return {
    x: GRID_LEFT,
    y: top,
    width: Math.max(1, box.width - GRID_LEFT - GRID_RIGHT),
    height: Math.max(1, box.height - top - bottom),
  };
};

/** The value axis: its bounds and the step between ticks. */
export type ValueExtent = { readonly min: number; readonly max: number; readonly interval: number };

// Twelve significant digits keep a product of round numbers round.
const clean = (value: number): number => Number(value.toPrecision(12));

const niceStep = (raw: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / magnitude;
  const nice = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return clean(nice * magnitude);
};

const EPSILON = 1e-9;

/**
 * The value axis of a bar or line chart: it holds zero and every value, starts at zero unless a
 * value is negative, and ends on a round step above the highest value (one past it, so that no bar
 * touches the top), five or so steps in all.
 */
export const valueExtent = (props: ChartProps): ValueExtent => {
  const numbers = props.series.flatMap(({ values }) =>
    values.filter((value): value is number => typeof value === "number"),
  );
  const lowest = Math.min(0, ...numbers);
  const highest = Math.max(0, ...numbers);
  if (lowest === 0 && highest === 0) return { min: 0, max: 1, interval: 0.2 };
  const interval = niceStep((highest - lowest) / 5);
  const max = highest > 0 ? (Math.floor(highest / interval + EPSILON) + 1) * interval : 0;
  const min = lowest < 0 ? (Math.ceil(lowest / interval - EPSILON) - 1) * interval : 0;
  return { min: clean(min), max: clean(max), interval };
};

/** The bars of a category: its band, each bar's width and the pixels between bars. */
export type BarLayout = { readonly band: number; readonly barWidth: number; readonly gap: number };

/** How the chart library lays out `props.series.length` bars in each of the categories' bands. */
export const barLayout = (props: ChartProps, plot: Rect): BarLayout => {
  const band = plot.width / props.categories.length;
  const series = props.series.length;
  const room = band * (1 - CATEGORY_GAP_RATIO) - (series - 1) * BAR_GAP_PX;
  return { band, barWidth: Math.max(0, room / series), gap: BAR_GAP_PX };
};

const indexOfId = (list: readonly { readonly id: string }[], id: string): number =>
  list.findIndex((each) => each.id === id);

const pieCentre = (props: ChartProps, category: number, box: ChartBox) => {
  const values = props.series[0]?.values ?? [];
  const slices = values.map((value) => (typeof value === "number" ? value : 0));
  const total = slices.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return undefined;
  const before = slices.slice(0, category).reduce((sum, value) => sum + value, 0);
  const turn = ((before + (slices[category] ?? 0) / 2) / total) * 2 * Math.PI;
  const radius = PIE_RADIUS_RATIO * (Math.min(box.width, box.height) / 2) * 0.6;
  return {
    x: box.width / 2 + radius * Math.sin(turn),
    y: box.height / 2 - radius * Math.cos(turn),
  };
};

/**
 * Where a point lies in the canvas, for a test to click: the middle of a bar, a line's marker, the
 * middle of a pie slice. Undefined for a point the props do not hold or that has no value.
 */
export const pointCentre = (
  props: ChartProps,
  point: ChartPoint,
  box: ChartBox,
): { readonly x: number; readonly y: number } | undefined => {
  const j = indexOfId(props.series, point.series);
  const i = indexOfId(props.categories, point.category);
  const value = props.series[j]?.values[i];
  if (typeof value !== "number") return undefined;
  if (props.kind === "pie") return pieCentre(props, i, box);
  const plot = plotRect(props, box);
  const { min, max } = valueExtent(props);
  const yOf = (at: number) => plot.y + (plot.height * (max - at)) / (max - min);
  const { band, barWidth, gap } = barLayout(props, plot);
  if (props.kind === "line") return { x: plot.x + band * (i + 0.5), y: yOf(value) };
  const group = props.series.length * barWidth + (props.series.length - 1) * gap;
  const left = plot.x + band * i + (band - group) / 2 + j * (barWidth + gap);
  return { x: left + barWidth / 2, y: (yOf(0) + yOf(value)) / 2 };
};
