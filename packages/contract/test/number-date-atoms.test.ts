// The NumberField and the DateField (atoms, task 1.4; contract spec: NumberField items and
// results, DateField items and results), composed over the shipped registry with
// `withWidgetTypes(...ATOM_TYPES)` while the types are not registered (design decision 10).

import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  DATE_FIELD_FIXTURE_ITEMS,
  DATE_FIELD_RESULTS,
  NUMBER_FIELD_FIXTURE_ITEMS,
  NUMBER_FIELD_RESULTS,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  ATOM_LABEL_MAX_CHARS,
  ATOM_NUMBER_BOUND,
  ATOM_UNIT_MAX_CHARS,
  DATE_FIELD_WIDGET,
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  NUMBER_FIELD_WIDGET,
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
  scaleStepCount,
  scaleStepIndex,
  widgetRegistryProblems,
  widgetResultFits,
  widgetResultProblems,
} from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { askAccepted, type Item, question } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...ATOM_TYPES);
const item = (type: string, props: unknown, id = "atom"): Item => ({ type, id, props });
const problemsOf = (it: Item) => widgetItemProblems(it, question(it), "agent", TYPES);
const pathsOf = (it: Item) => problemsOf(it).map(({ path }) => path);
const passes = (it: Item) => problemsOf(it).length === 0 && askAccepted(TYPES, it);
const refused = (it: Item) => problemsOf(it).length > 0 && !askAccepted(TYPES, it);
// Refused by the entry's checks, which run after a schema that passed.
const checkedOnly = (it: Item) => problemsOf(it).length > 0 && askAccepted(TYPES, it);
const number = (props: Record<string, unknown>, id = "days") =>
  item("number-field", { label: "Days", ...props }, id);
const date = (props: Record<string, unknown>, id = "start") =>
  item("date-field", { label: "Start", ...props }, id);
const resultOf = (it: Item, result: unknown) => widgetResultProblems(it, result, it.props, TYPES);
const fits = (it: Item, result: unknown) => widgetResultFits(it, result, it.props, TYPES);
const points = (count: number, character = "a") => character.repeat(count);
const BOUND = ATOM_NUMBER_BOUND;

