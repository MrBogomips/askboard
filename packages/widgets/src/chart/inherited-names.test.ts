import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { ChartProps } from "@askboard/contract";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { importZrender } from "../../test/zrender.ts";
import { PLOT_HEIGHT } from "./layout.ts";
import { type ChartTokens, chartOption } from "./option.ts";

// X-1 of the review of groups 1 to 4 (design decision 3; NFR-5, AD-8): zrender caches the widths
// of the texts it measures in a plain object keyed by the text, so a label equal to an inherited
// name (`__proto__`, `constructor`, `toString`, ...), or cut down to one, would put `prev` and
// `next` on `Object.prototype` or a built-in in the realm the shell shares, and the view's own
// message parsing would then refuse every reply of the board. These tests draw the option through
// ECharts' SVG renderer (pure, no DOM) with every inherited name in every text slot and fail if a
// built-in gains an own property.

use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

const TOKENS: ChartTokens = {
  chart: ["#c1", "#c2", "#c3", "#c4", "#c5"],
  border: "#b0",
  mutedForeground: "#m0",
  popover: "#p0",
  popoverForeground: "#pf",
  change: "#ch",
  card: "#cd",
  fontSans: "sans-serif",
  badgeSize: 11.5,
};

// Every name Object.prototype holds, `__proto__` among them.
const NAMES = Object.getOwnPropertyNames(Object.prototype);

// The built-ins that cache pollution reaches: the prototype, the constructor, and every function
// the prototype holds (an accessor's too), where the cache keeps its list links.
const builtIns = (): readonly object[] => {
  const found: object[] = [Object.prototype, Object, Function.prototype, Array.prototype];
  for (const name of NAMES) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, name);
    for (const value of [descriptor?.value, descriptor?.get, descriptor?.set]) {
      if (typeof value === "function") found.push(value);
    }
  }
  return found;
};

const ownKeys = (objects: readonly object[]): string[][] =>
  objects.map((each) => Reflect.ownKeys(each).map(String));

type Measure = (text: string, font: string) => number;
let measure: Measure;

beforeAll(async () => {
  const platform = await importZrender("lib/core/platform.js");
  // zrender measures text through a canvas: a stand-in with a fixed advance, as no DOM is here.
  (platform.setPlatformAPI as (api: object) => void)({
    createCanvas: () => ({
      getContext: () => ({ font: "", measureText: (text: string) => ({ width: text.length * 6 }) }),
    }),
  });
  measure = (await importZrender("lib/contain/text.js")).getWidth as Measure;
});

// A chart of `kind` whose every text slot holds `label`.
const propsOf = (kind: "bar" | "line" | "pie", label: string): ChartProps => ({
  kind,
  title: label,
  valueLabel: kind === "pie" ? undefined : label,
  categoryLabel: kind === "pie" ? undefined : label,
  unit: label,
  categories: [
    { id: "a", label },
    { id: "b", label: "B" },
    { id: "c", label },
  ],
  series:
    kind === "pie"
      ? [{ id: "s", label, values: [3, 2, 1] }]
      : [
          { id: "s", label, values: [3, 2, 1] },
          { id: "t", label: "T", values: [1, 2, 3] },
        ],
});

const draw = (props: ChartProps, width: number): string => {
  const chart = init(null, null, { renderer: "svg", ssr: true, width, height: PLOT_HEIGHT });
  const option = chartOption({
    props,
    highlighted: [],
    tokens: TOKENS,
    locale: "en-US",
    box: { width, height: PLOT_HEIGHT },
    disabled: false,
  });
  chart.setOption(option as never, { notMerge: true });
  const svg = chart.renderToSVGString();
  // The tooltip is drawn when a point is hovered: measure what its formatter would give for each point.
  const formatter = (option.tooltip as { formatter: (params: object) => string }).formatter;
  for (const [seriesIndex, series] of props.series.entries()) {
    for (const dataIndex of series.values.keys()) {
      for (const line of formatter({ seriesIndex, dataIndex }).split("\n"))
        measure(line, "12px sans-serif");
    }
  }
  chart.dispose();
  return svg;
};

describe("agent text equal to an inherited name, drawn through the chart library", () => {
  const before = ownKeys(builtIns());

  afterEach(() => {
    // Whatever a failing case left on the built-ins must reach neither the next case nor other files.
    for (const each of builtIns()) {
      for (const key of ["prev", "next"]) {
        if (Object.hasOwn(each, key)) Reflect.deleteProperty(each, key);
      }
    }
  });

  test("the set of built-ins is the one the review names", () => {
    expect(NAMES).toContain("__proto__");
    expect(NAMES).toContain("constructor");
    expect(NAMES).toContain("toString");
    expect(NAMES).toContain("hasOwnProperty");
    expect(builtIns().length).toBeGreaterThan(NAMES.length);
  });

  test.each(["bar", "line", "pie"] as const)(
    "a %s chart labelled with each inherited name gives no built-in an own property",
    (kind) => {
      for (const name of NAMES) {
        const svg = draw(propsOf(kind, name), 640);
        expect(svg, name).toContain("<text");
      }
      expect(ownKeys(builtIns())).toEqual(before);
      expect(Object.hasOwn(Object.prototype, "next")).toBe(false);
      expect(Object.hasOwn(Object.prototype, "prev")).toBe(false);
    },
  );

  // Each width cuts the labels at another length, so some cut reaches an inherited name.
  const WIDTHS = Array.from({ length: 60 }, (_, at) => 100 + at * 8);

  test.each(["bar", "line", "pie"] as const)(
    "a %s chart whose 60-character labels start with an inherited name, on boxes of many widths, gives none either",
    (kind) => {
      for (const prefix of ["__proto__", "constructor", "toString", "valueOf"]) {
        const label = `${prefix}${"x".repeat(60 - prefix.length)}`;
        for (const width of WIDTHS) draw(propsOf(kind, label), width);
      }
      expect(ownKeys(builtIns())).toEqual(before);
      expect(Object.hasOwn(Object.prototype, "next")).toBe(false);
    },
  );

  test("a plain object still has no inherited enumerable key after the drawing", () => {
    draw(propsOf("bar", "__proto__"), 640);
    const keys: string[] = [];
    for (const key in { a: 1 }) keys.push(key);
    expect(keys).toEqual(["a"]);
  });
});
