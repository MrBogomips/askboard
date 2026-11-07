import { describe, expect, test } from "bun:test";
import { SCALE_WIDGET, type ScaleProps, scalePropsProblems } from "@askboard/contract";
import {
  firstResult,
  firstValue,
  ratingValues,
  resultOf,
  snap,
  stepsOf,
  valueAt,
  valuesOf,
} from "./model.ts";

// The Scale's model (view-and-widgets spec: Scale as a slider, Scale as a rating; design decision
// 8): pure arithmetic on the item's props. Every number it makes lies on a step between `min` and
// `max` exactly, so that the contract's result check accepts it (finding X-2: `snap` clamps, the
// top step is `max` itself).
const accepted = (props: ScaleProps, result: unknown): boolean =>
  SCALE_WIDGET.result?.problems?.(result, props).length === 0;

const hundred: ScaleProps = { min: 0, max: 100, step: 5 };

describe("stepsOf", () => {
  test("the number of whole steps", () => {
    expect(stepsOf(hundred)).toBe(20);
    expect(stepsOf({ min: 1, max: 5 })).toBe(4);
    expect(stepsOf({ min: 0, max: 1, step: 0.33333333334 })).toBe(3);
  });

  test("props that do not divide into whole steps are refused", () => {
    expect(() => stepsOf({ min: 0, max: 10, step: 3 })).toThrow(RangeError);
  });
});

describe("snap", () => {
  test("the nearest step, on integer steps", () => {
    expect(snap(hundred, 36)).toBe(35);
    expect(snap(hundred, 38)).toBe(40);
    expect(snap({ min: 1, max: 5 }, 2.4)).toBe(2);
  });

  test("decimal steps carry no binary error: 0.1 + 0.2 snaps to 0.3", () => {
    const props = { min: 0, max: 1, step: 0.1 };
    expect(snap(props, 0.1 + 0.2)).toBe(0.3);
    expect(snap(props, 0.7000000000000001)).toBe(0.7);
    expect(snap({ min: -1, max: 1, step: 0.05 }, -0.2)).toBe(-0.2);
  });

  test("clamps to min and max", () => {
    expect(snap(hundred, -40)).toBe(0);
    expect(snap(hundred, 400)).toBe(100);
    expect(snap(hundred, Number.POSITIVE_INFINITY)).toBe(100);
    expect(snap(hundred, Number.NEGATIVE_INFINITY)).toBe(0);
  });

  test("a number that is not a number snaps to min", () => {
    expect(snap(hundred, Number.NaN)).toBe(0);
  });

  test("the top step is max itself and passes the contract, whatever the arithmetic", () => {
    const cases: ScaleProps[] = [
      { min: 0, max: 1, step: 0.33333333334 },
      { min: 0, max: 0.3, step: 0.1 },
      { min: -0.3, max: 0, step: 0.1 },
    ];
    for (const props of cases) {
      expect(scalePropsProblems(props)).toEqual([]);
      const top = snap(props, props.max + 1);
      expect(top).toBe(props.max);
      expect(accepted(props, { value: top })).toBe(true);
      expect(snap(props, props.max)).toBe(props.max);
      expect(snap(props, props.min)).toBe(props.min);
      for (const value of ratingValues({ ...props, display: "rating" })) {
        expect(accepted(props, { value })).toBe(true);
      }
    }
  });
});

describe("valueAt", () => {
  test("the ends of the track", () => {
    expect(valueAt(hundred, 0)).toBe(0);
    expect(valueAt(hundred, 1)).toBe(100);
  });

  test("36% of 0 to 100 by 5 is 35", () => {
    expect(valueAt(hundred, 0.36)).toBe(35);
  });

  test("a fraction outside the track clamps, a bad one gives min", () => {
    expect(valueAt(hundred, -0.2)).toBe(0);
    expect(valueAt(hundred, 1.7)).toBe(100);
    expect(valueAt(hundred, Number.NaN)).toBe(0);
  });

  test("a negative scale", () => {
    expect(valueAt({ min: -10, max: 10, step: 1 }, 0.5)).toBe(0);
  });
});