describe("the NumberField and the DateField in the registry", () => {
  test("hold a result and nothing else, and the registry that holds them is sound", () => {
    for (const entry of [NUMBER_FIELD_WIDGET, DATE_FIELD_WIDGET]) {
      expect(entry.result?.schema.$id).toBe(`urn:askboard:output:${entry.type}-result`);
      expect(entry.result?.shape).toBeFunction();
      expect(entry.edits).toBeUndefined();
      expect(entry.derived).toBeUndefined();
      expect(entry.skill?.use.length).toBeGreaterThan(0);
      expect(entry.skill?.use.length).toBeLessThanOrEqual(90);
      expect(entry.props.$id).toBe(`urn:askboard:input:${entry.type}-props`);
      expect(entry.props.description).toEndWith("In the input format since atoms.");
      expect(entry.result?.schema.description).toEndWith("In the output format since atoms.");
    }
    expect([NUMBER_FIELD_WIDGET.noun, DATE_FIELD_WIDGET.noun]).toEqual([
      "a NumberField",
      "a DateField",
    ]);
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
  });

  test("the registry's order puts the NumberField before the DateField, the Toggle last", () => {
    const order = ATOM_TYPES.map(({ type }) => type);
    expect(order.indexOf("text-field")).toBeLessThan(order.indexOf("number-field"));
    expect(order.indexOf("number-field")).toBeLessThan(order.indexOf("date-field"));
    expect(order.indexOf("date-field")).toBeLessThan(order.indexOf("toggle"));
  });

  test("each example item and fixture passes, and each fixture's result fits it", () => {
    for (const entry of [NUMBER_FIELD_WIDGET, DATE_FIELD_WIDGET]) {
      expect(passes(entry.example.item), entry.type).toBe(true);
    }
    for (const fixture of [...NUMBER_FIELD_FIXTURE_ITEMS, ...DATE_FIELD_FIXTURE_ITEMS]) {
      expect(passes(fixture), fixture.id).toBe(true);
    }
    NUMBER_FIELD_RESULTS.forEach((result, at) => {
      expect(fits(NUMBER_FIELD_FIXTURE_ITEMS[at] as Item, result)).toBe(true);
    });
    DATE_FIELD_RESULTS.forEach((result, at) => {
      expect(fits(DATE_FIELD_FIXTURE_ITEMS[at] as Item, result)).toBe(true);
    });
  });

  test("every field of a props schema has wording, and the wording names no other", () => {
    for (const entry of [NUMBER_FIELD_WIDGET, DATE_FIELD_WIDGET]) {
      const keys = Object.keys(entry.props.properties).map((key) => `${entry.type}.props.${key}`);
      for (const key of keys) expect(entry.wording.expected[key], key).toBeDefined();
      expect(entry.wording.expected[`${entry.type}.props`]).toBeDefined();
      expect(entry.wording.fields[`${entry.type}.props`]).toBeDefined();
      expect(Object.keys(entry.wording.expected).length).toBe(keys.length + 1);
    }
  });

  test("a label of 200 code points passes and 201 fails, a description of 1,000 and 1,001 likewise", () => {
    for (const type of ["number-field", "date-field"]) {
      const label = (text: string) => item(type, { label: text }, "who");
      expect(passes(label(points(ATOM_LABEL_MAX_CHARS, "😀"))), type).toBe(true);
      expect(refused(label(points(ATOM_LABEL_MAX_CHARS + 1))), type).toBe(true);
      expect(pathsOf(label(points(ATOM_LABEL_MAX_CHARS + 1)))).toEqual(["/label"]);
      const described = (text: string) => item(type, { label: "L", description: text });
      expect(passes(described(points(1000, "😀"))), type).toBe(true);
      expect(refused(described(points(1001))), type).toBe(true);
      expect(refused(described("")), type).toBe(true);
      expect(refused(item(type, {})), type).toBe(true);
    }
  });
});

describe("NumberField items", () => {
  test("min and max are within a quadrillion either way, one past fails", () => {
    expect(passes(number({ min: -BOUND, max: BOUND }))).toBe(true);
    for (const bad of [BOUND + 1, -BOUND - 1]) {
      expect(refused(number({ min: bad })), String(bad)).toBe(true);
      expect(refused(number({ max: bad })), String(bad)).toBe(true);
    }
    expect(refused(number({ min: "0" }))).toBe(true);
    expect(
      numberFieldPropsProblems({ label: "L", min: BOUND + 1 }).map(({ path }) => path),
    ).toEqual(["/min"]);
    expect(
      numberFieldPropsProblems({ label: "L", max: -BOUND - 1 }).map(({ path }) => path),
    ).toEqual(["/max"]);
    expect(numberFieldPropsProblems({ label: "L", max: Number.NaN })).toHaveLength(1);
  });

  test("a maximum below the minimum fails, naming max; equal bounds pass", () => {
    expect(checkedOnly(number({ min: 5, max: 4 }))).toBe(true);
    expect(pathsOf(number({ min: 5, max: 4 }))).toEqual(["/max"]);
    expect(problemsOf(number({ min: 5, max: 4 }))[0]?.message).toContain("below");
    expect(passes(number({ min: 5, max: 5 }))).toBe(true);
    expect(passes(number({ min: -3, max: 7 }))).toBe(true);
    expect(passes(number({ min: 5 }))).toBe(true);
    expect(passes(number({ max: 5 }))).toBe(true);
    expect(
      numberFieldPropsProblems({ label: "L", min: 0, max: -1 }).map(({ path }) => path),
    ).toEqual(["/max"]);
  });

  test("a step is above 0 and within two quadrillion; integer is a boolean; the unit has 1 to 20 code points", () => {
    for (const good of [0.1, 1, 0.5, 2 * BOUND])
      expect(passes(number({ step: good })), `${good}`).toBe(true);
    for (const bad of [0, -1, 2 * BOUND + 2, "1"])
      expect(refused(number({ step: bad })), String(bad)).toBe(true);
    expect(passes(number({ integer: true }))).toBe(true);
    expect(passes(number({ integer: false, step: 2 }))).toBe(true);
    expect(refused(number({ integer: 1 }))).toBe(true);
    expect(passes(number({ unit: points(ATOM_UNIT_MAX_CHARS, "😀") }))).toBe(true);
    expect(refused(number({ unit: points(ATOM_UNIT_MAX_CHARS + 1) }))).toBe(true);
    expect(refused(number({ unit: "" }))).toBe(true);
    expect(refused(number({ other: 1 }))).toBe(true);
    const fields = (props: Record<string, unknown>) =>
      numberFieldPropsProblems({ label: "L", ...props }).map(({ path }) => path);
    expect(fields({ step: 0 })).toEqual(["/step"]);
    expect(fields({ integer: "y" })).toEqual(["/integer"]);
    expect(fields({ unit: "" })).toEqual(["/unit"]);
    expect(fields({ other: 1 })).toEqual(["/other"]);
    expect(numberFieldPropsProblems(null).map(({ path }) => path)).toEqual(["/"]);
    expect(numberFieldPropsProblems({}).map(({ path }) => path)).toEqual(["/label"]);
  });
});

