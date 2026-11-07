// The Chart's rules that its schemas cannot say (chart-widget, design decision 1): the category IDs
// unique and the series IDs unique within the item, one value per category in every series, at
// least one number, and what a pie takes.
//
// Plain ECMAScript with no JSON and no Ajv: the chart chunk bundles it. Nothing here throws on a
// value it cannot read: the props check gives no problem for what the schema refuses (AD-10). IDs
// are compared through a `Set`, so a name every object inherits (`__proto__`, `constructor`) is an
// ID like any other.

import { ID_PATTERN } from "../../constants.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { CHART_MAX_POINTS, CHART_PIE_MAX_SLICES } from "./constants.ts";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// The elements of a list the props hold, or none when they hold no list.
const listOf = (props: Record<string, unknown>, key: string): readonly unknown[] =>
  Array.isArray(props[key]) ? (props[key] as unknown[]) : [];

// An ID as a message shows it: quoted, and cut where the schema would have refused it.
const quoted = (id: unknown): string => JSON.stringify(String(id).slice(0, 64));

// One problem for every element whose ID an earlier element of the list already holds.
const repeatedIds = (
  elements: readonly unknown[],
  list: "categories" | "series",
  noun: "category" | "series",
): Problem[] => {
  const seen = new Set<string>();
  const problems: Problem[] = [];
  elements.forEach((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    if (typeof id !== "string") return;
    if (seen.has(id)) {
      problems.push({
        path: `/${list}/${index}/id`,
        message: `the ID ${quoted(id)} is held twice: each ${noun} of a Chart has an ID of its own`,
      });
    }
    seen.add(id);
  });
  return problems;
};

// The values of a series the check can read, in order, with the series' position; a series whose
// `values` is no list has none.
const valuesOf = (series: unknown): readonly unknown[] =>
  isRecord(series) && Array.isArray(series.values) ? (series.values as unknown[]) : [];

// A series whose values are as many as the categories: one problem for each that is not.
const lengthProblems = (series: readonly unknown[], categories: number): Problem[] =>
  series.flatMap((one, index) => {
    if (!isRecord(one) || !Array.isArray(one.values) || one.values.length === categories) return [];
    const name = typeof one.id === "string" ? `series ${quoted(one.id)}` : `series ${index + 1}`;
    const values = one.values.length === 1 ? "1 value" : `${one.values.length} values`;
    const held = categories === 1 ? "1 category" : `${categories} categories`;
    return [
      {
        path: `/series/${index}/values`,
        message: `${name} holds ${values} for ${held}: each series holds one value per category, in the categories' order, null for none`,
      },
    ];
  });

// What a pie takes beyond the others: one series, at most 5 slices, no negative value, a value
// above 0 (when the chart holds a number at all) and no axis labels.
const pieProblems = (
  props: Record<string, unknown>,
  categories: readonly unknown[],
  series: readonly unknown[],
  numbers: readonly number[],
): Problem[] => {
  const problems: Problem[] = [];
  if (categories.length > CHART_PIE_MAX_SLICES) {
    problems.push({
      path: "/categories",
      message: `a pie takes at most ${CHART_PIE_MAX_SLICES} categories, one slice each, and this one has ${categories.length}`,
    });
  }
  if (series.length > 1) {
    problems.push({
      path: "/series",
      message: `a pie takes one series, and this one has ${series.length}`,
    });
  }
  series.forEach((one, at) => {
    valuesOf(one).forEach((value, index) => {
      if (finite(value) && value < 0) {
        problems.push({
          path: `/series/${at}/values/${index}`,
          message: `a pie takes no negative value, and this one is ${value}`,
        });
      }
    });
  });
  if (numbers.length > 0 && !numbers.some((value) => value > 0)) {
    problems.push({
      path: series.length > 1 ? "/series" : "/series/0/values",
      message: "a pie takes at least one value above 0",
    });
  }
  for (const key of ["valueLabel", "categoryLabel"] as const) {
    if (props[key] !== undefined) {
      problems.push({ path: `/${key}`, message: `a pie takes no ${key}: it has no axes` });
    }
  }
  return problems;
};

/**
 * What a schema-valid Chart's props still get wrong: a category or series ID held twice, a series
 * without one value per category, a chart without a number, and a pie with more than one series or
 * 5 slices, a negative value, no value above 0, or an axis label. A value the schema refuses gives
 * nothing here: the schema's problem stands.
 */
export const chartPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) return [];
  const categories = listOf(props, "categories");
  const series = listOf(props, "series");
  const numbers = series.flatMap((one) => valuesOf(one).filter(finite));
  const pie = props.kind === "pie";
  const problems: Problem[] = [
    ...repeatedIds(categories, "categories", "category"),
    ...repeatedIds(series, "series", "series"),
    ...lengthProblems(series, categories.length),
  ];
  if (pie) problems.push(...pieProblems(props, categories, series, numbers));
  if (series.length > 0 && categories.length > 0 && numbers.length === 0) {
    problems.push({
      path: "/series",
      message: "a chart holds at least one number: every value is null",
    });
  }
  return problems;
};