describe("firstValue", () => {
  test("Home and the arrows give min, End gives max", () => {
    for (const key of ["Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      expect(firstValue(hundred, key)).toBe(0);
    }
    expect(firstValue(hundred, "End")).toBe(100);
  });

  test("any other key gives nothing", () => {
    expect(firstValue(hundred, "a")).toBeUndefined();
    expect(firstValue(hundred, "Tab")).toBeUndefined();
    expect(firstValue(hundred, "PageUp")).toBeUndefined();
  });
});

describe("results", () => {
  test("a value, and a range's first result with both thumbs at the value", () => {
    expect(firstResult(hundred, 35)).toEqual({ value: 35 });
    expect(firstResult({ ...hundred, range: true }, 35)).toEqual({ low: 35, high: 35 });
  });

  test("a range's two numbers come out in order", () => {
    const range = { ...hundred, range: true };
    expect(resultOf(range, [70, 40])).toEqual({ low: 40, high: 70 });
    expect(resultOf(range, [40, 70])).toEqual({ low: 40, high: 70 });
  });

  test("a range given one number or a value given two is refused", () => {
    expect(() => resultOf({ ...hundred, range: true }, [40])).toThrow(RangeError);
    expect(() => resultOf(hundred, [40, 50])).toThrow(RangeError);
    expect(() => resultOf(hundred, [])).toThrow(RangeError);
  });

  test("the thumbs' values from a result, none when unset", () => {
    expect(valuesOf(hundred, undefined)).toBeUndefined();
    expect(valuesOf(hundred, { value: 35 })).toEqual([35]);
    expect(valuesOf({ ...hundred, range: true }, { low: 10, high: 20 })).toEqual([10, 20]);
    expect(valuesOf(hundred, { low: 10, high: 20 })).toBeUndefined();
    expect(valuesOf({ ...hundred, range: true }, { value: 3 })).toBeUndefined();
  });
});

describe("ratingValues", () => {
  test("one value per step from min to max", () => {
    expect(ratingValues({ min: 1, max: 5, display: "rating" })).toEqual([1, 2, 3, 4, 5]);
    expect(ratingValues({ min: 0, max: 1, step: 0.25, display: "rating" })).toEqual([
      0, 0.25, 0.5, 0.75, 1,
    ]);
    expect(ratingValues({ min: 0, max: 0.3, step: 0.1, display: "rating" })).toEqual([
      0, 0.1, 0.2, 0.3,
    ]);
    expect(ratingValues({ min: -0.3, max: 0, step: 0.1, display: "rating" })).toEqual([
      -0.3, -0.2, -0.1, 0,
    ]);
  });
});

// A small deterministic generator, so that a failure reproduces.
const random = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

// Props the contract accepts: decimal bounds and steps, and steps that divide the scale only
// within a billionth (X-2), which make the top grid point differ from max in floating point.
const propsFrom = (next: () => number): ScaleProps => {
  const decimals = Math.floor(next() * 4);
  const scale = 10 ** decimals;
  const min = Math.round((next() - 0.5) * 2000 * scale) / scale;
  const steps = 1 + Math.floor(next() * 40);
  const unit = Math.max(1, Math.round(next() * 20));
  const max = Math.round((min + (unit * steps) / scale) * scale) / scale;
  if (next() < 0.35) {
    const step = ((max - min) / steps) * (1 + (next() - 0.5) * 1e-10);
    return { min, max, step };
  }
  return { min, max, step: unit / scale };
};

describe("every result the model makes passes the contract's check", () => {
  test("a property test over random props and values", () => {
    const next = random(20260607);
    let checked = 0;
    for (let round = 0; round < 600; round += 1) {
      const props = propsFrom(next);
      if (scalePropsProblems(props).length > 0) continue;
      checked += 1;
      for (let probe = 0; probe < 12; probe += 1) {
        const at = props.min + (next() * 1.4 - 0.2) * (props.max - props.min);
        const value = snap(props, at);
        expect(accepted(props, { value })).toBe(true);
        expect(accepted(props, { value: valueAt(props, next() * 1.4 - 0.2) })).toBe(true);
        const range = { ...props, range: true };
        expect(accepted(range, resultOf(range, [value, snap(props, at / 2)]))).toBe(true);
        expect(accepted(range, firstResult(range, value))).toBe(true);
      }
      expect(accepted(props, firstResult(props, firstValue(props, "End") ?? 0))).toBe(true);
      expect(accepted(props, firstResult(props, firstValue(props, "Home") ?? 0))).toBe(true);
      if (stepsOf(props) + 1 <= 11) {
        for (const value of ratingValues({ ...props, display: "rating" })) {
          expect(accepted(props, { value })).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });
});