describe("NumberField results", () => {
  const days = number({ min: 0, max: 20, step: 0.5 });

  test("3.5 passes; 21 and 3.25 fail, naming the item and the bound or the step", () => {
    expect(resultOf(days, 3.5)).toEqual([]);
    const above = resultOf(days, 21);
    expect(above).toHaveLength(1);
    expect(above[0]?.message).toContain("item days");
    expect(above[0]?.message).toContain("20");
    const off = resultOf(days, 3.25);
    expect(off).toHaveLength(1);
    expect(off[0]?.message).toContain("item days");
    expect(off[0]?.message).toContain("0.5");
    expect(resultOf(days, -0.5)).toHaveLength(1);
    expect(fits(days, 3.5)).toBe(true);
    expect(fits(days, 21)).toBe(false);
    expect(fits(days, 3.25)).toBe(false);
    for (const edge of [0, 20]) expect(resultOf(days, edge)).toEqual([]);
  });

  test("the steps count from min, else from 0", () => {
    const from = number({ min: 0.25, max: 10, step: 0.5 });
    expect(resultOf(from, 0.75)).toEqual([]);
    expect(resultOf(from, 1)).toHaveLength(1);
    const open = number({ step: 2 });
    expect(resultOf(open, 4)).toEqual([]);
    expect(resultOf(open, -6)).toEqual([]);
    expect(resultOf(open, 3)).toHaveLength(1);
  });

  test("integer: 2 and 2.0 pass, 2.5 fails; zero and negatives are content", () => {
    const whole = number({ integer: true });
    expect(resultOf(whole, 2)).toEqual([]);
    expect(resultOf(whole, 2.0)).toEqual([]);
    expect(resultOf(whole, 0)).toEqual([]);
    expect(resultOf(whole, -7)).toEqual([]);
    const half = resultOf(whole, 2.5);
    expect(half).toHaveLength(1);
    expect(half[0]?.message).toContain("whole");
    expect(fits(whole, 2.5)).toBe(false);
    expect(fits(whole, 2)).toBe(true);
    expect(fits(whole, 0)).toBe(true);
  });

  test("a result within a quadrillion passes with no bounds; one past, and what is no number, fail", () => {
    const open = number({});
    expect(resultOf(open, BOUND)).toEqual([]);
    expect(resultOf(open, -BOUND)).toEqual([]);
    expect(resultOf(open, BOUND + 1).length).toBeGreaterThan(0);
    expect(resultOf(open, -BOUND - 1).length).toBeGreaterThan(0);
    for (const bad of ["3", null, true, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resultOf(open, bad).length, String(bad)).toBeGreaterThan(0);
      expect(fits(open, bad), String(bad)).toBe(false);
    }
    expect(numberFieldResultShape(BOUND)).toBe(true);
    expect(numberFieldResultShape(BOUND + 1)).toBe(false);
    expect(numberFieldResultShape("1")).toBe(false);
    expect(numberFieldResultShape(Number.NaN)).toBe(false);
  });

  test("a result is refused against props that are no NumberField's", () => {
    expect(numberFieldResultProblems(1, { label: "L", min: 5, max: 1 })).toHaveLength(1);
    expect(numberFieldResultProblems(1, null)).toHaveLength(1);
    expect(numberFieldResultProblems("x", { label: "L" })).toEqual([]);
    expect(fits(item("number-field", "nonsense"), 1)).toBe(false);
  });

  // The Scale's case: the double nearest `min + k * step` is off the exact grid by more than a
  // billionth of a step where the doubles are spaced wide against the step.
  test("a step a double cannot hold: every step's nearest double is on its step, half a step is not", () => {
    const far: readonly { min: number; max: number; step: number }[] = [
      { min: 1000000, max: 1000001, step: 0.001 },
      { min: -1e9, max: -1e9 + 100, step: 0.1 },
      { min: 999999965, max: 1000000000, step: 0.7 },
    ];
    for (const props of far) {
      const field = number(props);
      expect(numberFieldPropsProblems({ label: "L", ...props })).toEqual([]);
      const steps = scaleStepCount(props.min, props.max, props.step) as number;
      for (let at = 0; at <= steps; at += 1) {
        const value = at === steps ? props.max : props.min + at * props.step;
        expect(resultOf(field, value), `${JSON.stringify(props)} ${at}`).toEqual([]);
      }
      expect(resultOf(field, props.min + 2.5 * props.step)).toHaveLength(1);
      expect(resultOf(field, props.min + 3.1 * props.step)).toHaveLength(1);
    }
    const tenths = number({ min: 0, max: 1, step: 0.1 });
    expect(resultOf(tenths, 0.3)).toEqual([]);
    expect(resultOf(tenths, 0.7)).toEqual([]);
    expect(resultOf(tenths, 0.35)).toHaveLength(1);
  });
});

