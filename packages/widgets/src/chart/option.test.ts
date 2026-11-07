import { describe, expect, test } from "bun:test";
import type { ChartPoint, ChartProps } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { barLayout, PLOT_HEIGHT, plotRect, valueExtent } from "./layout.ts";
import { type ChartContext, type ChartTokens, chartOption } from "./option.ts";
import { chartText } from "./text.ts";

// The Chart's ECharts option, tested as data (view-and-widgets spec: Chart drawing, Chart colours
// and legend, Chart tooltips, Highlighting data points, Charts to read and read-only charts;
// design decision 4): nothing here draws; the browser tests draw it.

const [BAR, LINE, PIE] = CHART_FIXTURE_ITEMS.map((item) => item.props) as [
  ChartProps,
  ChartProps,
  ChartProps,
];
const TOKENS: ChartTokens = {
  chart: ["#c1", "#c2", "#c3", "#c4", "#c5"],
  border: "#b0",
  mutedForeground: "#m0",
  popover: "#p0",
  popoverForeground: "#pf",
  change: "#ch",
  card: "#cd",
  fontSans: "ui-sans-serif, system-ui",
  badgeSize: 11.5,
};
// Every string the option holds from the agent starts with the word joiner (review X-1).
const J = "\u2060";
const BOX = { width: 640, height: PLOT_HEIGHT };
const at = (series: string, category: string): ChartPoint => ({ series, category });

const build = (props: ChartProps, patch: Partial<ChartContext> = {}) =>
  chartOption({
    props,
    highlighted: [],
    tokens: TOKENS,
    locale: "en-US",
    box: BOX,
    disabled: false,
    ...patch,
  });

// The option as loose data, for reading a path.
// biome-ignore lint/suspicious/noExplicitAny: a path into the option is read without a type.
type Loose = any;
const loose = (props: ChartProps, patch: Partial<ChartContext> = {}): Loose => build(props, patch);

// Every value of the option with its key, depth first.
const walk = (value: unknown, visit: (key: string, value: unknown) => void, key = ""): void => {
  visit(key, value);
  if (typeof value === "object" && value !== null) {
    for (const [name, child] of Object.entries(value)) walk(child, visit, name);
  }
};
const strings = (option: unknown): string[] => {
  const found: string[] = [];
  walk(option, (_key, value) => {
    if (typeof value === "string") found.push(value);
  });
  return found;
};

describe("the option's basics", () => {
  test("has no animation", () => {
    for (const props of [BAR, LINE, PIE]) {
      const option = loose(props);
      expect(option.animation).toBe(false);
      for (const series of option.series) expect(series.animation).not.toBe(true);
    }
  });

  test("names the font of the tokens", () => {
    expect(loose(BAR).textStyle.fontFamily).toBe(TOKENS.fontSans);
  });

  test("is built from the props without changing them", () => {
    const frozen = structuredClone(BAR);
    const before = JSON.stringify(frozen);
    build(frozen, { highlighted: [at("fails", "fix-a")] });
    expect(JSON.stringify(frozen)).toBe(before);
  });

  test("builds the same option from the same input", () => {
    const given = { highlighted: [at("fails", "fix-b")] };
    const first = JSON.stringify(build(BAR, given), (_k, v) =>
      typeof v === "function" ? "fn" : v,
    );
    const second = JSON.stringify(build(BAR, given), (_k, v) =>
      typeof v === "function" ? "fn" : v,
    );
    expect(first).toBe(second);
  });
});

