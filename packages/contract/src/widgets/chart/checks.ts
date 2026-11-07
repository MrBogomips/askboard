// The Chart's rules that its schemas cannot say (chart-widget, design decision 1): the category IDs
// unique and the series IDs unique within the item, one value per category in every series, at
// least one number, and what a pie takes.
//
// Plain ECMAScript with no JSON and no Ajv: the chart chunk bundles it. Nothing here throws on a
// value it cannot read: the props check gives no problem for what the schema refuses (AD-10). IDs
// are compared through a `Set`, so a name every object inherits (`__proto__`, `constructor`) is an
// ID like any other.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { CHART_PIE_MAX_SLICES } from "./constants.ts";

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