// The NumberField counts its own steps (atoms, task 1.9; review 1.8 X-1): within a billionth of a
// step, or where the doubles are spaced wider than that, within a few units in the last place, and
// it refuses what that cannot decide: props whose bounds make the doubles coarser than a quarter
// step, and a result at a magnitude where they are.
describe("the NumberField's step where the doubles are coarse (review 1.8 X-1)", () => {
  test("a lower limit of -1e15 with whole steps is refused as props, naming step, and refuses 0.25", () => {
    const field = number({ min: -1e15, step: 1 });
    expect(checkedOnly(field)).toBe(true);
    expect(pathsOf(field)).toEqual(["/step"]);
    expect(problemsOf(field)[0]?.message).toContain("step");
    for (const result of [0.25, 0, 7, -1e15]) {
      expect(resultOf(field, result).length, String(result)).toBeGreaterThan(0);
      expect(fits(field, result), String(result)).toBe(false);
    }
  });

  test("bounds near 1e15 with a step of 2 or 3 are refused as props, naming step", () => {
    for (const props of [
      { min: 0, max: 1e15, step: 2 },
      { min: 0, max: 1e15, step: 3 },
      { min: -1e15, max: 1e15, step: 1 },
      { min: 7e14, max: 9e14, step: 2 },
    ]) {
      expect(pathsOf(number(props)), JSON.stringify(props)).toEqual(["/step"]);
      expect(checkedOnly(number(props)), JSON.stringify(props)).toBe(true);
    }
  });

  test("props whose doubles stay finer than a quarter step pass", () => {
    for (const props of [
      { min: 0, max: 1e15, step: 8 },
      { min: 0, max: 1e9, step: 0.001 },
      { min: 1000000, max: 1000001, step: 0.001 },
      { min: -1e9, max: -1e9 + 100, step: 0.1 },
      { min: -1e15, step: 1e6 },
      { step: 2 },
    ]) {
      expect(passes(number(props)), JSON.stringify(props)).toBe(true);
    }
  });

  test("with no bound, a result where the doubles cannot tell a step from half of one is refused, worded", () => {
    const two = number({ step: 2 });
    for (const result of [999999999999999, 700000000000001]) {
      const problems = resultOf(two, result);
      expect(problems, String(result)).toHaveLength(1);
      expect(problems[0]?.message).toContain("item days");
      expect(problems[0]?.message).toContain("step of 2");
      expect(fits(two, result)).toBe(false);
    }
    expect(resultOf(number({ step: 3 }), 999999999999997)).toHaveLength(1);
    expect(fits(number({ step: 3 }), 999999999999997)).toBe(false);
    // The same steps at a magnitude the doubles tell apart still pass, on the step and off it.
    expect(resultOf(two, 1000000)).toEqual([]);
    expect(resultOf(two, 1000001)).toHaveLength(1);
    expect(resultOf(number({ step: 1 }), 40000000000000)).toEqual([]);
  });

  test("a step counts within a billionth of a step, no wider where the doubles are fine", () => {
    const tenths = number({ min: 0, max: 100, step: 0.1 });
    expect(resultOf(tenths, 0.1 + 0.2)).toEqual([]);
    expect(resultOf(tenths, 0.3 + 1e-12)).toEqual([]);
    expect(resultOf(tenths, 0.3 + 1e-6)).toHaveLength(1);
    expect(resultOf(tenths, 0.35)).toHaveLength(1);
    // A fraction of a step off the grid is never taken for on it.
    const wide = number({ min: 0, max: 1e6, step: 1 });
    expect(resultOf(wide, 5.25)).toHaveLength(1);
    expect(resultOf(wide, 5.0000000001)).toEqual([]);
  });

  test("the Scale's own step check is unchanged: it still takes the widened tolerance", () => {
    expect(scaleStepIndex(1e9, 0, 1e-9)).toBeDefined();
    expect(scaleStepIndex(0.25, -1e9, 1e-8)).toBeDefined();
  });
});

