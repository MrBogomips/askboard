// The TextField and the Toggle (atoms, task 1.3; contract spec: TextField items and results, Toggle
// items and results, Atom labels and descriptions), composed over the shipped registry with
// `withWidgetTypes(...ATOM_TYPES)` while the types are not registered (design decision 10).

import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  TEXT_FIELD_FIXTURE_ITEMS,
  TEXT_FIELD_RESULTS,
  TOGGLE_FIXTURE_ITEM,
  TOGGLE_RESULTS,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  resultHoldsNothing,
  TEXT_FIELD_MAX_CHARS,
  TEXT_FIELD_WIDGET,
  TOGGLE_WIDGET,
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
  togglePropsProblems,
  toggleResultShape,
  widgetRegistryProblems,
  widgetResultFits,
  widgetResultProblems,
} from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { askAccepted, type Item, question } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...ATOM_TYPES);
const item = (type: string, props: unknown, id = "atom"): Item => ({ type, id, props });
const problemsOf = (it: Item) => widgetItemProblems(it, question(it), "agent", TYPES);
const passes = (it: Item) => problemsOf(it).length === 0 && askAccepted(TYPES, it);
const refused = (it: Item) => problemsOf(it).length > 0 && !askAccepted(TYPES, it);
const field = (props: Record<string, unknown>, id = "name") =>
  item("text-field", { label: "Name", ...props }, id);
const resultOf = (it: Item, result: unknown) => widgetResultProblems(it, result, it.props, TYPES);
const fits = (it: Item, result: unknown) => widgetResultFits(it, result, it.props, TYPES);
const points = (count: number, character = "a") => character.repeat(count);

