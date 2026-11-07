import { describe, expect, test } from "bun:test";
import type { ScaleProps } from "@askboard/contract";
import { scaleResultProblems } from "@askboard/contract";
import { ratingChange, sliderChange, trackFraction } from "./change.ts";

// What a pointer and a thumb put into the draft (view-and-widgets spec: Scale as a slider, Scale as
// a rating; design decision 8): the result of the thumbs' values, each snapped to a step so that
// the contract's check passes whatever Radix computes, and a rating's pressed step.
const slider: ScaleProps = { min: 0, max: 100, step: 5 };
const range: ScaleProps = { ...slider, range: true };

describe("trackFraction", () => {
  test("is the pointer's place on the track, from 0 to 1", () => {
    expect(trackFraction(136, 100, 100)).toBeCloseTo(0.36);
    expect(trackFraction(100, 100, 100)).toBe(0);
    expect(trackFraction(200, 100, 100)).toBe(1);
  });

  test("clamps a pointer beyond the ends and gives 0 for a track with no width", () => {
    expect(trackFraction(50, 100, 100)).toBe(0);
    expect(trackFraction(900, 100, 100)).toBe(1);
    expect(trackFraction(120, 100, 0)).toBe(0);
  });
});

describe("sliderChange", () => {
  test("snaps each thumb to a step and puts a value or a range", () => {
    expect(sliderChange(slider, [36])).toEqual({ value: 35 });
    expect(sliderChange(range, [41, 69])).toEqual({ low: 40, high: 70 });
  });

  test("puts a range low then high whichever thumb is first", () => {
    expect(sliderChange(range, [70, 40])).toEqual({ low: 40, high: 70 });
  });

  test("every result passes the contract's result check, on steps Radix would round off the grid", () => {
    const awkward: ScaleProps = { min: 0.05, max: 0.35, step: 0.1 };
    const result = sliderChange(awkward, [0.15000000000000002]);
    expect(scaleResultProblems(result, awkward)).toEqual([]);
    expect(scaleResultProblems(sliderChange(range, [20, 60]), range)).toEqual([]);
  });

  test("a count of thumbs the props do not take throws", () => {
    expect(() => sliderChange(slider, [1, 2])).toThrow();
    expect(() => sliderChange(range, [1])).toThrow();
  });
});

describe("ratingChange", () => {
  const rating: ScaleProps = { min: 1, max: 5, display: "rating" };

  test("a pressed step puts its value", () => {
    expect(ratingChange(rating, "3")).toEqual({ value: 4 });
    expect(ratingChange(rating, "0")).toEqual({ value: 1 });
  });

  test("the empty value, which a pressed step pressed again reports, puts none", () => {
    expect(ratingChange(rating, "")).toBeUndefined();
  });

  test("a step the scale does not have puts none", () => {
    expect(ratingChange(rating, "9")).toBeUndefined();
    expect(ratingChange(rating, "x")).toBeUndefined();
    expect(ratingChange(rating, "-1")).toBeUndefined();
  });
});