describe("the axes and the grid", () => {
  test("a bar and a line have one category axis and one value axis from zero", () => {
    for (const props of [BAR, LINE]) {
      const option = loose(props);
      expect(Array.isArray(option.xAxis)).toBe(false);
      expect(Array.isArray(option.yAxis)).toBe(false);
      expect(option.xAxis.type).toBe("category");
      expect(option.xAxis.boundaryGap).toBe(true);
      expect(option.yAxis.type).toBe("value");
      const { min, max, interval } = valueExtent(props);
      expect(option.yAxis.min).toBe(0);
      expect([option.yAxis.min, option.yAxis.max, option.yAxis.interval]).toEqual([
        min,
        max,
        interval,
      ]);
    }
  });

  test("the category axis holds the categories' labels in order, as chart text", () => {
    expect(loose(BAR).xAxis.data).toEqual([`${J}Fix A`, `${J}Fix B`, `${J}Fix C`]);
  });

  test("the grid is the layout's plot, with the labels outside it", () => {
    const rect = plotRect(BAR, BOX);
    const { grid } = loose(BAR);
    expect(grid.left).toBe(rect.x);
    expect(grid.top).toBe(rect.y);
    expect(grid.width).toBe(rect.width);
    expect(grid.height).toBe(rect.height);
    expect(grid.containLabel).not.toBe(true);
  });

  test("axis lines and gridlines take the border colour, labels the muted foreground", () => {
    const option = loose(BAR);
    expect(option.yAxis.splitLine.lineStyle.color).toBe(TOKENS.border);
    expect(option.xAxis.axisLine.lineStyle.color).toBe(TOKENS.border);
    expect(option.xAxis.axisLabel.color).toBe(TOKENS.mutedForeground);
    expect(option.yAxis.axisLabel.color).toBe(TOKENS.mutedForeground);
    expect(option.yAxis.axisLabel.fontSize).toBe(TOKENS.badgeSize);
  });

  test("a pie has no axis and no grid", () => {
    const option = loose(PIE);
    expect(option.xAxis).toBeUndefined();
    expect(option.yAxis).toBeUndefined();
    expect(option.grid).toBeUndefined();
  });

  test("the axis names are the labels sent, as chart text, and none when none were sent", () => {
    const named = loose({ ...BAR, valueLabel: "{b|Runs}", categoryLabel: "Fix‮" });
    expect(named.yAxis.name).toBe(chartText("{b|Runs}"));
    expect(named.xAxis.name).toBe(`${J}Fix\\u202E`);
    expect(loose(BAR).yAxis.name).toBeUndefined();
    expect(loose(BAR).xAxis.name).toBeUndefined();
  });

  test("the value axis shows numbers in the locale with the unit", () => {
    const money: ChartProps = {
      ...BAR,
      unit: "€",
      series: [{ id: "s", label: "S", values: [1234.5, 2, 3] }],
    };
    expect(loose(money, { locale: "it-IT" }).yAxis.axisLabel.formatter(1234.5)).toBe(
      `1.234,5 ${J}€`,
    );
    expect(loose(money).yAxis.axisLabel.formatter(1234.5)).toBe(`1,234.5 ${J}€`);
    expect(loose({ ...money, unit: undefined }).yAxis.axisLabel.formatter(2)).toBe("2");
  });
});

