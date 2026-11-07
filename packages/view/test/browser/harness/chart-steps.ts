// Steps the Chart's browser files share (chart-widget, group 6): the chart, its counter and live
// region of a board, the point a test clicks or reads by series and category, and the ring on it.
// Positions come from `chart-points.ts`. Not a test file.

import { eventually } from "./board-test.ts";
import {
  type BarChart,
  barCentre,
  barWidthOf,
  boxOf,
  clickAt,
  markerCentre,
  sliceCentre,
  wearsRing,
} from "./chart-points.ts";
import type { Board } from "./dom.ts";

export const chartOf = (board: Board, nth = 0) => board.view.locator("[data-chart]").nth(nth);
export const counterOf = (board: Board, nth = 0) =>
  board.view.locator("[data-chart-counter]").nth(nth);
export const liveOf = (board: Board, nth = 0) => board.view.locator("[data-chart-live]").nth(nth);

export const counterIs = (board: Board, text: string, nth = 0) =>
  eventually(
    async () => (await counterOf(board, nth).textContent()) === text,
    `the counter "${text}"`,
  );

export const liveIs = (board: Board, text: string, nth = 0) =>
  eventually(
    async () => (await liveOf(board, nth).textContent()) === text,
    `the live region "${text}"`,
  );

/** A bar chart as a test knows it: its layout and the value of each series at each category. */
export type BarRig = {
  readonly layout: BarChart;
  readonly values: readonly (readonly (number | null)[])[];
};

/** The bar's centre in the chart's box, and the box. */
export const barOf = async (
  board: Board,
  rig: BarRig,
  series: number,
  category: number,
  nth = 0,
) => {
  const box = await boxOf(chartOf(board, nth));
  const value = rig.values[series]?.[category];
  if (typeof value !== "number") throw new Error("the point has no value");
  return { box, centre: barCentre(rig.layout, box, { series, category, value }) };
};

export const clickBar = async (
  board: Board,
  rig: BarRig,
  series: number,
  category: number,
  nth = 0,
): Promise<void> => {
  const { centre } = await barOf(board, rig, series, category, nth);
  await clickAt(chartOf(board, nth), centre);
};

export const ringOfBar = async (
  board: Board,
  rig: BarRig,
  series: number,
  category: number,
  nth = 0,
): Promise<boolean> => {
  const { box, centre } = await barOf(board, rig, series, category, nth);
  return wearsRing(chartOf(board, nth), centre, barWidthOf(rig.layout, box));
};

/** A line chart's marker centre for the value at `category`. */
export const markerOf = async (
  board: Board,
  rig: BarRig,
  category: number,
  value: number,
  nth = 0,
) => markerCentre(rig.layout, await boxOf(chartOf(board, nth)), { category, value });

/** A pie slice's centre. */
export const sliceOf = async (board: Board, slices: readonly number[], index: number, nth = 0) =>
  sliceCentre(await boxOf(chartOf(board, nth)), slices, index);
