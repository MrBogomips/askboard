import { describe, expect, test } from "bun:test";
import type { ChartPoint, ChartProps } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import {
  CHART_KEYS,
  type ChartKey,
  firstPoint,
  highlightedPoints,
  isChartKey,
  isHighlighted,
  move,
  pointAt,
  pointsOf,
  resultOf,
  toggle,
} from "./model.ts";

// The Chart's model (view-and-widgets spec: Highlighting data points, A Chart's highlights as its
// result, A Chart at the keyboard; design decision 4): pure functions over the checked props.

const [BAR, LINE, PIE] = CHART_FIXTURE_ITEMS.map((item) => item.props) as [
  ChartProps,
  ChartProps,
  ChartProps,
];
// BAR: categories fix-a, fix-b, fix-c; series fails [4, 9, 2], reruns [1, 3, null].
// LINE: q1..q4; actual [10, null, 14, 13], plan [12, 12, 12, 12].
const at = (series: string, category: string): ChartPoint => ({ series, category });

describe("pointsOf", () => {
  test("lists the points holding a number, series then category order", () => {
    expect(pointsOf(BAR)).toEqual([
      at("fails", "fix-a"),
      at("fails", "fix-b"),
      at("fails", "fix-c"),
      at("reruns", "fix-a"),
      at("reruns", "fix-b"),
    ]);
  });

  test("skips a gap in a line, and lists a pie's slices", () => {
    expect(pointsOf(LINE).filter((p) => p.series === "actual")).toEqual([
      at("actual", "q1"),
      at("actual", "q3"),
      at("actual", "q4"),
    ]);
    expect(pointsOf(PIE)).toEqual([at("effort", "ux"), at("effort", "api"), at("effort", "ops")]);
  });
});

describe("pointAt", () => {
  test("gives the point of a series and a category position, none for a gap or outside", () => {
    expect(pointAt(BAR, 1, 0)).toEqual(at("reruns", "fix-a"));
    expect(pointAt(BAR, 1, 2)).toBeUndefined();
    expect(pointAt(BAR, 2, 0)).toBeUndefined();
    expect(pointAt(BAR, 0, 3)).toBeUndefined();
    expect(pointAt(BAR, -1, 0)).toBeUndefined();
    expect(pointAt(BAR, 0.5, 0)).toBeUndefined();
  });
});

describe("toggle", () => {
  const A = at("fails", "fix-a");
  const B = at("fails", "fix-b");

  test("many adds a point, and removes it on a second click", () => {
    const one = toggle([], A, "many");
    expect(one).toEqual([A]);
    expect(toggle(one, B, "many")).toEqual([A, B]);
    expect(toggle([A, B], A, "many")).toEqual([B]);
    expect(toggle([A], A, "many")).toEqual([]);
  });

  test("a missing highlights is many", () => {
    expect(toggle([A], B, undefined)).toEqual([A, B]);
  });

  test("one replaces the held point, and clears it on a second click", () => {
    expect(toggle([A], B, "one")).toEqual([B]);
    expect(toggle([A], A, "one")).toEqual([]);
    expect(toggle([], A, "one")).toEqual([A]);
  });

  test("none returns the points unchanged", () => {
    expect(toggle([], A, "none")).toEqual([]);
    const held = [A];
    expect(toggle(held, B, "none")).toBe(held);
    expect(toggle(held, A, "none")).toBe(held);
  });

  test("never changes the list it is given", () => {
    const held = Object.freeze([A]);
    expect(() => toggle(held, B, "many")).not.toThrow();
    expect(held).toEqual([A]);
  });
});