describe("the series' kinds", () => {
  test("bars are drawn as bars, one series each, with a 2px gap and a fifth between categories", () => {
    const option = loose(BAR);
    expect(option.series.map((s: Loose) => s.type)).toEqual(["bar", "bar"]);
    expect(option.series.map((s: Loose) => s.name)).toEqual([`${J}Failures`, `${J}Reruns`]);
    const { barWidth, gap } = barLayout(BAR, plotRect(BAR, BOX));
    for (const series of option.series) {
      expect(series.barCategoryGap).toBe("20%");
      expect(parseFloat(series.barGap) / 100).toBeCloseTo(gap / barWidth, 9);
    }
  });

  test("bars round their ends away from the axis by 4px, for a negative value too", () => {
    const mixed: ChartProps = { ...BAR, series: [{ id: "s", label: "S", values: [3, -2, 0] }] };
    const radius = (value: number) =>
      loose(mixed).series[0].data.find((d: Loose) => d?.value === value).itemStyle.borderRadius;
    expect(radius(3)).toEqual([4, 4, 0, 0]);
    expect(radius(-2)).toEqual([0, 0, 4, 4]);
  });

  test("a line has 2px lines, 8px markers and a gap at a null", () => {
    const option = loose(LINE);
    expect(option.series.map((s: Loose) => s.type)).toEqual(["line", "line"]);
    const actual = option.series[0];
    expect(actual.lineStyle.width).toBe(2);
    expect(actual.symbolSize).toBe(8);
    expect(actual.connectNulls).toBe(false);
    expect(actual.data[1]).toBeNull();
    expect(actual.data[0].value).toBe(10);
  });

  test("a pie is one series of slices, labelled with their categories, parted by a 2px card border", () => {
    const option = loose(PIE);
    expect(option.series).toHaveLength(1);
    const [series] = option.series;
    expect(series.type).toBe("pie");
    expect(series.data.map((d: Loose) => d.value)).toEqual([60, 30, 10]);
    expect(series.itemStyle.borderColor).toBe(TOKENS.card);
    expect(series.itemStyle.borderWidth).toBe(2);
    expect(series.label.formatter({ dataIndex: 1 })).toBe(`${J}API`);
    expect(series.label.color).toBe(TOKENS.mutedForeground);
  });

  test("a slice with no value is drawn as nothing and labelled with nothing", () => {
    const gap: ChartProps = {
      ...PIE,
      series: [{ id: "effort", label: "E", values: [60, null, 40] }],
    };
    const slice = loose(gap).series[0].data[1];
    expect(slice.value).toBe(0);
    expect(slice.label.show).toBe(false);
    expect(slice.labelLine.show).toBe(false);
  });
});

describe("the legend", () => {
  test("shows for a bar or line chart of two series, names them, and hides none when clicked", () => {
    for (const props of [BAR, LINE]) {
      const { legend } = loose(props);
      expect(legend.selectedMode).toBe(false);
      expect(legend.data.map((d: Loose) => d.name)).toEqual(
        props.series.map((s) => chartText(s.label)),
      );
      expect(legend.textStyle.color).toBe(TOKENS.mutedForeground);
    }
  });

  test("is absent for one series and for a pie", () => {
    expect(loose({ ...BAR, series: [BAR.series[0] as never] }).legend).toBeUndefined();
    expect(loose(PIE).legend).toBeUndefined();
  });

  test("names its series as chart text", () => {
    const hostile: ChartProps = {
      ...BAR,
      series: [
        { id: "a", label: "A‮", values: [1, 2, 3] },
        { id: "b", label: "{b|B}", values: [1, 2, 3] },
      ],
    };
    const { legend, series } = loose(hostile);
    expect(legend.data.map((d: Loose) => d.name)).toEqual([`${J}A\\u202E`, chartText("{b|B}")]);
    expect(series.map((s: Loose) => s.name)).toEqual([`${J}A\\u202E`, chartText("{b|B}")]);
  });
});

describe("the colours", () => {
  test("series take chart-1 onward in order", () => {
    const five: ChartProps = {
      ...BAR,
      series: Array.from({ length: 5 }, (_, at) => ({
        id: `s${at}`,
        label: `S${at}`,
        values: [1, 2, 3],
      })),
    };
    const option = loose(five);
    expect(option.series.map((s: Loose) => s.itemStyle.color)).toEqual(TOKENS.chart);
    expect(option.color).toEqual(TOKENS.chart);
  });

  test("a line's line takes its series' colour", () => {
    const [actual, plan] = loose(LINE).series;
    expect(actual.lineStyle.color).toBe("#c1");
    expect(plan.lineStyle.color).toBe("#c2");
  });

  test("a pie's slices take chart-1 onward, in the categories' order", () => {
    expect(loose(PIE).series[0].data.map((d: Loose) => d.itemStyle.color)).toEqual([
      "#c1",
      "#c2",
      "#c3",
    ]);
  });

  test("the tokens given are the colours used", () => {
    const other = { ...TOKENS, chart: ["#a", "#b", "#c", "#d", "#e"] as const };
    expect(loose(BAR, { tokens: other }).series[1].itemStyle.color).toBe("#b");
  });
});

