import { describe, expect, test } from "bun:test";
import type { ChartProps } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import {
  BAR_GAP_PX,
  barLayout,
  hasLegend,
  PLOT_HEIGHT,
  plotRect,
  pointCentre,
  valueExtent,
} from "./layout.ts";
import { pointsOf } from "./model.ts";

// The Chart's layout (view-and-widgets spec: Chart drawing, Highlighting data points; design
// decision 4): the grid, the value axis and where each point lies, in pure functions, so that a
// browser test clicks a point by position and the option and the tests read one layout.

const [BAR, LINE, PIE] = CHART_FIXTURE_ITEMS.map((item) => item.props) as [
  ChartProps,
  ChartProps,
  ChartProps,
];
const BOX = { width: 640, height: PLOT_HEIGHT };

describe("hasLegend", () => {
  test("is true for a bar or line chart of two or more series only", () => {
    expect(hasLegend(BAR)).toBe(true);
    expect(hasLegend(LINE)).toBe(true);
    expect(hasLegend({ ...BAR, series: [BAR.series[0] as never] })).toBe(false);
    expect(hasLegend(PIE)).toBe(false);
  });
});

describe("valueExtent", () => {
  test("starts at zero for values that are not negative, with a round top and step", () => {
    expect(valueExtent(BAR)).toEqual({ min: 0, max: 10, interval: 2 });
    expect(valueExtent(LINE)).toEqual({ min: 0, max: 15, interval: 5 });
  });

  test("reaches below zero only as far as a negative value needs, on a round step", () => {
    const negative: ChartProps = {
      ...BAR,
      series: [{ id: "s", label: "S", values: [-3, 5, 1] }],
    };
    expect(valueExtent(negative)).toEqual({ min: -4, max: 6, interval: 2 });
    const below: ChartProps = { ...BAR, series: [{ id: "s", label: "S", values: [-3, -1, -2] }] };
    const { min, max } = valueExtent(below);
    expect(min).toBeLessThanOrEqual(-3);
    expect(max).toBe(0);
  });

  test("holds every value, whatever their size", () => {
    for (const top of [0.00004, 1, 7, 99, 1234.5, 5e6, 1e15]) {
      const props: ChartProps = { ...BAR, series: [{ id: "s", label: "S", values: [top, 0, 0] }] };
      const { min, max, interval } = valueExtent(props);
      expect(min).toBe(0);
      expect(max).toBeGreaterThanOrEqual(top);
      expect(max).toBeLessThan(top * 1.5 + interval);
      expect(Number.isFinite(interval) && interval > 0).toBe(true);
    }
  });

  test("gives a chart of zeros an axis of its own", () => {
    const zeros: ChartProps = { ...BAR, series: [{ id: "s", label: "S", values: [0, 0, 0] }] };
    expect(valueExtent(zeros)).toEqual({ min: 0, max: 1, interval: 0.2 });
  });

  test("a gap holds no value", () => {
    const gap: ChartProps = { ...BAR, series: [{ id: "s", label: "S", values: [null, 4, null] }] };
    expect(valueExtent(gap).max).toBe(5);
  });
});

describe("plotRect", () => {
  test("leaves room for the value labels, the category labels and the legend above", () => {
    const withLegend = plotRect(BAR, BOX);
    const without = plotRect({ ...BAR, series: [BAR.series[0] as never] }, BOX);
    expect(withLegend.x).toBeGreaterThan(0);
    expect(withLegend.y).toBeGreaterThan(without.y);
    expect(withLegend.height).toBeLessThan(without.height);
    expect(withLegend.x + withLegend.width).toBeLessThan(BOX.width);
    expect(withLegend.y + withLegend.height).toBeLessThan(BOX.height);
  });

  test("makes room for the axis labels when sent, above and below", () => {
    const plain = plotRect(BAR, BOX);
    const named = plotRect({ ...BAR, valueLabel: "Runs", categoryLabel: "Fix" }, BOX);
    expect(named.y).toBeGreaterThan(plain.y);
    expect(named.height).toBeLessThan(plain.height);
    expect(named.x).toBe(plain.x);
    expect(named.width).toBe(plain.width);
  });

  test("is the whole box for a pie", () => {
    expect(plotRect(PIE, BOX)).toEqual({ x: 0, y: 0, width: BOX.width, height: BOX.height });
  });
});

