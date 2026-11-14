// The Chart's model (design decision 4): which points hold a number, what a click or a key does to
// the highlighted points, and the result they make. Pure, over the checked props; points are named
// by the IDs of their series and category, as the result names them, and every lookup goes through
// a `Map`, so an inherited name (`__proto__`, `constructor`) is an ID like any other.

import type {
  ChartHighlights,
  ChartPoint,
  ChartProps,
  ChartResult,
  KeyPress,
} from "@askboard/contract";

const holdsNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The point at a series' and a category's position, if both exist and hold a number there. */
export const pointAt = (
  props: ChartProps,
  seriesIndex: number,
  categoryIndex: number,
): ChartPoint | undefined => {
  if (!Number.isInteger(seriesIndex) || !Number.isInteger(categoryIndex)) return undefined;
  const series = props.series[seriesIndex];
  const category = props.categories[categoryIndex];
  if (series === undefined || category === undefined) return undefined;
  return holdsNumber(series.values[categoryIndex])
    ? { series: series.id, category: category.id }
    : undefined;
};

/** The points holding a number, series then category order; a pie's are its slices. */
export const pointsOf = (props: ChartProps): readonly ChartPoint[] =>
  props.series.flatMap((_, at) =>
    props.categories.flatMap((_, index) => pointAt(props, at, index) ?? []),
  );

/** The first point holding a number, which a focused chart makes current. */
export const firstPoint = (props: ChartProps): ChartPoint | undefined => pointsOf(props)[0];

const same = (a: ChartPoint, b: ChartPoint): boolean =>
  a.series === b.series && a.category === b.category;

/** Whether `point` is among the highlighted ones. */
export const isHighlighted = (points: readonly ChartPoint[], point: ChartPoint): boolean =>
  points.some((each) => same(each, point));

/**
 * The points a held or shown result names, in its order; none for no result or one of another
 * shape (the shell already holds only results the props accept).
 */
export const highlightedPoints = (result: unknown): readonly ChartPoint[] => {
  if (typeof result !== "object" || result === null || !("points" in result)) return [];
  const { points } = result;
  if (!Array.isArray(points)) return [];
  return points.flatMap((point: unknown) =>
    typeof point === "object" &&
    point !== null &&
    "series" in point &&
    "category" in point &&
    typeof point.series === "string" &&
    typeof point.category === "string"
      ? [{ series: point.series, category: point.category }]
      : [],
  );
};

/**
 * The highlighted points after a click or a key on `point`: it is added or, if highlighted,
 * removed; `one` holds it alone; `none` changes nothing. The list given is never changed.
 */
export const toggle = (
  points: readonly ChartPoint[],
  point: ChartPoint,
  highlights: ChartHighlights | undefined,
): readonly ChartPoint[] => {
  if (highlights === "none") return points;
  if (isHighlighted(points, point)) return points.filter((each) => !same(each, point));
  return highlights === "one" ? [point] : [...points, point];
};

/**
 * The result of the highlighted points: those the props hold with a number, each once, series then
 * category order whatever the order they were clicked in; undefined while there are none.
 */
export const resultOf = (
  points: readonly ChartPoint[],
  props: ChartProps,
): ChartResult | undefined => {
  const named = points.map(({ series, category }) => `${series}\u0000${category}`);
  const held = new Set(named);
  const ordered = pointsOf(props).filter(({ series, category }) =>
    held.has(`${series}\u0000${category}`),
  );
  return ordered.length === 0 ? undefined : { points: ordered };
};

/** The keys a focused chart moves its current point by. */
export const CHART_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
] as const;
export type ChartKey = (typeof CHART_KEYS)[number];

/** Whether a `KeyboardEvent.key` is one a chart moves by. */
export const isChartKey = (key: string): key is ChartKey =>
  (CHART_KEYS as readonly string[]).includes(key);

/** What a press does on a focused chart: moves the current point, or highlights it. */
export type ChartKeyAction =
  | { readonly kind: "move"; readonly key: ChartKey }
  | { readonly kind: "highlight" };

/**
 * What a press does, or undefined when it is the browser's (keyboard-shortcuts-help, design
 * decision 7): the six keys move the current point and Space or Enter highlight it, each held with
 * no modifier and outside composition, and nothing else, whose default stays.
 */
export const chartKeyAction = (press: KeyPress): ChartKeyAction | undefined => {
  if (press.hold !== "none" || press.composing) return undefined;
  if (isChartKey(press.key)) return { kind: "move", key: press.key };
  return press.key === " " || press.key === "Enter" ? { kind: "highlight" } : undefined;
};

type Place = { readonly series: number; readonly category: number };

// The position of a point holding a number, by its IDs; undefined for any other.
const placeOf = (props: ChartProps, point: ChartPoint | undefined): Place | undefined => {
  if (point === undefined) return undefined;
  const series = props.series.findIndex(({ id }) => id === point.series);
  const category = props.categories.findIndex(({ id }) => id === point.category);
  return pointAt(props, series, category) === undefined ? undefined : { series, category };
};

// From `from`, the next position by `step` along one axis holding a number, else `from`.
const stepped = (props: ChartProps, from: Place, axis: keyof Place, step: 1 | -1): Place => {
  const limit = axis === "series" ? props.series.length : props.categories.length;
  for (let at = from[axis] + step; at >= 0 && at < limit; at += step) {
    const place = { ...from, [axis]: at };
    if (pointAt(props, place.series, place.category) !== undefined) return place;
  }
  return from;
};

const KEY_STEP: Record<"ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown", 1 | -1> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/**
 * The current point after `key`: Left and Right along the series' categories, Up and Down across
 * the category's series, Home and End to the first and last point, a gap skipped and the ends held;
 * a pie moves along its slices with all four arrows. From no current point, or one the props do
 * not hold, it is the first point.
 */
export const move = (
  current: ChartPoint | undefined,
  key: ChartKey,
  props: ChartProps,
): ChartPoint | undefined => {
  const all = pointsOf(props);
  const from = placeOf(props, current);
  if (from === undefined || key === "Home") return all[0];
  if (key === "End") return all.at(-1);
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const axis = horizontal || props.kind === "pie" ? "category" : "series";
  const to = stepped(props, from, axis, KEY_STEP[key]);
  return pointAt(props, to.series, to.category);
};
