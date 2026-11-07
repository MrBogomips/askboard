import { describe, expect, test } from "bun:test";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { checkedChartProps } from "./props.ts";

// The Chart checks its props as an agent's before it shows (design decision 4): the shape the view's
// unchecked props might lack, then the contract's own checks; a problem throws, naming the item, and
// the item's error boundary fails it (AD-10).

const [BAR, LINE, PIE] = CHART_FIXTURE_ITEMS.map((item) => item.props);
const bar = BAR as unknown as Record<string, unknown>;
const pie = PIE as unknown as Record<string, unknown>;
const refused = (props: unknown) =>
  expect(() => checkedChartProps("failures", props)).toThrow(
    'the Chart "failures" refuses its props',
  );

describe("checkedChartProps", () => {
  test("a bar, a line and a pie of valid props pass and come back as they were", () => {
    for (const props of [BAR, LINE, PIE])
      expect(checkedChartProps("failures", props)).toBe(props as never);
  });

  test("props that are no object throw, naming the item", () => {
    for (const props of [undefined, null, [], "x", 3]) refused(props);
  });

  test("a kind, a list or a field of the wrong type throws", () => {
    for (const props of [
      { ...bar, kind: "radar" },
      { ...bar, kind: undefined },
      { ...bar, categories: "a" },
      { ...bar, series: {} },
      { ...bar, categories: [] },
      { ...bar, series: [] },
      { ...bar, categories: [{ id: "a" }] },
      { ...bar, categories: [{ id: 1, label: "A" }] },
      { ...bar, categories: [null] },
      { ...bar, series: [{ id: "s", label: "S" }] },
      { ...bar, series: [{ id: "s", label: "S", values: "1,2,3" }] },
      { ...bar, series: [{ label: "S", values: [1, 2, 3] }] },
      { ...bar, title: 3 },
      { ...bar, unit: 3 },
      { ...bar, valueLabel: 3 },
      { ...bar, categoryLabel: 3 },
      { ...bar, highlights: "all" },
    ]) {
      refused(props);
    }
  });

  test("a value that is no finite number within the limit throws, a null passes", () => {
    const withValues = (values: unknown[]) => ({
      ...bar,
      categories: values.map((_, at) => ({ id: `c${at}`, label: `C${at}` })),
      series: [{ id: "s", label: "S", values }],
    });
    for (const value of ["1", Number.NaN, Number.POSITIVE_INFINITY, 1e16, -1e16, {}, true]) {
      refused(withValues([value, 1]));
    }
    expect(() => checkedChartProps("failures", withValues([1e15, null, -1e15]))).not.toThrow();
  });

  test("more than 100 categories or 5 series throws, 100 and 5 pass", () => {
    const grid = (categories: number, series: number) => ({
      kind: "bar",
      categories: Array.from({ length: categories }, (_, at) => ({
        id: `c${at}`,
        label: `C${at}`,
      })),
      series: Array.from({ length: series }, (_, at) => ({
        id: `s${at}`,
        label: `S${at}`,
        values: Array.from({ length: categories }, () => 1),
      })),
    });
    expect(() => checkedChartProps("failures", grid(100, 5))).not.toThrow();
    refused(grid(101, 1));
    refused(grid(1, 6));
  });

  test("the contract's checks apply: IDs held twice, a series of the wrong length, no number", () => {
    for (const props of [
      {
        ...bar,
        categories: [
          { id: "a", label: "A" },
          { id: "a", label: "B" },
          { id: "c", label: "C" },
        ],
      },
      {
        ...bar,
        series: [
          { id: "s", label: "S", values: [1, 2, 3] },
          { id: "s", label: "T", values: [1, 2, 3] },
        ],
      },
      { ...bar, series: [{ id: "s", label: "S", values: [1, 2] }] },
      { ...bar, series: [{ id: "s", label: "S", values: [null, null, null] }] },
    ]) {
      refused(props);
    }
  });

  test("a pie's rules apply: one series, five slices, no negative, a value above 0, no axis labels", () => {
    const slices = (n: number) =>
      Array.from({ length: n }, (_, at) => ({ id: `c${at}`, label: `C${at}` }));
    for (const props of [
      {
        ...pie,
        series: [...(pie.series as unknown[]), { id: "t", label: "T", values: [1, 2, 3] }],
      },
      {
        ...pie,
        categories: slices(6),
        series: [{ id: "s", label: "S", values: [1, 1, 1, 1, 1, 1] }],
      },
      { ...pie, series: [{ id: "s", label: "S", values: [5, -1, 2] }] },
      { ...pie, series: [{ id: "s", label: "S", values: [0, 0, 0] }] },
      { ...pie, valueLabel: "Cost" },
      { ...pie, categoryLabel: "Team" },
    ]) {
      refused(props);
    }
  });

  test("the message names each problem", () => {
    try {
      checkedChartProps("failures", { ...bar, series: [{ id: "s", label: "S", values: [1, 2] }] });
      throw new Error("accepted");
    } catch (error) {
      expect(String(error)).toContain("/series/0/values");
      expect(String(error)).toContain("each series holds one value per category");
    }
  });
});