// The props a result is checked against: each series' values by its ID and each category's position
// by its ID, the first of an ID held twice standing; undefined when the props hold no lists of
// categories and series. Maps, so that an inherited name is no more an ID than any other.
type Reading = {
  readonly values: ReadonlyMap<string, readonly unknown[]>;
  readonly positions: ReadonlyMap<string, number>;
  readonly highlights: unknown;
};

const reading = (props: unknown): Reading | undefined => {
  if (!isRecord(props) || !Array.isArray(props.categories) || !Array.isArray(props.series)) {
    return undefined;
  }
  const positions = new Map<string, number>();
  props.categories.forEach((category: unknown, index) => {
    const id = isRecord(category) ? category.id : undefined;
    if (typeof id === "string" && !positions.has(id)) positions.set(id, index);
  });
  const values = new Map<string, readonly unknown[]>();
  for (const series of props.series as unknown[]) {
    const id = isRecord(series) ? series.id : undefined;
    if (typeof id === "string" && !values.has(id)) values.set(id, valuesOf(series));
  }
  return { values, positions, highlights: props.highlights };
};

// A point as a message shows it.
const pointText = (series: unknown, category: unknown): string =>
  `(series ${quoted(series)}, category ${quoted(category)})`;

// The problems of one point of a result, `seen` holding the points before it.
const pointProblems = (
  point: unknown,
  index: number,
  read: Reading,
  seen: Set<string>,
): Problem[] => {
  if (!isRecord(point)) return [];
  const { series, category } = point;
  if (typeof series !== "string" || typeof category !== "string") return [];
  const at = (field: string, message: string): Problem => ({
    path: `/points/${index}${field}`,
    message,
  });
  const named = `the point ${pointText(series, category)}`;
  const problems: Problem[] = [];
  const values = read.values.get(series);
  const position = read.positions.get(category);
  if (values === undefined) {
    problems.push(
      at("/series", `${named} names the series ${quoted(series)}, which the chart does not hold`),
    );
  }
  if (position === undefined) {
    problems.push(
      at(
        "/category",
        `${named} names the category ${quoted(category)}, which the chart does not hold`,
      ),
    );
  }
  if (values !== undefined && position !== undefined) {
    if (!finite(values[position])) {
      problems.push(at("", `${named} has no value: the chart holds null there`));
    }
    const key = JSON.stringify([series, category]);
    if (seen.has(key)) problems.push(at("", `${named} is named twice`));
    seen.add(key);
  }
  return problems;
};

/**
 * What a schema-valid Chart result still gets wrong against the item's props: a point whose series
 * or category the item does not hold or whose value there is null, a point named twice, more than
 * one point for `highlights: "one"` and any point for `highlights: "none"`. Props that hold no
 * categories and series refuse the result, since nothing can check it.
 */
export const chartResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  const read = reading(props);
  if (read === undefined) {
    return [
      { path: "/", message: "the item's props are no Chart's, so its points cannot be checked" },
    ];
  }
  const points = isRecord(result) && Array.isArray(result.points) ? result.points : [];
  if (read.highlights === "none") {
    return [{ path: "/points", message: "this chart takes no highlight: its highlights are none" }];
  }
  const problems: Problem[] = [];
  if (read.highlights === "one" && points.length !== 1) {
    problems.push({
      path: "/points",
      message: `this chart takes one point, and the result names ${points.length}`,
    });
  }
  const seen = new Set<string>();
  points.forEach((point: unknown, index) => {
    problems.push(...pointProblems(point, index, read, seen));
  });
  return problems;
};

const ID = new RegExp(ID_PATTERN);

const isPoint = (point: unknown): boolean => {
  if (!isRecord(point)) return false;
  const keys = Object.keys(point);
  const { series, category } = point;
  return (
    keys.length === 2 &&
    typeof series === "string" &&
    typeof category === "string" &&
    ID.test(series) &&
    ID.test(category)
  );
};

/**
 * Whether `result` has the shape of a Chart's result, the schema's rule in plain code: `points`
 * alone, a list of 1 to 500 points, each `series` and `category` alone, each an ID. That the points
 * are the item's own is the props check's.
 */
export const chartResultShape = (result: unknown): boolean => {
  if (!isRecord(result)) return false;
  const keys = Object.keys(result);
  const { points } = result;
  return (
    keys.length === 1 &&
    keys[0] === "points" &&
    Array.isArray(points) &&
    points.length >= 1 &&
    points.length <= CHART_MAX_POINTS &&
    points.every(isPoint)
  );
};