describe("barLayout", () => {
  test("gives bars 2px apart in a band with a fifth left as the gap between categories", () => {
    const plot = plotRect(BAR, BOX);
    const { band, barWidth, gap } = barLayout(BAR, plot);
    expect(band).toBeCloseTo(plot.width / 3, 9);
    expect(gap).toBe(BAR_GAP_PX);
    expect(BAR_GAP_PX).toBe(2);
    expect(2 * barWidth + gap).toBeCloseTo(band * 0.8, 9);
  });

  test("one series has one bar of four fifths of the band", () => {
    const one: ChartProps = { ...BAR, series: [BAR.series[0] as never] };
    const plot = plotRect(one, BOX);
    const { band, barWidth } = barLayout(one, plot);
    expect(barWidth).toBeCloseTo(band * 0.8, 9);
  });

  test("never has a bar of negative width", () => {
    const crowded: ChartProps = {
      ...BAR,
      categories: Array.from({ length: 100 }, (_, at) => ({ id: `c${at}`, label: `C${at}` })),
      series: Array.from({ length: 5 }, (_, at) => ({
        id: `s${at}`,
        label: `S${at}`,
        values: Array.from({ length: 100 }, () => 1),
      })),
    };
    const { barWidth } = barLayout(crowded, plotRect(crowded, { width: 320, height: PLOT_HEIGHT }));
    expect(barWidth).toBeGreaterThanOrEqual(0);
  });
});

describe("pointCentre", () => {
  const inside = (p: { x: number; y: number }, r: ReturnType<typeof plotRect>) =>
    p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

  test("lies inside the plot for every point of a bar, a line and a pie, at every width", () => {
    for (const props of [BAR, LINE, PIE]) {
      for (const width of [320, 480, 640, 1000, 1280]) {
        const box = { width, height: PLOT_HEIGHT };
        const rect = plotRect(props, box);
        for (const point of pointsOf(props)) {
          const centre = pointCentre(props, point, box);
          if (centre === undefined) throw new Error(`no centre for ${JSON.stringify(point)}`);
          expect(inside(centre, rect)).toBe(true);
        }
      }
    }
  });

  test("a bar's centre is the middle of its bar: its column, half way between zero and its top", () => {
    const rect = plotRect(BAR, BOX);
    const { band, barWidth, gap } = barLayout(BAR, rect);
    const { min, max } = valueExtent(BAR);
    const yOf = (value: number) => rect.y + (rect.height * (max - value)) / (max - min);
    const first = pointCentre(BAR, { series: "fails", category: "fix-b" }, BOX);
    const second = pointCentre(BAR, { series: "reruns", category: "fix-b" }, BOX);
    const groupLeft = rect.x + band + (band - (2 * barWidth + gap)) / 2;
    expect(first?.x).toBeCloseTo(groupLeft + barWidth / 2, 6);
    expect(second?.x).toBeCloseTo(groupLeft + barWidth + gap + barWidth / 2, 6);
    expect(first?.y).toBeCloseTo((yOf(0) + yOf(9)) / 2, 6);
    expect(second?.y).toBeCloseTo((yOf(0) + yOf(3)) / 2, 6);
  });

  test("a line's marker is at its category's middle and its value's height", () => {
    const rect = plotRect(LINE, BOX);
    const { min, max } = valueExtent(LINE);
    const centre = pointCentre(LINE, { series: "actual", category: "q3" }, BOX);
    expect(centre?.x).toBeCloseTo(rect.x + (rect.width * 2.5) / 4, 6);
    expect(centre?.y).toBeCloseTo(rect.y + (rect.height * (max - 14)) / (max - min), 6);
  });

  test("a pie's slices lie clockwise from twelve o'clock, around the centre", () => {
    // Effort 60, 30, 10: the first slice spans 0 to 216 degrees (centre at 108, right of the
    // centre and a little below), the second 216 to 324 (270, left), the third 324 to 360 (342).
    const at = (category: string) => pointCentre(PIE, { series: "effort", category }, BOX);
    const cx = BOX.width / 2;
    const cy = BOX.height / 2;
    expect((at("ux")?.x ?? 0) > cx).toBe(true);
    expect((at("ux")?.y ?? 0) > cy).toBe(true);
    expect((at("api")?.x ?? 0) < cx).toBe(true);
    expect(at("api")?.y).toBeCloseTo(cy, 6);
    expect((at("ops")?.x ?? 0) < cx).toBe(true);
    expect((at("ops")?.y ?? cy) < cy).toBe(true);
  });

  test("is none for a point the props do not hold, or that has no value", () => {
    expect(pointCentre(BAR, { series: "ghost", category: "fix-a" }, BOX)).toBeUndefined();
    expect(pointCentre(BAR, { series: "fails", category: "nope" }, BOX)).toBeUndefined();
    expect(pointCentre(BAR, { series: "reruns", category: "fix-c" }, BOX)).toBeUndefined();
    expect(pointCentre(BAR, { series: "__proto__", category: "constructor" }, BOX)).toBeUndefined();
  });
});
