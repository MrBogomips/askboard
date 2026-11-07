// The Chart's entry (chart-widget, tasks 1.1 to 1.3; contract spec: Chart items, Chart options,
// Chart pies, Chart results, The Chart's teaching text), composed over the shipped registry with
// `withWidgetTypes`, which gives the same registry before and after the type is registered (design
// decision 10).

import { describe, expect, test } from "bun:test";
import {
  CHART_FIXTURE_ITEMS,
  CHART_RESULTS,
  chartAct,
  chartAnswerEvent,
  chartFetchItemResult,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  CHART_HIGHLIGHTS,
  CHART_KINDS,
  CHART_MAX_CATEGORIES,
  CHART_MAX_POINTS,
  CHART_MAX_SERIES,
  CHART_PIE_MAX_SLICES,
  CHART_SCHEMA_IDS,
  CHART_VALUE_LIMIT,
  CHART_WIDGET,
  chartPropsProblems,
  chartResultProblems,
  chartResultShape,
  WIDGET_TYPES,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { validateBoardMessage } from "../src/validate.ts";
import { EMPTY_RESULTS } from "../src/widgets/registry-check.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { askAccepted, askProblems, resultProblemsOf } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(CHART_WIDGET);
const chart = (props: Record<string, unknown>, id = "failures") => ({ type: "chart", id, props });
const problems = (props: Record<string, unknown>) => askProblems(TYPES, chart(props));
const fieldsOf = (props: Record<string, unknown>) => problems(props).map(({ field }) => field);
const messagesOf = (props: Record<string, unknown>) =>
  problems(props)
    .map(({ message }) => message)
    .join("\n");

const CATEGORIES = [
  { id: "a", label: "Fix A" },
  { id: "b", label: "Fix B" },
];
const BAR = {
  kind: "bar",
  categories: CATEGORIES,
  series: [{ id: "fails", label: "Failures", values: [4, 9] }],
  unit: "runs",
};
const withProps = (extra: Record<string, unknown>) => ({ ...BAR, ...extra });

// `count` categories `c0`, `c1`, … and `series` series each holding one number per category.
const sized = (count: number, series: number, kind = "bar") => ({
  kind,
  categories: Array.from({ length: count }, (_, at) => ({ id: `c${at}`, label: `Category ${at}` })),
  series: Array.from({ length: series }, (_, at) => ({
    id: `s${at}`,
    label: `Series ${at}`,
    values: Array.from({ length: count }, (_, k) => k + at),
  })),
});

describe("the Chart's constants", () => {
  test("hold the contract's limits", () => {
    expect(CHART_KINDS).toEqual(["bar", "line", "pie"]);
    expect(CHART_HIGHLIGHTS).toEqual(["many", "one", "none"]);
    expect(CHART_MAX_CATEGORIES).toBe(100);
    expect(CHART_MAX_SERIES).toBe(5);
    expect(CHART_PIE_MAX_SLICES).toBe(5);
    expect(CHART_VALUE_LIMIT).toBe(1e15);
  });
});

describe("Chart items", () => {
  test("a bar chart in a question passes", () => {
    expect(problems(BAR)).toEqual([]);
    expect(askAccepted(TYPES, chart(BAR))).toBe(true);
  });

  test("a line chart with a gap and a pie of two slices pass", () => {
    const line = {
      kind: "line",
      categories: [
        { id: "q1", label: "Q1" },
        { id: "q2", label: "Q2" },
        { id: "q3", label: "Q3" },
      ],
      series: [
        { id: "cost", label: "Cost", values: [10, null, 14] },
        { id: "plan", label: "Plan", values: [null, null, 3] },
      ],
      title: "Costs per quarter",
      valueLabel: "Euro",
      categoryLabel: "Quarter",
    };
    const pie = {
      kind: "pie",
      categories: CATEGORIES,
      series: [{ id: "share", label: "Share", values: [60, null] }],
    };
    expect(problems(line)).toEqual([]);
    expect(problems(pie)).toEqual([]);
    expect(askAccepted(TYPES, chart(line), chart(pie, "share"))).toBe(true);
  });

  test("values that do not match the categories fail, naming the item and the series", () => {
    const three = {
      kind: "bar",
      categories: [...CATEGORIES, { id: "c", label: "Fix C" }],
      series: [{ id: "fails", label: "Failures", values: [4, 9] }],
    };
    const [problem, ...rest] = problems(three);
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("failures");
    expect(problem?.field).toBe("props.series[0].values");
    expect(problem?.message).toContain('item "failures"');
    expect(problem?.message).toContain('series "fails"');
    expect(problem?.message).toContain("each series holds one value per category");
    expect(problem?.message).toContain("2 values");
    expect(problem?.message).toContain("3 categories");
    const long = { ...three, series: [{ id: "fails", label: "Failures", values: [1, 2, 3, 4] }] };
    expect(fieldsOf(long)).toEqual(["props.series[0].values"]);
    expect(askAccepted(TYPES, chart(three))).toBe(true);
  });

  test("a second series of the wrong length is named, not the first", () => {
    const found = problems(
      withProps({
        series: [
          { id: "fails", label: "Failures", values: [4, 9] },
          { id: "runs", label: "Runs", values: [4] },
        ],
      }),
    );
    expect(found.map(({ field }) => field)).toEqual(["props.series[1].values"]);
    expect(found[0]?.message).toContain('series "runs"');
  });

  test("a repeated category ID fails, naming the item and the repeated element", () => {
    const found = problems(
      withProps({
        categories: [
          { id: "q1", label: "Q1" },
          { id: "q2", label: "Q2" },
          { id: "q1", label: "Q1 again" },
        ],
        series: [{ id: "cost", label: "Cost", values: [1, 2, 3] }],
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.itemId).toBe("failures");
    expect(found[0]?.field).toBe("props.categories[2].id");
    expect(found[0]?.message).toContain('item "failures"');
    expect(found[0]?.message).toContain('category "q1"');
    expect(found[0]?.message).toContain("held twice");
  });

  test("a repeated series ID fails, naming the item and the repeated element", () => {
    const found = problems(
      withProps({
        series: [
          { id: "cost", label: "Cost", values: [1, 2] },
          { id: "cost", label: "Cost again", values: [3, 4] },
        ],
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe("props.series[1].id");
    expect(found[0]?.message).toContain('series "cost"');
    expect(found[0]?.message).toContain("held twice");
  });

  test("100 categories and 5 series pass, 101 categories and 6 series fail by the schema", () => {
    expect(problems(sized(100, 5))).toEqual([]);
    expect(askAccepted(TYPES, chart(sized(100, 5)))).toBe(true);
    // 101 values in a series are over the schema's 100 too.
    expect(fieldsOf(sized(101, 1))).toEqual(["props.categories", "props.series[0].values"]);
    expect(askAccepted(TYPES, chart(sized(101, 1)))).toBe(false);
    expect(fieldsOf(sized(2, 6))).toEqual(["props.series"]);
    expect(askAccepted(TYPES, chart(sized(2, 6)))).toBe(false);
  });

  test("six series name the item and series, with the limit in the wording", () => {
    const [problem] = problems(sized(2, 6));
    expect(problem?.itemId).toBe("failures");
    expect(problem?.field).toBe("props.series");
    expect(problem?.expected).toContain("1 to 5");
  });

  test("no category, no series and an empty list of values fail", () => {
    expect(fieldsOf({ ...BAR, categories: [] })).toContain("props.categories");
    expect(fieldsOf({ ...BAR, series: [] })).toContain("props.series");
    expect(
      fieldsOf(withProps({ series: [{ id: "fails", label: "Failures", values: [] }] })),
    ).toContain("props.series[0].values");
  });

  test("a label of 60 characters passes and 61 fail, for a category and a series", () => {
    const category = (label: string) =>
      withProps({
        categories: [{ id: "a", label }, CATEGORIES[1]],
      });
    const series = (label: string) =>
      withProps({ series: [{ id: "fails", label, values: [4, 9] }] });
    expect(problems(category("a".repeat(60)))).toEqual([]);
    expect(fieldsOf(category("a".repeat(61)))).toEqual(["props.categories[0].label"]);
    expect(fieldsOf(category(""))).toEqual(["props.categories[0].label"]);
    expect(problems(series("b".repeat(60)))).toEqual([]);
    expect(fieldsOf(series("b".repeat(61)))).toEqual(["props.series[0].label"]);
  });

  test("a value of 1e15 passes and 1.0000001e15 fails, either way round", () => {
    const values = (list: readonly (number | null)[]) =>
      withProps({ series: [{ id: "fails", label: "Failures", values: list }] });
    expect(problems(values([1e15, -1e15]))).toEqual([]);
    expect(fieldsOf(values([1.0000001e15, 1]))).toEqual(["props.series[0].values[0]"]);
    expect(fieldsOf(values([1, -1.0000001e15]))).toEqual(["props.series[0].values[1]"]);
    expect(askAccepted(TYPES, chart(values([1.0000001e15, 1])))).toBe(false);
  });

  test("a value that is a string, a boolean or an object fails by the schema", () => {
    for (const bad of ["4", true, {}, [], undefined]) {
      const props = withProps({ series: [{ id: "fails", label: "Failures", values: [bad, 9] }] });
      expect(fieldsOf(props).length).toBeGreaterThan(0);
      expect(askAccepted(TYPES, chart(props))).toBe(false);
    }
  });

  test("an ID outside the ID pattern, a missing field and a wrong kind fail", () => {
    const bad = (id: string) => withProps({ categories: [{ id, label: "A" }, CATEGORIES[1]] });
    expect(fieldsOf(bad("a b"))).toEqual(["props.categories[0].id"]);
    expect(fieldsOf(bad("x".repeat(65)))).toEqual(["props.categories[0].id"]);
    expect(fieldsOf({ categories: CATEGORIES, series: BAR.series })).toEqual(["props.kind"]);
    expect(fieldsOf({ kind: "bar", series: BAR.series })).toContain("props.categories");
    expect(fieldsOf({ kind: "bar", categories: CATEGORIES })).toContain("props.series");
    expect(fieldsOf(withProps({ kind: "scatter" }))).toEqual(["props.kind"]);
  });

  test("a chart in which every value is null fails, saying a chart holds a number", () => {
    const nothing = {
      kind: "line",
      categories: CATEGORIES,
      series: [
        { id: "a", label: "A", values: [null, null] },
        { id: "b", label: "B", values: [null, null] },
      ],
    };
    const [problem, ...rest] = problems(nothing);
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("failures");
    expect(problem?.message).toContain("at least one number");
    expect(problem?.message).toContain('item "failures"');
    expect(askAccepted(TYPES, chart(nothing))).toBe(true);
  });

  test("one number in a sea of nulls is enough", () => {
    const props = {
      kind: "line",
      categories: sized(10, 1).categories,
      series: [
        { id: "a", label: "A", values: [null, null, null, null, null, null, null, 0, null, null] },
      ],
    };
    expect(problems(props)).toEqual([]);
  });
});

describe("Chart options", () => {
  test("a field the Chart does not take fails, naming the item and the field", () => {
    const found = problems(withProps({ stacked: true }));
    expect(found).toHaveLength(1);
    expect(found[0]?.itemId).toBe("failures");
    expect(found[0]?.field).toBe("props.stacked");
    expect(found[0]?.message).toContain('unknown field "stacked"');
    expect(askAccepted(TYPES, chart(withProps({ stacked: true })))).toBe(false);
  });

  test("a field the category or the series do not take fails too", () => {
    expect(
      fieldsOf(withProps({ categories: [{ id: "a", label: "A", colour: "red" }, CATEGORIES[1]] })),
    ).toEqual(["props.categories[0].colour"]);
    expect(
      fieldsOf(withProps({ series: [{ id: "fails", label: "F", values: [4, 9], colour: "red" }] })),
    ).toEqual(["props.series[0].colour"]);
  });

  test("a reading chart with a title of 120 characters passes", () => {
    const props = withProps({ highlights: "none", title: "t".repeat(120) });
    expect(problems(props)).toEqual([]);
    expect(askAccepted(TYPES, chart(props))).toBe(true);
  });

  test("a title of 121, an empty title and the labels and unit beyond their lengths fail", () => {
    expect(fieldsOf(withProps({ title: "t".repeat(121) }))).toEqual(["props.title"]);
    expect(fieldsOf(withProps({ title: "" }))).toEqual(["props.title"]);
    expect(
      problems(withProps({ valueLabel: "v".repeat(60), categoryLabel: "c".repeat(60) })),
    ).toEqual([]);
    expect(fieldsOf(withProps({ valueLabel: "v".repeat(61) }))).toEqual(["props.valueLabel"]);
    expect(fieldsOf(withProps({ categoryLabel: "c".repeat(61) }))).toEqual(["props.categoryLabel"]);
    expect(problems(withProps({ unit: "u".repeat(20) }))).toEqual([]);
    expect(fieldsOf(withProps({ unit: "u".repeat(21) }))).toEqual(["props.unit"]);
    expect(fieldsOf(withProps({ unit: "" }))).toEqual(["props.unit"]);
  });

  test("highlights takes many, one or none, and nothing else", () => {
    for (const highlights of CHART_HIGHLIGHTS) {
      expect(problems(withProps({ highlights }))).toEqual([]);
    }
    expect(fieldsOf(withProps({ highlights: "some" }))).toEqual(["props.highlights"]);
    expect(fieldsOf(withProps({ highlights: true }))).toEqual(["props.highlights"]);
  });
});

describe("Chart pies", () => {
  const pie = (props: Record<string, unknown> = {}) => ({
    kind: "pie",
    categories: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ],
    series: [{ id: "share", label: "Share", values: [5, 3, 2] }],
    ...props,
  });

  test("a pie of five slices passes", () => {
    const five = {
      kind: "pie",
      categories: sized(5, 1).categories,
      series: [{ id: "share", label: "Share", values: [1, 0, 3, null, 5] }],
    };
    expect(problems(five)).toEqual([]);
    expect(problems(pie())).toEqual([]);
    expect(CHART_PIE_MAX_SLICES).toBe(5);
  });

  test("two series fail, naming the item and series, and saying what a pie takes", () => {
    const found = problems(
      pie({
        series: [
          { id: "share", label: "Share", values: [5, 3, 2] },
          { id: "other", label: "Other", values: [1, 1, 1] },
        ],
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.itemId).toBe("failures");
    expect(found[0]?.field).toBe("props.series");
    expect(found[0]?.message).toContain("a pie takes one series");
  });

  test("six categories fail", () => {
    const six = sized(6, 1, "pie");
    const found = problems(six);
    expect(found.map(({ field }) => field)).toEqual(["props.categories"]);
    expect(found[0]?.message).toContain("at most 5");
  });

  test("a negative value fails, naming the value", () => {
    const found = problems(pie({ series: [{ id: "share", label: "Share", values: [5, -3, 2] }] }));
    expect(found.map(({ field }) => field)).toEqual(["props.series[0].values[1]"]);
    expect(found[0]?.message).toContain("no negative value");
  });

  test("only zeros and nulls fail", () => {
    for (const values of [
      [0, 0, 0],
      [0, null, null],
    ]) {
      const found = problems(pie({ series: [{ id: "share", label: "Share", values }] }));
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain("above 0");
    }
  });

  test("a valueLabel or a categoryLabel fails, naming it", () => {
    expect(fieldsOf(pie({ valueLabel: "Euro" }))).toEqual(["props.valueLabel"]);
    expect(fieldsOf(pie({ categoryLabel: "Quarter" }))).toEqual(["props.categoryLabel"]);
    expect(messagesOf(pie({ valueLabel: "Euro" }))).toContain("a pie takes no valueLabel");
  });

  test("a bar chart holds negative values, two series and six categories", () => {
    const props = {
      kind: "bar",
      categories: sized(6, 2).categories,
      series: [
        { id: "a", label: "A", values: [-1, -2, -3, 0, 0, 0] },
        { id: "b", label: "B", values: [0, 0, 0, 0, 0, 1] },
      ],
      valueLabel: "Delta",
      categoryLabel: "Fix",
    };
    expect(problems(props)).toEqual([]);
  });
});

describe("names every object inherits", () => {
  test("as IDs they are IDs, held once or twice, and nothing is inherited by them", () => {
    const names = ["__proto__", "constructor", "toString", "hasOwnProperty"];
    const props = {
      kind: "bar",
      categories: names.map((id) => ({ id, label: id })),
      series: names.slice(0, 2).map((id) => ({ id, label: id, values: [1, 2, 3, 4] })),
    };
    expect(problems(props)).toEqual([]);
    const twice = {
      ...props,
      categories: [...props.categories.slice(0, 3), { id: "constructor", label: "again" }],
    };
    const found = problems(twice);
    expect(found.map(({ field }) => field)).toEqual(["props.categories[3].id"]);
    expect(found[0]?.message).toContain('category "constructor"');
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
    expect(Object.keys(Object.prototype)).toEqual([]);
  });

  test("as the keys of the props, a category or a series, they are refused by the schema", () => {
    for (const key of ["__proto__", "constructor"]) {
      const props = JSON.parse(`{"kind":"bar","${key}":1}`);
      props.categories = CATEGORIES;
      props.series = BAR.series;
      expect(fieldsOf(props)).toEqual([`props.${key}`]);
      const category = JSON.parse(`{"id":"a","label":"A","${key}":1}`);
      expect(fieldsOf({ ...BAR, categories: [category, CATEGORIES[1]] })).toEqual([
        `props.categories[0].${key}`,
      ]);
      const series = JSON.parse(`{"id":"fails","label":"F","values":[1,2],"${key}":1}`);
      expect(fieldsOf({ ...BAR, series: [series] })).toEqual([`props.series[0].${key}`]);
    }
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});

describe("the Chart's props check", () => {
  test("never throws on props it cannot read, and gives nothing for what the schema refuses", () => {
    const unreadable = [
      undefined,
      null,
      3,
      "x",
      [],
      {},
      { kind: "pie" },
      { kind: "pie", categories: 3, series: "x" },
      { kind: "pie", categories: [null, 3, {}], series: [null, 3, {}, { values: 4 }] },
      {
        kind: "bar",
        categories: [{ id: 3 }],
        series: [{ id: 3, values: [1] }, { values: [null] }],
      },
      { categories: [{ id: "a" }], series: [{ id: "s", values: [{}] }] },
    ];
    for (const props of unreadable) {
      expect(() => CHART_WIDGET.propsProblems(props, "agent")).not.toThrow();
      expect(() => chartPropsProblems(props)).not.toThrow();
    }
    expect(chartPropsProblems({})).toEqual([]);
    expect(chartPropsProblems(null)).toEqual([]);
  });

  test("a check finds the problems of a schema-valid chart, one each, in the order the checks run", () => {
    const found = chartPropsProblems({
      kind: "pie",
      categories: [
        { id: "a", label: "A" },
        { id: "a", label: "B" },
      ],
      series: [{ id: "s", label: "S", values: [-1, 0] }],
      valueLabel: "x",
    });
    expect(found.map(({ path }) => path)).toEqual([
      "/categories/1/id",
      "/series/0/values/0",
      "/series/0/values",
      "/valueLabel",
    ]);
  });
});

describe("the Chart's entry", () => {
  test("is a type of its own, which the registry holds last since task 5.1", () => {
    expect(CHART_WIDGET.type).toBe("chart");
    expect(CHART_WIDGET.noun).toBe("a Chart");
    expect(CHART_WIDGET.props.$id).toBe(CHART_SCHEMA_IDS.props);
    expect(CHART_SCHEMA_IDS.props).toBe("urn:askboard:input:chart-props");
    expect(CHART_WIDGET.edits).toBeUndefined();
    expect(CHART_WIDGET.derived).toBeUndefined();
    expect(WIDGET_TYPES.at(-1)).toBe(CHART_WIDGET);
    expect(TYPES.at(-1)).toBe(CHART_WIDGET);
    expect(TYPES).toEqual(WIDGET_TYPES);
  });

  test("every wording key belongs to the chart", () => {
    const keys = [
      ...Object.keys(CHART_WIDGET.wording.expected),
      ...Object.keys(CHART_WIDGET.wording.fields),
    ];
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) expect(key.startsWith("chart.props")).toBe(true);
  });
});

describe("Chart results", () => {
  const ITEM = chart(BAR);
  const check = (result: unknown, item = ITEM) => resultProblemsOf(TYPES, item, result);
  const point = (series: string, category: string) => ({ series, category });
  const text = (result: unknown, item = ITEM) =>
    check(result, item)
      .map(({ message }) => message)
      .join("\n");

  test("two points highlighted pass, in any order", () => {
    expect(check({ points: [point("fails", "a"), point("fails", "b")] })).toEqual([]);
    expect(check({ points: [point("fails", "b"), point("fails", "a")] })).toEqual([]);
    expect(check({ points: [point("fails", "a")] })).toEqual([]);
  });

  test("a point whose category the chart does not hold fails, naming the item and the point", () => {
    const found = check({ points: [point("fails", "a"), point("fails", "c")] });
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/points/1/category");
    expect(found[0]?.message).toContain("item failures");
    expect(found[0]?.message).toContain('series "fails", category "c"');
    expect(found[0]?.message).toContain('category "c"');
    expect(found[0]?.message).toContain("does not hold");
  });

  test("a series the chart does not hold fails, and both unknown give two problems", () => {
    const series = check({ points: [point("cost", "a")] });
    expect(series.map(({ path }) => path)).toEqual(["/points/0/series"]);
    expect(series[0]?.message).toContain('series "cost"');
    const both = check({ points: [point("cost", "z")] });
    expect(both.map(({ path }) => path)).toEqual(["/points/0/series", "/points/0/category"]);
  });

  test("a point whose value is null fails, naming the point", () => {
    const gap = chart({
      kind: "line",
      categories: CATEGORIES,
      series: [{ id: "fails", label: "Failures", values: [4, null] }],
    });
    const found = check({ points: [point("fails", "b")] }, gap);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/points/0");
    expect(found[0]?.message).toContain('series "fails", category "b"');
    expect(found[0]?.message).toContain("no value");
    expect(check({ points: [point("fails", "a")] }, gap)).toEqual([]);
  });

  test("the same point twice fails, naming it", () => {
    const found = check({ points: [point("fails", "a"), point("fails", "a")] });
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/points/1");
    expect(found[0]?.message).toContain("twice");
    expect(found[0]?.message).toContain('series "fails", category "a"');
  });

  test("the same category in another series is another point", () => {
    const two = chart({
      ...BAR,
      series: [
        { id: "fails", label: "Failures", values: [4, 9] },
        { id: "runs", label: "Runs", values: [1, 2] },
      ],
    });
    expect(check({ points: [point("fails", "a"), point("runs", "a")] }, two)).toEqual([]);
  });

  test("a chart with highlights one takes exactly one point", () => {
    const one = chart({ ...BAR, highlights: "one" });
    expect(check({ points: [point("fails", "a")] }, one)).toEqual([]);
    const found = check({ points: [point("fails", "a"), point("fails", "b")] }, one);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/points");
    expect(found[0]?.message).toContain("item failures");
    expect(found[0]?.message).toContain("this chart takes one point");
  });

  test("a chart with highlights none takes no result at all", () => {
    const none = chart({ ...BAR, highlights: "none" });
    const found = check({ points: [point("fails", "a")] }, none);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe("/points");
    expect(found[0]?.message).toContain("item failures");
    expect(found[0]?.message).toContain("this chart takes no highlight");
    expect(check({ points: [] }, none)).not.toEqual([]);
  });

  test("highlights many and its absence are the same", () => {
    const many = chart({ ...BAR, highlights: "many" });
    const result = { points: [point("fails", "a"), point("fails", "b")] };
    expect(check(result, many)).toEqual([]);
    expect(check(result)).toEqual([]);
  });

  test("nothing highlighted fails at /points, by the schema", () => {
    const found = check({ points: [] });
    expect(found).not.toEqual([]);
    expect(found[0]?.path).toBe("/points");
  });

  test("a result of the wrong shape fails by the schema", () => {
    for (const result of [
      {},
      null,
      [],
      "a",
      { points: "a" },
      { points: [null] },
      { points: [{ series: "fails" }] },
      { points: [{ category: "a" }] },
      { points: [{ series: "fails", category: "a b" }] },
      { points: [{ series: 1, category: "a" }] },
      { points: [{ series: "fails", category: "a", value: 4 }] },
      { points: [point("fails", "a")], extra: 1 },
    ]) {
      expect(check(result), JSON.stringify(result)).not.toEqual([]);
    }
  });

  test("500 points of a chart of 5 series by 100 categories pass and 501 fail the schema", () => {
    const full = chart(sized(100, 5));
    const all = Array.from({ length: 500 }, (_, at) =>
      point(`s${Math.floor(at / 100)}`, `c${at % 100}`),
    );
    expect(CHART_MAX_POINTS).toBe(500);
    expect(check({ points: all }, full)).toEqual([]);
    const over = check({ points: [...all, point("s0", "c0")] }, full);
    expect(over.length).toBeGreaterThan(0);
    expect(over.some(({ path }) => path === "/points")).toBe(true);
    expect(chartResultShape({ points: all })).toBe(true);
    expect(chartResultShape({ points: [...all, point("s0", "c0")] })).toBe(false);
  });

  test("names every object inherits are points like any other", () => {
    const names = chart({
      kind: "bar",
      categories: [
        { id: "__proto__", label: "p" },
        { id: "constructor", label: "c" },
      ],
      series: [{ id: "toString", label: "t", values: [1, 2] }],
    });
    expect(
      check({ points: [point("toString", "__proto__"), point("toString", "constructor")] }, names),
    ).toEqual([]);
    const notHeld = check({ points: [point("constructor", "toString")] }, names);
    expect(notHeld.map(({ path }) => path)).toEqual(["/points/0/series", "/points/0/category"]);
    expect(
      text({ points: [point("toString", "__proto__"), point("toString", "__proto__")] }, names),
    ).toContain("twice");
    expect(Object.keys(Object.prototype)).toEqual([]);
  });

  test("a result is refused, never thrown on, against props it cannot read", () => {
    for (const props of [
      null,
      undefined,
      {},
      { categories: 3, series: [] },
      { categories: [], series: 3 },
    ]) {
      const item = { type: "chart", id: "failures", props };
      expect(() => resultProblemsOf(TYPES, item, { points: [point("a", "b")] })).not.toThrow();
      const found = resultProblemsOf(TYPES, item, { points: [point("a", "b")] });
      expect(found.length).toBeGreaterThan(0);
    }
    const garbled = {
      kind: "bar",
      categories: [null, { id: 3 }, { id: "a" }],
      series: [null, { id: "s", values: 3 }, { id: "t", values: [1] }],
    };
    expect(() => chartResultProblems({ points: [point("t", "a")] }, garbled)).not.toThrow();
    expect(() => chartResultProblems(null, garbled)).not.toThrow();
    expect(() => chartResultProblems({ points: [null, 3, { series: 1 }] }, garbled)).not.toThrow();
  });

  test("the fixtures' results pass their items and the act and event are valid", () => {
    const [bar, line, pie] = CHART_FIXTURE_ITEMS;
    expect(bar && check(CHART_RESULTS.bar, bar)).toEqual([]);
    expect(line && check(CHART_RESULTS.line, line)).toEqual([]);
    expect(pie && check(CHART_RESULTS.pie, pie)).toEqual([]);
    expect(askProblems(TYPES, ...CHART_FIXTURE_ITEMS)).toEqual([]);
    expect(askAccepted(TYPES, ...CHART_FIXTURE_ITEMS)).toBe(true);
    expect(validateBoardMessage("toHost", chartAct).ok).toBe(true);
    expect(errorsOf(ajvOver(TYPES), SCHEMA_IDS.answerEvent, chartAnswerEvent)).toEqual([]);
  });

  test("a Chart fetched alone validates with its points, and fails with a Scale's result", () => {
    const ajv = ajvOver(TYPES);
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, chartFetchItemResult)).toEqual([]);
    const item = (chartFetchItemResult as { item: object }).item;
    const withResult = (result: unknown) => ({
      ...chartFetchItemResult,
      item: { ...item, result },
    });
    const errors = errorsOf(ajv, SCHEMA_IDS.fetchResult, withResult({ value: 3 }));
    expect(errors.map((error) => error.instancePath)).toContain("/item/result");
  });
});

describe("the shape check agrees with the schema", () => {
  const validate = (result: unknown) =>
    errorsOf(ajvOver(TYPES), CHART_SCHEMA_IDS.result, result).length === 0;
  const SAMPLES: readonly unknown[] = [
    CHART_RESULTS.bar,
    CHART_RESULTS.line,
    CHART_RESULTS.pie,
    { points: [{ series: "fails", category: "a" }] },
    { points: [] },
    { points: [{ series: "fails", category: "a b" }] },
    { points: [{ series: "x".repeat(64), category: "y".repeat(64) }] },
    { points: [{ series: "x".repeat(65), category: "a" }] },
    { points: [{ series: "fails" }] },
    { points: [{ series: "fails", category: "a", value: 1 }] },
    { points: [{ series: "fails", category: "a" }], extra: 1 },
    { points: "a" },
    { points: [null] },
    { points: [[]] },
    { points: [{ series: 1, category: "a" }] },
    { other: 1 },
    {},
    [],
    null,
    "points",
    3,
    ...EMPTY_RESULTS.map(([, value]) => value),
  ];

  test("on the scenarios' results and the empty values", () => {
    for (const sample of SAMPLES) {
      expect(chartResultShape(sample), JSON.stringify(sample)).toBe(validate(sample));
    }
  });
});

describe("the Chart's result in the registry's own check", () => {
  test("passes over the registry holding it, result-empty included", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(CHART_WIDGET.result?.schema.$id).toBe(CHART_SCHEMA_IDS.result);
    expect(CHART_SCHEMA_IDS.result).toBe("urn:askboard:output:chart-result");
    expect(CHART_WIDGET.result?.shape).toBe(chartResultShape);
    expect(CHART_WIDGET.result?.problems).toBe(chartResultProblems);
    expect(CHART_WIDGET.result?.answerProblems).toBeUndefined();
  });
});

// AskCore.ask reads the shipped registry alone, so it takes the example only once the Chart is
// registered (task 5.1, with `skills-examples.test.ts`); until then the example goes through the
// composed schemas and the entry's checks over `withWidgetTypes`, which is what `ask` runs.
describe("the Chart's teaching text and example", () => {
  const { skill, example } = CHART_WIDGET;
  const notes = (skill?.notes ?? []).join(" ");

  test("the text is within askboard-skills' bounds", () => {
    expect(skill).toBeDefined();
    expect(skill?.use.length).toBeGreaterThanOrEqual(1);
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    expect((skill?.notes ?? []).length).toBeGreaterThan(0);
    for (const note of skill?.notes ?? []) {
      expect(note.length).toBeGreaterThanOrEqual(1);
      expect(note.length).toBeLessThanOrEqual(300);
    }
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("it says when to use a Chart and what its result and values are", () => {
    expect(skill?.use).toContain("bar, line or pie chart");
    expect(skill?.use).toContain("highlight");
    expect(notes).toContain("points");
    expect(notes).toContain("{series, category}");
    expect(notes).toContain("values");
    expect(notes).toContain("categories' order");
    expect(notes).toContain('highlights: "none"');
    expect(notes).toContain("no result");
    expect(notes).toContain("options or another item");
  });

  test("the example is a Chart that an ask accepts, with a unit", () => {
    expect(example.item.type).toBe("chart");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
    expect((example.item.props as { unit?: string }).unit).toBeDefined();
    expect(CHART_WIDGET.propsProblems(example.item.props, "agent")).toEqual([]);
  });
});