describe("the highlighted points", () => {
  const ring = (item: Loose) => [item.itemStyle.borderColor, item.itemStyle.borderWidth];

  test("a bar takes a 2px change border, and the others do not", () => {
    const data = loose(BAR, { highlighted: [at("fails", "fix-b")] }).series[0].data;
    expect(ring(data[1])).toEqual([TOKENS.change, 2]);
    expect(data[0].itemStyle.borderColor).not.toBe(TOKENS.change);
    expect(data[2].itemStyle.borderColor).not.toBe(TOKENS.change);
  });

  test("a line's marker takes a 2px change ring", () => {
    const option = loose(LINE, { highlighted: [at("actual", "q3")] });
    expect(ring(option.series[0].data[2])).toEqual([TOKENS.change, 2]);
    expect(ring(option.series[0].data[0])[0]).not.toBe(TOKENS.change);
    expect(
      option.series[1].data.every((d: Loose) => d.itemStyle.borderColor !== TOKENS.change),
    ).toBe(true);
  });

  test("a pie's slice takes a 2px change border, and the others a 2px card border", () => {
    const data = loose(PIE, { highlighted: [at("effort", "api")] }).series[0].data;
    expect(ring(data[1])).toEqual([TOKENS.change, 2]);
    expect(ring(data[0])).toEqual([TOKENS.card, 2]);
    expect(ring(data[2])).toEqual([TOKENS.card, 2]);
  });

  test("a point of another series is not highlighted", () => {
    const data = loose(BAR, { highlighted: [at("reruns", "fix-a")] }).series[0].data;
    expect(data.every((d: Loose) => d.itemStyle.borderColor !== TOKENS.change)).toBe(true);
  });

  test("a highlighted point keeps its colour", () => {
    const data = loose(BAR, { highlighted: [at("fails", "fix-b")] }).series[0].data;
    expect(data[1].itemStyle.color).toBe("#c1");
  });

  test("hovering changes no colour: emphasis is disabled on every series", () => {
    for (const props of [BAR, LINE, PIE]) {
      for (const series of loose(props, { highlighted: [] }).series) {
        expect(series.emphasis).toEqual({ disabled: true });
      }
    }
  });
});

describe("the cursor", () => {
  const cursors = (props: ChartProps, patch: Partial<ChartContext> = {}) =>
    loose(props, patch).series.map((s: Loose) => s.cursor);

  test("is a pointer when highlights are taken and the item is enabled", () => {
    expect(cursors(BAR)).toEqual(["pointer", "pointer"]);
    expect(cursors({ ...BAR, highlights: "many" })).toEqual(["pointer", "pointer"]);
    expect(cursors({ ...LINE, highlights: "one" })).toEqual(["pointer", "pointer"]);
    expect(cursors(PIE)).toEqual(["pointer"]);
  });

  test("is the default cursor on a chart to read, and when disabled", () => {
    expect(cursors({ ...BAR, highlights: "none" })).toEqual(["default", "default"]);
    expect(cursors(BAR, { disabled: true })).toEqual(["default", "default"]);
    expect(cursors(PIE, { disabled: true })).toEqual(["default"]);
  });
});