describe("resultOf", () => {
  test("is undefined for no point", () => {
    expect(resultOf([], BAR)).toBeUndefined();
  });

  test("lists the points series then category, whatever the order of the clicks", () => {
    const want = {
      points: [at("fails", "fix-a"), at("fails", "fix-b"), at("reruns", "fix-a")],
    };
    const clicks = [at("reruns", "fix-a"), at("fails", "fix-b"), at("fails", "fix-a")];
    expect(resultOf(clicks, BAR)).toEqual(want);
    expect(
      resultOf([clicks[2] as ChartPoint, clicks[0] as ChartPoint, clicks[1] as ChartPoint], BAR),
    ).toEqual(want);
    expect(resultOf([...clicks].reverse(), BAR)).toEqual(want);
  });

  test("drops a point the props do not hold, and a point with no value", () => {
    expect(resultOf([at("ghost", "fix-a"), at("reruns", "fix-c")], BAR)).toBeUndefined();
    expect(resultOf([at("fails", "fix-a"), at("fails", "nope")], BAR)).toEqual({
      points: [at("fails", "fix-a")],
    });
  });

  test("holds a point once, however often it is named", () => {
    expect(resultOf([at("fails", "fix-a"), at("fails", "fix-a")], BAR)).toEqual({
      points: [at("fails", "fix-a")],
    });
  });

  test("takes the names every object inherits as no point", () => {
    expect(resultOf([at("__proto__", "constructor")], BAR)).toBeUndefined();
  });
});

describe("highlightedPoints and isHighlighted", () => {
  test("read a held result's points, and none from anything else", () => {
    const result = { points: [at("fails", "fix-a")] };
    expect(highlightedPoints(result)).toEqual(result.points);
    for (const value of [
      undefined,
      null,
      3,
      "x",
      [],
      {},
      { points: "a" },
      { points: [{ series: 1 }] },
    ]) {
      expect(highlightedPoints(value)).toEqual([]);
    }
  });

  test("say whether a point is among the highlighted", () => {
    const held = [at("fails", "fix-a")];
    expect(isHighlighted(held, at("fails", "fix-a"))).toBe(true);
    expect(isHighlighted(held, at("fails", "fix-b"))).toBe(false);
    expect(isHighlighted([], at("fails", "fix-a"))).toBe(false);
  });
});

describe("firstPoint", () => {
  test("is the first point holding a number, skipping a leading null", () => {
    expect(firstPoint(BAR)).toEqual(at("fails", "fix-a"));
    const leading: ChartProps = {
      ...BAR,
      series: [
        { id: "s", label: "S", values: [null, null, 5] },
        { id: "t", label: "T", values: [1, 2, 3] },
      ],
    };
    expect(firstPoint(leading)).toEqual(at("s", "fix-c"));
    const none: ChartProps = {
      ...BAR,
      series: [{ id: "s", label: "S", values: [null, null, null] }],
    };
    expect(firstPoint(none)).toBeUndefined();
  });
});