describe("DateField items", () => {
  test("min and max are the Gantt's days: the first and last pass, one past fails", () => {
    expect(passes(date({ min: GANTT_FIRST_DATE, max: GANTT_LAST_DATE }))).toBe(true);
    expect(checkedOnly(date({ min: "1900-03-01" }))).toBe(true);
    expect(pathsOf(date({ min: "1900-03-01" }))).toEqual(["/min"]);
    expect(refused(date({ max: "10000-01-01" }))).toBe(true);
    expect(checkedOnly(date({ max: "2026-02-30" }))).toBe(true);
    expect(pathsOf(date({ max: "2026-02-30" }))).toEqual(["/max"]);
    expect(refused(date({ min: "2026-1-5" }))).toBe(true);
    expect(refused(date({ min: 20260105 }))).toBe(true);
  });

  test("a maximum before the minimum fails, naming max; equal days pass", () => {
    expect(checkedOnly(date({ min: "2026-03-02", max: "2026-03-01" }))).toBe(true);
    expect(pathsOf(date({ min: "2026-03-02", max: "2026-03-01" }))).toEqual(["/max"]);
    expect(passes(date({ min: "2026-03-02", max: "2026-03-02" }))).toBe(true);
    expect(passes(date({ min: "2026-01-01" }))).toBe(true);
    expect(passes(date({}))).toBe(true);
    const fields = (props: Record<string, unknown>) =>
      dateFieldPropsProblems({ label: "L", ...props }).map(({ path }) => path);
    expect(fields({ min: "2026-03-02", max: "2026-03-01" })).toEqual(["/max"]);
    expect(fields({ min: "1900-03-01" })).toEqual(["/min"]);
    expect(fields({ max: "2026-02-30" })).toEqual(["/max"]);
    expect(fields({ min: 5 })).toEqual(["/min"]);
    expect(fields({ other: 1 })).toEqual(["/other"]);
    expect(dateFieldPropsProblems(null).map(({ path }) => path)).toEqual(["/"]);
    expect(dateFieldPropsProblems({}).map(({ path }) => path)).toEqual(["/label"]);
    expect(refused(date({ other: 1 }))).toBe(true);
  });
});

