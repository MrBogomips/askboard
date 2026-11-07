// Where a Chart's points lie on its canvas, and whether one wears the ring (chart-widget, task
// 5.1). The canvas is pixels, so a browser test clicks a position and reads colours. The position
// of a bar is worked out here from the layout `option.ts` sets (fixed insets, a legend row above
// two or more series, a value axis from zero to a round maximum the test names): a view test may
// not import the widgets' own layout (AD-1), and an independent working-out also checks what the
// chart really draws. Not a test file.

import type { Locator } from "playwright";

const GRID_LEFT = 80;
const GRID_RIGHT = 16;
const TOP_PAD = 8;
const LEGEND_ROW = 28;
const AXIS_LABEL_ROW = 28;
const GAP = 2;
const CATEGORY_GAP_RATIO = 0.2;

export type BarChart = {
  readonly categories: number;
  readonly series: number;
  /** The value axis' top, which the axis' round step puts above the highest value. */
  readonly axisMax: number;
};

/** Where a bar's centre is in the chart's box, for the value at (`series`, `category`). */
export const barCentre = (
  chart: BarChart,
  box: { readonly width: number; readonly height: number },
  at: { readonly series: number; readonly category: number; readonly value: number },
): { readonly x: number; readonly y: number } => {
  const legend = chart.series >= 2 ? LEGEND_ROW : 0;
  const top = TOP_PAD + legend;
  const plot = {
    width: box.width - GRID_LEFT - GRID_RIGHT,
    height: box.height - top - AXIS_LABEL_ROW,
  };
  const band = plot.width / chart.categories;
  const barWidth = (band * (1 - CATEGORY_GAP_RATIO) - (chart.series - 1) * GAP) / chart.series;
  const group = chart.series * barWidth + (chart.series - 1) * GAP;
  const left = GRID_LEFT + band * at.category + (band - group) / 2 + at.series * (barWidth + GAP);
  const yOf = (value: number) => top + (plot.height * (chart.axisMax - value)) / chart.axisMax;
  return { x: left + barWidth / 2, y: (yOf(0) + yOf(at.value)) / 2 };
};

/** The Chart's box in page coordinates, once scrolled into view. */
export const boxOf = async (chart: Locator) => {
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (box === null) throw new Error("the chart has no box");
  return box;
};

/** Clicks a position inside the chart's box. */
export const clickAt = async (
  chart: Locator,
  at: { readonly x: number; readonly y: number },
): Promise<void> => {
  const box = await boxOf(chart);
  await chart.page().mouse.click(box.x + at.x, box.y + at.y);
};

/** A bar's width in the chart's box. */
export const barWidthOf = (chart: BarChart, box: { readonly width: number }): number => {
  const band = (box.width - GRID_LEFT - GRID_RIGHT) / chart.categories;
  return (band * (1 - CATEGORY_GAP_RATIO) - (chart.series - 1) * GAP) / chart.series;
};

// Whether a pixel of the row at `y`, within `half` of `x`, is the `--change` colour: it runs in the
// view, on the chart's element.
const changeColourAt = (
  element: Element,
  [x, y, half]: readonly [number, number, number],
): boolean => {
  const canvas = element.querySelector("canvas");
  if (canvas === null) return false;
  const root = element.ownerDocument.documentElement;
  const value = getComputedStyle(root).getPropertyValue("--change").trim();
  const [, r = "", g = "", b = ""] =
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value) ?? [];
  const want = [r, g, b].map((hex) => Number.parseInt(hex, 16));
  const context = canvas.getContext("2d");
  if (context === null || want.some(Number.isNaN)) return false;
  const ratio = canvas.width / canvas.getBoundingClientRect().width;
  const left = Math.max(0, Math.floor((x - half) * ratio));
  const width = Math.ceil(2 * half * ratio);
  const { data } = context.getImageData(left, Math.floor(y * ratio), width, 1);
  for (let at = 0; at < data.length; at += 4) {
    if (want.every((channel, index) => Math.abs((data[at + index] ?? 0) - channel) <= 12)) {
      return true;
    }
  }
  return false;
};

/**
 * Whether the bar centred at `centre`, `width` wide, wears the `change` ring: some pixel of its
 * row, within 3px of either vertical edge, is that colour.
 */
export const wearsRing = async (
  chart: Locator,
  centre: { readonly x: number; readonly y: number },
  width: number,
): Promise<boolean> => {
  for (const edge of [centre.x - width / 2, centre.x + width / 2]) {
    if (await chart.evaluate(changeColourAt, [edge, centre.y, 3] as const)) return true;
  }
  return false;
};