describe("move", () => {
  const go = (from: ChartPoint, key: ChartKey, props: ChartProps = BAR) => move(from, key, props);

  test("Right and Left go to the next and previous category of the series", () => {
    expect(go(at("fails", "fix-a"), "ArrowRight")).toEqual(at("fails", "fix-b"));
    expect(go(at("fails", "fix-b"), "ArrowLeft")).toEqual(at("fails", "fix-a"));
  });

  test("Down and Up go to the next and previous series of the category", () => {
    expect(go(at("fails", "fix-a"), "ArrowDown")).toEqual(at("reruns", "fix-a"));
    expect(go(at("reruns", "fix-b"), "ArrowUp")).toEqual(at("fails", "fix-b"));
  });

  test("Home and End go to the first and the last point", () => {
    expect(go(at("fails", "fix-b"), "Home")).toEqual(at("fails", "fix-a"));
    expect(go(at("fails", "fix-a"), "End")).toEqual(at("reruns", "fix-b"));
  });

  test("a gap is skipped, in both directions and across series", () => {
    expect(go(at("actual", "q1"), "ArrowRight", LINE)).toEqual(at("actual", "q3"));
    expect(go(at("actual", "q3"), "ArrowLeft", LINE)).toEqual(at("actual", "q1"));
    // `reruns` has no value at fix-c: Down from `fails` at fix-c finds no series below, so it holds.
    expect(go(at("fails", "fix-c"), "ArrowDown")).toEqual(at("fails", "fix-c"));
    // q2: `actual` is null, so Up from `plan` at q2 holds, and Down from `actual` at q1 reaches `plan`.
    expect(go(at("plan", "q2"), "ArrowUp", LINE)).toEqual(at("plan", "q2"));
    expect(go(at("actual", "q1"), "ArrowDown", LINE)).toEqual(at("plan", "q1"));
  });

  test("a series is skipped when it has no value at the category", () => {
    const three: ChartProps = {
      ...BAR,
      series: [
        { id: "a", label: "A", values: [1, 2, 3] },
        { id: "b", label: "B", values: [null, null, null] },
        { id: "c", label: "C", values: [4, 5, 6] },
      ],
    };
    // The all-null series cannot be named in a result, but a chart may hold one beside others.
    expect(go(at("a", "fix-b"), "ArrowDown", three)).toEqual(at("c", "fix-b"));
    expect(go(at("c", "fix-b"), "ArrowUp", three)).toEqual(at("a", "fix-b"));
  });

  test("the ends are held", () => {
    expect(go(at("fails", "fix-c"), "ArrowRight")).toEqual(at("fails", "fix-c"));
    expect(go(at("fails", "fix-a"), "ArrowLeft")).toEqual(at("fails", "fix-a"));
    expect(go(at("fails", "fix-a"), "ArrowUp")).toEqual(at("fails", "fix-a"));
    expect(go(at("reruns", "fix-b"), "ArrowDown")).toEqual(at("reruns", "fix-b"));
    expect(go(at("fails", "fix-a"), "Home")).toEqual(at("fails", "fix-a"));
    expect(go(at("reruns", "fix-b"), "End")).toEqual(at("reruns", "fix-b"));
  });

  test("a pie moves along its slices with all four arrows", () => {
    expect(go(at("effort", "ux"), "ArrowRight", PIE)).toEqual(at("effort", "api"));
    expect(go(at("effort", "ux"), "ArrowDown", PIE)).toEqual(at("effort", "api"));
    expect(go(at("effort", "ops"), "ArrowLeft", PIE)).toEqual(at("effort", "api"));
    expect(go(at("effort", "ops"), "ArrowUp", PIE)).toEqual(at("effort", "api"));
    expect(go(at("effort", "ops"), "ArrowRight", PIE)).toEqual(at("effort", "ops"));
    expect(go(at("effort", "ux"), "ArrowUp", PIE)).toEqual(at("effort", "ux"));
    expect(go(at("effort", "api"), "End", PIE)).toEqual(at("effort", "ops"));
    expect(go(at("effort", "api"), "Home", PIE)).toEqual(at("effort", "ux"));
  });

  test("a pie's slice with no value is skipped", () => {
    const gap: ChartProps = {
      ...PIE,
      series: [{ id: "effort", label: "Effort", values: [60, null, 10] }],
    };
    expect(go(at("effort", "ux"), "ArrowRight", gap)).toEqual(at("effort", "ops"));
  });

  test("from no current point, or one the props do not hold, it goes to the first point", () => {
    expect(move(undefined, "ArrowRight", BAR)).toEqual(at("fails", "fix-a"));
    expect(go(at("ghost", "fix-a"), "ArrowRight")).toEqual(at("fails", "fix-a"));
    expect(go(at("fails", "fix-z"), "End")).toEqual(at("fails", "fix-a"));
  });

  test("gives nothing for a chart with no number", () => {
    const none: ChartProps = {
      ...BAR,
      series: [{ id: "s", label: "S", values: [null, null, null] }],
    };
    expect(move(undefined, "Home", none)).toBeUndefined();
  });
});

describe("isChartKey", () => {
  test("is true for the six keys a chart moves by and no other", () => {
    for (const key of CHART_KEYS) expect(isChartKey(key)).toBe(true);
    for (const key of [" ", "Enter", "a", "PageDown", "Tab", "arrowleft", ""]) {
      expect(isChartKey(key)).toBe(false);
    }
  });
});