describe("DateField results", () => {
  test("a date within min and max passes; before min, an unreal day and a malformed one fail", () => {
    const start = date({ min: "2026-01-01" });
    expect(resultOf(start, "2026-03-02")).toEqual([]);
    expect(resultOf(start, "2026-01-01")).toEqual([]);
    const before = resultOf(start, "2025-12-31");
    expect(before).toHaveLength(1);
    expect(before[0]?.message).toContain("item start");
    expect(before[0]?.message).toContain("2026-01-01");
    expect(resultOf(start, "2026-02-30").length).toBeGreaterThan(0);
    expect(resultOf(start, "2026-2-3").length).toBeGreaterThan(0);
    expect(fits(start, "2026-03-02")).toBe(true);
    expect(fits(start, "2025-12-31")).toBe(false);
    expect(fits(start, "2026-02-30")).toBe(false);
  });

  test("max bounds from above; both bounds are inclusive", () => {
    const window = date({ min: "2026-03-01", max: "2026-03-31" });
    expect(resultOf(window, "2026-03-31")).toEqual([]);
    expect(resultOf(window, "2026-03-01")).toEqual([]);
    expect(resultOf(window, "2026-04-01")).toHaveLength(1);
    expect(resultOf(window, "2026-02-28")).toHaveLength(1);
  });

  test("the Gantt's first and last dates pass with no bounds, one past fails", () => {
    const open = date({});
    expect(resultOf(open, GANTT_FIRST_DATE)).toEqual([]);
    expect(resultOf(open, GANTT_LAST_DATE)).toEqual([]);
    expect(resultOf(open, "1900-03-01").length).toBeGreaterThan(0);
    expect(resultOf(open, "10000-01-01").length).toBeGreaterThan(0);
    expect(fits(open, "1900-03-01")).toBe(false);
    expect(fits(open, GANTT_LAST_DATE)).toBe(true);
  });

  test("what is no string, and an empty one, is refused", () => {
    const open = date({});
    for (const bad of ["", null, 20260302, true, {}, []]) {
      expect(resultOf(open, bad).length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(fits(open, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(dateFieldResultShape("2026-03-02")).toBe(true);
    expect(dateFieldResultShape("2026-13-02")).toBe(false);
    expect(dateFieldResultShape(5)).toBe(false);
  });

  test("a result is refused against props that are no DateField's", () => {
    expect(
      dateFieldResultProblems("2026-03-02", { label: "L", min: "2026-03-02", max: "2026-03-01" }),
    ).toHaveLength(1);
    expect(dateFieldResultProblems("2026-03-02", null)).toHaveLength(1);
    expect(dateFieldResultProblems(3, { label: "L" })).toEqual([]);
    expect(fits(item("date-field", "nonsense"), "2026-03-02")).toBe(false);
  });

  test("the result schema's pattern is the Gantt's full-date pattern", () => {
    const props = TYPES.find(({ type }) => type === "gantt")?.props as
      | { $defs: { fullDate: { pattern: string } } }
      | undefined;
    const gantt = props?.$defs.fullDate.pattern;
    expect(gantt).toBeString();
    expect(DATE_FIELD_WIDGET.result?.schema.pattern).toBe(gantt);
  });
});