describe("the tooltip", () => {
  const tooltip = (props: ChartProps, patch: Partial<ChartContext> = {}) =>
    loose(props, patch).tooltip;

  test("is drawn on the canvas, on the popover's colours", () => {
    const t = tooltip(BAR);
    expect(t.trigger).toBe("item");
    expect(t.renderMode).toBe("richText");
    expect(t.backgroundColor).toBe(TOKENS.popover);
    expect(t.borderColor).toBe(TOKENS.border);
    expect(t.textStyle.color).toBe(TOKENS.popoverForeground);
    expect(t.textStyle.fontFamily).toBe(TOKENS.fontSans);
  });

  test("names the category, the series and the value in the locale with the unit", () => {
    expect(tooltip(BAR).formatter({ seriesIndex: 0, dataIndex: 1 })).toBe(
      `${J}Fix B\n${J}Failures: 9 ${J}runs`,
    );
    const money: ChartProps = {
      ...BAR,
      unit: "€",
      series: [{ id: "s", label: "Cost", values: [1234.5, 1, 2] }],
    };
    expect(tooltip(money, { locale: "it-IT" }).formatter({ seriesIndex: 0, dataIndex: 0 })).toBe(
      `${J}Fix A\n${J}Cost: 1.234,5 ${J}€`,
    );
  });

  test("names a pie's slice, its series and its value", () => {
    expect(tooltip(PIE).formatter({ seriesIndex: 0, dataIndex: 2 })).toBe(
      `${J}Ops\n${J}Effort: 10`,
    );
  });

  test("reads the props, not the event's text: markup and controls in the labels stay data", () => {
    const hostile: ChartProps = {
      ...BAR,
      categories: [
        { id: "a", label: "{b|Fix} {c}" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      series: [{ id: "s", label: "S‮", values: [1, 2, 3] }],
      unit: "{a|u}",
    };
    const text = tooltip(hostile).formatter({
      seriesIndex: 0,
      dataIndex: 0,
      name: "{c}",
      value: 7,
    });
    expect(text).toBe(
      `${chartText("{b|Fix} {c}")}\n${chartText("S\u202E")}: 1 ${chartText("{a|u}")}`,
    );
  });

  test("is empty for a point the props do not hold or that has no value", () => {
    expect(tooltip(BAR).formatter({ seriesIndex: 1, dataIndex: 2 })).toBe("");
    expect(tooltip(BAR).formatter({ seriesIndex: 5, dataIndex: 0 })).toBe("");
    expect(tooltip(BAR).formatter({ seriesIndex: 0, dataIndex: 9 })).toBe("");
  });
});

describe("agent text and the library's templates", () => {
  const HOSTILE: ChartProps = {
    kind: "bar",
    title: "{a|T}",
    categories: [
      { id: "a", label: "{b|Fix} {c}" },
      { id: "b", label: "{a|{b|x}}" },
    ],
    series: [
      { id: "s", label: "{_|}", values: [1, 2] },
      { id: "t", label: "{9|x}", values: [3, 4] },
    ],
    valueLabel: "{a|Runs}",
    categoryLabel: "{b|Fix}",
    unit: "{c|u}",
  };

  test("every `formatter` in the option is a function, never a template string", () => {
    for (const props of [BAR, LINE, PIE, HOSTILE]) {
      walk(build(props, { highlighted: [] }), (key, value) => {
        if (key === "formatter") expect(typeof value).toBe("function");
      });
    }
  });

  test("no string of the option holds a style the library would read", () => {
    for (const text of strings(build(HOSTILE))) expect(text).not.toMatch(/\{[a-zA-Z0-9_]+\|/);
  });

  test("every agent string the option holds went through chart text", () => {
    const option = loose(HOSTILE);
    expect(option.xAxis.data).toEqual(HOSTILE.categories.map((c) => chartText(c.label)));
    expect(option.series.map((s: Loose) => s.name)).toEqual(
      HOSTILE.series.map((s) => chartText(s.label)),
    );
    expect(option.legend.data.map((d: Loose) => d.name)).toEqual(
      HOSTILE.series.map((s) => chartText(s.label)),
    );
    expect(option.yAxis.name).toBe(chartText("{a|Runs}"));
    expect(option.xAxis.name).toBe(chartText("{b|Fix}"));
    expect(option.yAxis.axisLabel.formatter(2)).toBe(`2 ${chartText("{c|u}")}`);
  });

  test("a pie's label formatter gives chart text", () => {
    const pie: ChartProps = {
      ...PIE,
      categories: [{ id: "a", label: "{b|Fix}" }, ...PIE.categories.slice(1)],
    };
    expect(loose(pie).series[0].label.formatter({ dataIndex: 0 })).toBe(chartText("{b|Fix}"));
  });
});