describe("the input atoms of the fields in the registry", () => {
  test("hold a result, no edits and no derived values, and the registry that holds them is sound", () => {
    for (const entry of [TEXT_FIELD_WIDGET, TOGGLE_WIDGET]) {
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
    expect([TEXT_FIELD_WIDGET.noun, TOGGLE_WIDGET.noun]).toEqual(["a TextField", "a Toggle"]);
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(TYPES.map(({ type }) => type)).toEqual(expect.arrayContaining(["text-field", "toggle"]));
  });

  test("the atoms follow the display atoms in the fixtures' registry order, the Toggle last", () => {
    const order = ATOM_TYPES.map(({ type }) => type);
    expect(order.slice(0, 3)).toEqual(["text", "value", "divider"]);
    expect(order.indexOf("text-field")).toBe(3);
    expect(order.at(-1)).toBe("toggle");
  });

  test("each example item and fixture passes", () => {
    for (const entry of [TEXT_FIELD_WIDGET, TOGGLE_WIDGET]) {
      expect(passes(entry.example.item), entry.type).toBe(true);
    }
    for (const fixture of [...TEXT_FIELD_FIXTURE_ITEMS, TOGGLE_FIXTURE_ITEM]) {
      expect(passes(fixture), fixture.id).toBe(true);
    }
  });

  test("every field of a props schema has wording, and the wording names no other", () => {
    for (const entry of [TEXT_FIELD_WIDGET, TOGGLE_WIDGET]) {
      const keys = Object.keys(entry.props.properties).map((key) => `${entry.type}.props.${key}`);
      for (const key of keys) expect(entry.wording.expected[key], key).toBeDefined();
      expect(entry.wording.expected[`${entry.type}.props`]).toBeDefined();
      expect(entry.wording.fields[`${entry.type}.props`]).toBeDefined();
      expect(Object.keys(entry.wording.expected).length).toBe(keys.length + 1);
    }
  });

  test("the schemas' limits are the constants'", () => {
    const { properties } = TEXT_FIELD_WIDGET.props;
    expect(properties.label.maxLength).toBe(ATOM_LABEL_MAX_CHARS);
    expect(properties.description.maxLength).toBe(ATOM_DESCRIPTION_MAX_CHARS);
    expect(properties.maxLength.maximum).toBe(TEXT_FIELD_MAX_CHARS);
    expect(TEXT_FIELD_WIDGET.result?.schema.maxLength).toBe(TEXT_FIELD_MAX_CHARS);
    expect(TOGGLE_WIDGET.props.properties.label.maxLength).toBe(ATOM_LABEL_MAX_CHARS);
  });
});

describe("labels and descriptions of the input atoms", () => {
  test("a label of 200 code points passes and 201 fails, naming the item and the field", () => {
    for (const type of ["text-field", "toggle"]) {
      const label = (text: string) => item(type, { label: text }, "who");
      expect(passes(label(points(ATOM_LABEL_MAX_CHARS, "😀"))), type).toBe(true);
      expect(refused(label(points(ATOM_LABEL_MAX_CHARS + 1, "😀"))), type).toBe(true);
      expect(problemsOf(label(points(ATOM_LABEL_MAX_CHARS + 1))).map(({ path }) => path)).toEqual([
        "/label",
      ]);
      expect(refused(label("")), type).toBe(true);
      expect(refused(item(type, {})), type).toBe(true);
    }
  });

  test("a description of 1,000 code points passes, 1,001 and an empty one fail", () => {
    for (const type of ["text-field", "toggle"]) {
      const described = (text: string) => item(type, { label: "L", description: text });
      expect(passes(described(points(ATOM_DESCRIPTION_MAX_CHARS, "😀"))), type).toBe(true);
      expect(refused(described(points(ATOM_DESCRIPTION_MAX_CHARS + 1))), type).toBe(true);
      expect(refused(described("")), type).toBe(true);
    }
  });

  test("the restated checks agree", () => {
    expect(textFieldPropsProblems({ label: points(201) }).map(({ path }) => path)).toEqual([
      "/label",
    ]);
    expect(togglePropsProblems({ label: points(201) }).map(({ path }) => path)).toEqual(["/label"]);
    expect(textFieldPropsProblems({ label: "L", description: "" }).map(({ path }) => path)).toEqual(
      ["/description"],
    );
    expect(togglePropsProblems({ label: "L", description: 3 }).map(({ path }) => path)).toEqual([
      "/description",
    ]);
    expect(textFieldPropsProblems({}).map(({ path }) => path)).toEqual(["/label"]);
    expect(togglePropsProblems(null).map(({ path }) => path)).toEqual(["/"]);
    expect(textFieldPropsProblems("x").map(({ path }) => path)).toEqual(["/"]);
    expect(togglePropsProblems({ label: "L", extra: 1 }).map(({ path }) => path)).toEqual([
      "/extra",
    ]);
  });

  test("`__proto__` is a label like any other", () => {
    expect(passes(field({ label: "__proto__" }))).toBe(true);
    expect(passes(item("toggle", { label: "__proto__" }))).toBe(true);
    expect(textFieldPropsProblems({ label: "__proto__" })).toEqual([]);
  });
});

describe("TextField items", () => {
  test("maxLength is a whole number from 1 to 10,000, and multiline a boolean", () => {
    for (const good of [1, 40, 10_000])
      expect(passes(field({ maxLength: good })), `${good}`).toBe(true);
    for (const bad of [0, -1, 10_001, 1.5, "5", null]) {
      expect(refused(field({ maxLength: bad })), String(bad)).toBe(true);
    }
    expect(passes(field({ multiline: true }))).toBe(true);
    expect(passes(field({ multiline: false, maxLength: 5 }))).toBe(true);
    expect(refused(field({ multiline: "yes" }))).toBe(true);
    expect(refused(field({ other: 1 }))).toBe(true);
    expect(
      textFieldPropsProblems({ label: "L", maxLength: 10_001 }).map(({ path }) => path),
    ).toEqual(["/maxLength"]);
    expect(textFieldPropsProblems({ label: "L", maxLength: 1.5 }).map(({ path }) => path)).toEqual([
      "/maxLength",
    ]);
    expect(textFieldPropsProblems({ label: "L", multiline: 1 }).map(({ path }) => path)).toEqual([
      "/multiline",
    ]);
    expect(textFieldPropsProblems({ label: "L", maxLength: 40, multiline: true })).toEqual([]);
  });
});

describe("TextField results", () => {
  const short = field({ maxLength: 40 });

  test("a short text passes; 41 code points and a line break fail, naming the item and the limit or the break", () => {
    expect(resultOf(short, "Ada")).toEqual([]);
    const long = resultOf(short, points(41));
    expect(long).toHaveLength(1);
    expect(long[0]?.message).toContain("item name");
    expect(long[0]?.message).toContain("40");
    const broken = resultOf(short, "a\nb");
    expect(broken).toHaveLength(1);
    expect(broken[0]?.message).toContain("item name");
    expect(broken[0]?.message).toContain("line break");
    expect(fits(short, "Ada")).toBe(true);
    expect(fits(short, points(41))).toBe(false);
    expect(fits(short, "a\nb")).toBe(false);
  });

  test("a carriage return is a line break too, unless the field is multiline", () => {
    expect(resultOf(short, "\r")).toHaveLength(1);
    expect(resultOf(short, "a\rb")).toHaveLength(1);
    expect(resultOf(short, "a\r\nb")).toHaveLength(1);
    const multiline = field({ multiline: true, maxLength: 40 });
    expect(resultOf(multiline, "a\nb")).toEqual([]);
    expect(resultOf(multiline, "\r")).toEqual([]);
    expect(resultOf(multiline, "a\r\nb")).toEqual([]);
    expect(fits(multiline, "a\r\nb")).toBe(true);
  });

  test("maxLength counts code points: ten astral characters fit 10, eleven do not", () => {
    const ten = field({ maxLength: 10 });
    expect(resultOf(ten, points(10, "😀"))).toEqual([]);
    expect(resultOf(ten, points(11, "😀"))).toHaveLength(1);
    expect(fits(ten, points(10, "😀"))).toBe(true);
    expect(fits(ten, points(11, "😀"))).toBe(false);
  });

  test("without maxLength the limit is 10,000 code points", () => {
    const open = field({});
    expect(resultOf(open, points(10_000, "😀"))).toEqual([]);
    expect(resultOf(open, points(10_001, "😀"))).not.toEqual([]);
    expect(fits(open, points(10_000))).toBe(true);
    expect(fits(open, points(10_001))).toBe(false);
  });

  test("an empty text, and what is no string, hold nothing and are refused", () => {
    for (const bad of ["", null, 5, true, {}, [], ["a"]]) {
      expect(resultOf(short, bad).length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(fits(short, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(textFieldResultShape("")).toBe(false);
    expect(textFieldResultShape("x")).toBe(true);
    expect(textFieldResultShape(points(10_001))).toBe(false);
    expect(textFieldResultShape(5)).toBe(false);
  });

  test("a result is refused against props that are no TextField's", () => {
    expect(textFieldResultProblems("x", { label: "L", maxLength: 0 })).toHaveLength(1);
    expect(textFieldResultProblems("x", null)).toHaveLength(1);
    expect(textFieldResultProblems("x", { label: "L", maxLength: 5 })).toEqual([]);
    expect(textFieldResultProblems(3, { label: "L" })).toEqual([]);
    expect(fits(item("text-field", "nonsense"), "x")).toBe(false);
  });

  test("the fixtures' results fit their items", () => {
    expect(TEXT_FIELD_RESULTS.length).toBeGreaterThan(0);
    TEXT_FIELD_RESULTS.forEach((result, at) => {
      expect(fits(TEXT_FIELD_FIXTURE_ITEMS[at] ?? short, result)).toBe(true);
    });
  });
});

describe("Toggle results", () => {
  const toggle = item("toggle", { label: "Notify me" }, "notify");

  test("off is an answer: false passes and does not hold nothing", () => {
    expect(resultOf(toggle, false)).toEqual([]);
    expect(resultOf(toggle, true)).toEqual([]);
    expect(resultHoldsNothing(false)).toBe(false);
    expect(resultHoldsNothing(TOGGLE_RESULTS.off)).toBe(false);
    expect(TOGGLE_RESULTS).toEqual({ on: true, off: false });
  });

  test("anything but a boolean is refused, naming the item", () => {
    for (const bad of ["true", "false", 0, 1, null, "", {}, [], undefined]) {
      const found = resultOf(toggle, bad);
      expect(found.length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(found[0]?.message).toContain("item notify");
      expect(fits(toggle, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(toggleResultShape(true)).toBe(true);
    expect(toggleResultShape(false)).toBe(true);
    expect(toggleResultShape("true")).toBe(false);
    expect(fits(toggle, true)).toBe(true);
    expect(fits(toggle, false)).toBe(true);
  });
});
