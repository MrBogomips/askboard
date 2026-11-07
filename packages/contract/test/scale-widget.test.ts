// The Scale's entry (approval-scale-ranking, task 1.4; contract spec: Scale items, Scale results,
// Teaching text of the three widgets), composed over the shipped registry with `withWidgetTypes`
// while the type is not yet registered (design decision 10).

import { describe, expect, test } from "bun:test";
import { SCALE_FIXTURE_ITEMS, SCALE_RESULTS, withWidgetTypes } from "../src/fixtures/index.ts";
import {
  SCALE_MAX_STEPS,
  SCALE_RATING_MAX_STEPS,
  SCALE_SCHEMA_IDS,
  SCALE_WIDGET,
  scaleStepCount,
  scaleStepIndex,
  widgetRegistryProblems,
} from "../src/index.ts";
import { askAccepted, askProblems, resultProblemsOf } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(SCALE_WIDGET);
const scale = (props: Record<string, unknown>, id = "level") => ({ type: "scale", id, props });
const problems = (props: Record<string, unknown>) => askProblems(TYPES, scale(props));
const fieldsOf = (props: Record<string, unknown>) => problems(props).map(({ field }) => field);

describe("Scale items", () => {
  test("a slider and a rating pass", () => {
    const slider = scale({ min: 0, max: 100, step: 5, unit: "%" }, "share");
    const rating = scale(
      { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" },
      "mood",
    );
    expect(askProblems(TYPES, slider, rating)).toEqual([]);
    expect(askAccepted(TYPES, slider, rating)).toBe(true);
    expect(askProblems(TYPES, ...SCALE_FIXTURE_ITEMS)).toEqual([]);
    expect(askAccepted(TYPES, ...SCALE_FIXTURE_ITEMS)).toBe(true);
  });

  test("a step that does not divide the scale fails, naming the item and the field", () => {
    const [problem, ...rest] = problems({ min: 0, max: 10, step: 3 });
    expect(rest).toEqual([]);
    expect(problem?.itemId).toBe("level");
    expect(problem?.field).toBe("props.step");
    expect(problem?.message).toContain('item "level"');
    expect(problem?.message).toContain("3");
    expect(askAccepted(TYPES, scale({ min: 0, max: 10, step: 3 }))).toBe(true);
  });

  test("the default step is 1", () => {
    expect(problems({ min: 0, max: 10 })).toEqual([]);
    expect(fieldsOf({ min: 0, max: 2.5 })).toEqual(["props.max"]);
  });

  test("a maximum equal to or below the minimum fails, naming max", () => {
    expect(fieldsOf({ min: 5, max: 5 })).toEqual(["props.max"]);
    expect(fieldsOf({ min: 5, max: 1 })).toEqual(["props.max"]);
    expect(problems({ min: 5, max: 5 })[0]?.message).toContain("above");
  });

  test("1,000 steps pass and 1,001 fail", () => {
    expect(SCALE_MAX_STEPS).toBe(1000);
    expect(problems({ min: 0, max: 1000 })).toEqual([]);
    expect(problems({ min: 0, max: 5000, step: 5 })).toEqual([]);
    expect(fieldsOf({ min: 0, max: 1001 })).toEqual(["props.max"]);
    expect(fieldsOf({ min: 0, max: 2000, step: 1 })).toEqual(["props.step"]);
    expect(problems({ min: 0, max: 1001 })[0]?.message).toContain("1,000");
  });

  test("decimal steps divide the scale within a billionth of a step", () => {
    expect(problems({ min: 0, max: 1, step: 0.1 })).toEqual([]);
    expect(problems({ min: 0, max: 0.3, step: 0.1 })).toEqual([]);
    expect(problems({ min: -0.5, max: 0.7, step: 0.1 })).toEqual([]);
    expect(fieldsOf({ min: 0, max: 1, step: 0.3 })).toEqual(["props.step"]);
  });

  test("a step of zero or below fails", () => {
    expect(fieldsOf({ min: 0, max: 10, step: 0 })).toContain("props.step");
    expect(fieldsOf({ min: 0, max: 10, step: -1 })).toContain("props.step");
    expect(askAccepted(TYPES, scale({ min: 0, max: 10, step: 0 }))).toBe(false);
  });

  test("min and max lie within a billion either way", () => {
    expect(problems({ min: -1e9, max: 1e9, step: 1e9 })).toEqual([]);
    expect(fieldsOf({ min: 0, max: 1e9 + 1, step: 1e9 + 1 })).toContain("props.max");
    expect(fieldsOf({ min: -1e9 - 1, max: 0, step: 1e9 + 1 })).toContain("props.min");
    expect(askAccepted(TYPES, scale({ min: 0, max: 2e9, step: 1e9 }))).toBe(false);
  });

  test("labels and unit keep their lengths", () => {
    expect(
      problems({ min: 0, max: 5, minLabel: "a".repeat(60), maxLabel: "b", unit: "u".repeat(20) }),
    ).toEqual([]);
    expect(fieldsOf({ min: 0, max: 5, minLabel: "a".repeat(61) })).toEqual(["props.minLabel"]);
    expect(fieldsOf({ min: 0, max: 5, maxLabel: "" })).toEqual(["props.maxLabel"]);
    expect(fieldsOf({ min: 0, max: 5, unit: "u".repeat(21) })).toEqual(["props.unit"]);
  });

  test("a field the Scale does not define, a missing bound and a wrong type fail", () => {
    expect(fieldsOf({ min: 0, max: 5, colour: "red" })).toEqual(["props.colour"]);
    expect(fieldsOf({ max: 5 })).toEqual(["props.min"]);
    expect(fieldsOf({ min: 0 })).toEqual(["props.max"]);
    expect(fieldsOf({ min: "0", max: 5 })).toEqual(["props.min"]);
    expect(fieldsOf({ min: 0, max: 5, display: "dial" })).toEqual(["props.display"]);
    expect(fieldsOf({ min: 0, max: 5, range: "yes" })).toEqual(["props.range"]);
  });

  test("a rating takes one value of at most 11 steps", () => {
    expect(SCALE_RATING_MAX_STEPS).toBe(11);
    const rating = (props: Record<string, unknown>) => ({ display: "rating", ...props });
    expect(problems(rating({ min: 1, max: 5 }))).toEqual([]);
    expect(problems(rating({ min: 0, max: 10 }))).toEqual([]);
    expect(problems(rating({ min: 0, max: 100, step: 10 }))).toEqual([]);
    const [twelve] = problems(rating({ min: 0, max: 11 }));
    expect(twelve?.itemId).toBe("level");
    expect(twelve?.message).toContain("a rating takes one value of at most 11 steps");
    const [twenty] = problems(rating({ min: 0, max: 20 }));
    expect(twenty?.message).toContain("a rating takes one value of at most 11 steps");
    const [ranged] = problems(rating({ min: 1, max: 5, range: true }));
    expect(ranged?.field).toBe("props.range");
    expect(ranged?.message).toContain("a rating takes one value of at most 11 steps");
    expect(problems({ min: 1, max: 5, range: true })).toEqual([]);
    expect(problems({ min: 1, max: 5, range: false, display: "rating" })).toEqual([]);
  });

  test("a check never throws on props it cannot read", () => {
    for (const props of [null, 3, "x", [], { min: {}, max: [] }]) {
      expect(() => SCALE_WIDGET.propsProblems(props, "agent")).not.toThrow();
    }
  });
});

describe("the step arithmetic", () => {
  test("counts the steps of a scale and finds a value's step", () => {
    expect(scaleStepCount(0, 100, 5)).toBe(20);
    expect(scaleStepCount(0, 1, 0.1)).toBe(10);
    expect(scaleStepCount(0, 10, 3)).toBeUndefined();
    expect(scaleStepCount(1, 5, 1)).toBe(4);
    expect(scaleStepIndex(35, 0, 5)).toBe(7);
    expect(scaleStepIndex(0.3, 0, 0.1)).toBe(3);
    expect(scaleStepIndex(37, 0, 5)).toBeUndefined();
    expect(scaleStepIndex(0.35, 0, 0.1)).toBeUndefined();
  });
});

describe("Scale results", () => {
  const SLIDER = scale({ min: 0, max: 100, step: 5 }, "share");
  const RANGED = scale({ min: 0, max: 100, step: 5, range: true }, "share");
  const check = (item: typeof SLIDER, result: unknown) => resultProblemsOf(TYPES, item, result);

  test("a value on a step passes", () => {
    expect(check(SLIDER, { value: 35 })).toEqual([]);
    expect(check(SLIDER, { value: 0 })).toEqual([]);
    expect(check(SLIDER, { value: 100 })).toEqual([]);
  });

  test("a value off a step, outside the scale, or a range for a slider fails, naming item and field", () => {
    for (const [result, field] of [
      [{ value: 37 }, "/value"],
      [{ value: 105 }, "/value"],
      [{ value: -5 }, "/value"],
      [{ low: 10, high: 20 }, "/low"],
    ] as const) {
      const found = check(SLIDER, result);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0]?.path).toBe(field);
      expect(found[0]?.message).toContain("item share");
    }
  });

  test("a range of low and high on steps passes, equal ends included", () => {
    expect(check(RANGED, { low: 20, high: 20 })).toEqual([]);
    expect(check(RANGED, { low: 10, high: 80 })).toEqual([]);
  });

  test("a range whose low is above its high, or a single value, fails", () => {
    const reversed = check(RANGED, { low: 30, high: 20 });
    expect(reversed[0]?.path).toBe("/low");
    expect(reversed[0]?.message).toContain("item share");
    expect(check(RANGED, { value: 20 })[0]?.path).toBe("/value");
    expect(check(RANGED, { low: 10 })).not.toEqual([]);
    expect(check(RANGED, { low: 10, high: 22 })[0]?.path).toBe("/high");
  });

  test("decimal steps: 0.3 passes on a scale from 0 to 1 by 0.1, 0.35 fails", () => {
    const tenths = scale({ min: 0, max: 1, step: 0.1 }, "p");
    expect(check(tenths, { value: 0.3 })).toEqual([]);
    expect(check(tenths, { value: 0.7 })).toEqual([]);
    expect(check(tenths, { value: 0.35 })[0]?.path).toBe("/value");
  });

  test("a scale that starts below zero and one that does not start at a step", () => {
    const negative = scale({ min: -50, max: 50, step: 10 }, "n");
    expect(check(negative, { value: -30 })).toEqual([]);
    expect(check(negative, { value: -35 })).not.toEqual([]);
    const offset = scale({ min: 3, max: 13, step: 5 }, "o");
    expect(check(offset, { value: 8 })).toEqual([]);
    expect(check(offset, { value: 5 })).not.toEqual([]);
  });

  test("every step of a scale passes and every half step fails", () => {
    for (const props of [
      { min: 0, max: 100, step: 5 },
      { min: 0, max: 1, step: 0.1 },
      { min: -2, max: 2, step: 0.25 },
      { min: 1, max: 5 },
      { min: 0, max: 10, step: 0.01 },
    ]) {
      const item = scale(props);
      const steps = scaleStepCount(props.min, props.max, props.step ?? 1) ?? 0;
      for (let k = 0; k <= steps; k++) {
        expect(check(item, { value: props.min + k * (props.step ?? 1) })).toEqual([]);
      }
      for (let k = 0; k < steps; k++) {
        expect(check(item, { value: props.min + (k + 0.5) * (props.step ?? 1) })).not.toEqual([]);
      }
    }
  });

  test("nothing, a wrong type and an extra field fail by the schema", () => {
    for (const result of [
      {},
      null,
      35,
      "35",
      [35],
      { value: "35" },
      { value: null },
      { value: 35, extra: 1 },
      { value: 35, low: 1, high: 2 },
    ]) {
      expect(check(SLIDER, result)).not.toEqual([]);
    }
  });

  test("a result is checked without throwing against props it cannot read", () => {
    for (const props of [null, undefined, {}, { min: "a" }, 3]) {
      const item = { type: "scale", id: "share", props };
      expect(() => resultProblemsOf(TYPES, item, { value: 5 })).not.toThrow();
    }
  });

  test("the fixtures' results pass their items", () => {
    const [slider, rating, ranged] = SCALE_FIXTURE_ITEMS;
    expect(slider && check(slider, SCALE_RESULTS.slider)).toEqual([]);
    expect(rating && check(rating, SCALE_RESULTS.rating)).toEqual([]);
    expect(ranged && check(ranged, SCALE_RESULTS.range)).toEqual([]);
  });
});

describe("the Scale's entry in the registry's own check", () => {
  test("passes over the registry holding it, result-empty included", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(SCALE_WIDGET.props.$id).toBe(SCALE_SCHEMA_IDS.props);
    expect(SCALE_WIDGET.result?.schema.$id).toBe(SCALE_SCHEMA_IDS.result);
    expect(SCALE_WIDGET.edits).toBeUndefined();
    expect(SCALE_WIDGET.derived).toBeUndefined();
  });

  test("its teaching text is within bounds and its example is accepted in an ask", () => {
    const { skill, example } = SCALE_WIDGET;
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    for (const note of skill?.notes ?? []) expect(note.length).toBeLessThanOrEqual(300);
    expect(skill?.use).toContain("rating");
    expect(askProblems(TYPES, example.item)).toEqual([]);
    expect(askAccepted(TYPES, example.item)).toBe(true);
  });
});
