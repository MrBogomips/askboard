// The display atoms' entries (atoms, task 1.2; contract spec: Text items, Value items, Divider
// items, Atom types in the registry, Atom labels and descriptions), composed over the shipped
// registry with `withWidgetTypes(...ATOM_TYPES)` while the types are not registered (design
// decision 10), so that the same tests pass after they join `WIDGET_TYPES`.

import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  DIVIDER_FIXTURE_ITEM,
  TEXT_FIXTURE_ITEMS,
  VALUE_FIXTURE_ITEMS,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  AMOUNT_PATTERN,
  DIVIDER_WIDGET,
  dividerPropsProblems,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  TEXT_MAX_CHARS,
  TEXT_WIDGET,
  textPropsProblems,
  VALUE_FIELDS,
  VALUE_KIND_FIELDS,
  VALUE_KINDS,
  VALUE_MAX_DAYS,
  VALUE_WIDGET,
  type ValueKind,
  valuePropsProblems,
  widgetRegistryProblems,
  widgetResultProblems,
} from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { askAccepted, type Item, question } from "./result-widgets-support.ts";

const TYPES = withWidgetTypes(...ATOM_TYPES);
const item = (type: string, props: unknown, id = "atom"): Item => ({ type, id, props });
const problemsOf = (it: Item) => widgetItemProblems(it, question(it), "agent", TYPES);
const pathsOf = (it: Item) => problemsOf(it).map(({ path }) => path);
const passes = (it: Item) => problemsOf(it).length === 0 && askAccepted(TYPES, it);
const refused = (it: Item) => problemsOf(it).length > 0 && !askAccepted(TYPES, it) === true;
// Refused by the entry's checks, which run after a schema that passed (a date that does not exist).
const checkedOnly = (it: Item) => problemsOf(it).length > 0 && askAccepted(TYPES, it);

const points = (count: number, character = "a") => character.repeat(count);

describe("the display atoms in the registry", () => {
  test("hold no result, no edits and no derived values, each with its noun and a teaching use", () => {
    for (const entry of [TEXT_WIDGET, VALUE_WIDGET, DIVIDER_WIDGET]) {
      expect(entry.result).toBeUndefined();
      expect(entry.edits).toBeUndefined();
      expect(entry.derived).toBeUndefined();
      expect(entry.skill?.use.length).toBeGreaterThan(0);
      expect(entry.skill?.use.length).toBeLessThanOrEqual(90);
    }
    expect([TEXT_WIDGET.noun, VALUE_WIDGET.noun, DIVIDER_WIDGET.noun]).toEqual([
      "a Text",
      "a Value",
      "a Divider",
    ]);
  });

  test("the registry that holds them is sound", () => {
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    expect(TYPES.map(({ type }) => type)).toEqual(
      expect.arrayContaining(["text", "value", "divider"]),
    );
  });

  test("each example item passes alone, and the fixtures pass", () => {
    for (const entry of [TEXT_WIDGET, VALUE_WIDGET, DIVIDER_WIDGET]) {
      expect(passes(entry.example.item), entry.type).toBe(true);
    }
    for (const fixture of [...TEXT_FIXTURE_ITEMS, ...VALUE_FIXTURE_ITEMS, DIVIDER_FIXTURE_ITEM]) {
      expect(passes(fixture), fixture.id).toBe(true);
    }
    expect(
      askAccepted(TYPES, ...TEXT_FIXTURE_ITEMS, ...VALUE_FIXTURE_ITEMS, DIVIDER_FIXTURE_ITEM),
    ).toBe(true);
  });

  test("the schemas' limits are the constants'", () => {
    const text = TEXT_WIDGET.props.properties.text;
    expect(text.maxLength).toBe(TEXT_MAX_CHARS);
    expect(VALUE_WIDGET.props.properties.amount.pattern).toBe(AMOUNT_PATTERN.source);
    expect(VALUE_WIDGET.props.properties.days.maximum).toBe(VALUE_MAX_DAYS);
    expect(Object.keys(VALUE_WIDGET.props.properties).sort()).toEqual(
      ["kind", "label", ...VALUE_FIELDS].sort(),
    );
    expect(VALUE_WIDGET.props.properties.kind.enum).toEqual([...VALUE_KINDS]);
  });

  test("every field of a props schema has wording, and the wording names no other", () => {
    for (const entry of [TEXT_WIDGET, VALUE_WIDGET, DIVIDER_WIDGET]) {
      const keys = Object.keys(entry.props.properties).map((key) => `${entry.type}.props.${key}`);
      for (const key of keys) expect(entry.wording.expected[key], key).toBeDefined();
      expect(entry.wording.expected[`${entry.type}.props`]).toBeDefined();
      expect(entry.wording.fields[`${entry.type}.props`]).toBeDefined();
      expect(Object.keys(entry.wording.expected).length).toBe(keys.length + 1);
    }
  });

  test("their schemas carry the ID the registry expects and name this change, never a number", () => {
    for (const entry of [TEXT_WIDGET, VALUE_WIDGET, DIVIDER_WIDGET]) {
      expect(entry.props.$id).toBe(`urn:askboard:input:${entry.type}-props`);
      expect(entry.props.description).toEndWith("In the input format since atoms.");
    }
  });
});

describe("Text items", () => {
  test("bounds: 10,000 code points pass, 10,001, an empty text and format html fail", () => {
    expect(passes(item("text", { text: points(TEXT_MAX_CHARS) }))).toBe(true);
    expect(refused(item("text", { text: points(TEXT_MAX_CHARS + 1) }))).toBe(true);
    expect(refused(item("text", { text: "" }))).toBe(true);
    expect(refused(item("text", { text: "x", format: "html" }))).toBe(true);
    expect(pathsOf(item("text", { text: "x", format: "html" }))).toEqual(["/format"]);
    expect(pathsOf(item("text", { text: "" }))).toEqual(["/text"]);
  });

  test("a code point counts once, an astral character included", () => {
    expect(passes(item("text", { text: points(TEXT_MAX_CHARS, "😀") }))).toBe(true);
    expect(refused(item("text", { text: points(TEXT_MAX_CHARS + 1, "😀") }))).toBe(true);
    expect(textPropsProblems({ text: points(TEXT_MAX_CHARS, "😀") })).toEqual([]);
    expect(textPropsProblems({ text: points(TEXT_MAX_CHARS + 1, "😀") })).toHaveLength(1);
  });

  test("both formats pass, and nothing else is a field", () => {
    expect(passes(item("text", { text: "x", format: "plain" }))).toBe(true);
    expect(passes(item("text", { text: "# x", format: "markdown" }))).toBe(true);
    expect(refused(item("text", { text: "x", label: "y" }))).toBe(true);
    expect(refused(item("text", {}))).toBe(true);
    expect(refused(item("text", "x"))).toBe(true);
  });

  test("the restated check agrees with the schema on bad props", () => {
    expect(textPropsProblems("x").map(({ path }) => path)).toEqual(["/"]);
    expect(textPropsProblems({ text: 3 }).map(({ path }) => path)).toEqual(["/text"]);
    expect(textPropsProblems({ text: "x", other: 1 }).map(({ path }) => path)).toEqual(["/other"]);
    expect(textPropsProblems({ text: "x", format: "html" }).map(({ path }) => path)).toEqual([
      "/format",
    ]);
    expect(textPropsProblems({ text: "" })[0]?.message).toContain("0 characters");
  });
});

describe("Value items", () => {
  const GOOD: Record<ValueKind, Record<string, unknown>> = {
    number: { kind: "number", value: 12, unit: "kg" },
    percent: { kind: "percent", value: 0.185 },
    money: { kind: "money", amount: "12480.50", currency: "EUR" },
    date: { kind: "date", date: "2026-12-09" },
    duration: { kind: "duration", days: 12 },
  };
  const OTHER_FIELDS: Record<string, unknown> = {
    value: 1,
    unit: "kg",
    amount: "1.00",
    currency: "EUR",
    date: "2026-12-09",
    days: 3,
  };

  test("each kind passes with its fields, with and without a label", () => {
    for (const kind of VALUE_KINDS) {
      expect(passes(item("value", GOOD[kind])), kind).toBe(true);
      expect(passes(item("value", { ...GOOD[kind], label: "A label" })), kind).toBe(true);
    }
    expect(passes(item("value", { kind: "number", value: 0 }))).toBe(true);
  });

  test("a field of another kind fails, naming it, for every kind and every other field", () => {
    for (const kind of VALUE_KINDS) {
      for (const field of VALUE_FIELDS) {
        if (VALUE_KIND_FIELDS[kind].includes(field)) continue;
        const props = { ...GOOD[kind], [field]: OTHER_FIELDS[field] };
        expect(refused(item("value", props)), `${kind} with ${field}`).toBe(true);
        expect(pathsOf(item("value", props)), `${kind} with ${field}`).toContain(`/${field}`);
        expect(valuePropsProblems(props).map(({ path }) => path)).toEqual([`/${field}`]);
      }
    }
  });

  test("a required field missing fails, naming it", () => {
    expect(refused(item("value", { kind: "money", amount: "1.00" }))).toBe(true);
    expect(pathsOf(item("value", { kind: "money", amount: "1.00" }))).toContain("/currency");
    expect(valuePropsProblems({ kind: "money", amount: "1.00" }).map(({ path }) => path)).toEqual([
      "/currency",
    ]);
    for (const kind of VALUE_KINDS) {
      expect(refused(item("value", { kind })), kind).toBe(true);
      expect(valuePropsProblems({ kind }).length, kind).toBeGreaterThan(0);
    }
    expect(refused(item("value", { value: 1 }))).toBe(true);
    expect(refused(item("value", { kind: "weight", value: 1 }))).toBe(true);
    expect(valuePropsProblems({ kind: "weight" }).map(({ path }) => path)).toEqual(["/kind"]);
  });

  test("a percent holding a unit fails, a money without a currency fails, 2026-02-30 fails", () => {
    expect(refused(item("value", { kind: "percent", value: 1, unit: "%" }))).toBe(true);
    expect(refused(item("value", { kind: "money", amount: "5.00" }))).toBe(true);
    // The pattern lets 2026-02-30 through: the entry's check refuses it.
    expect(checkedOnly(item("value", { kind: "date", date: "2026-02-30" }))).toBe(true);
    expect(pathsOf(item("value", { kind: "date", date: "2026-02-30" }))).toEqual(["/date"]);
  });

  test("a money Value's amount is a decimal string: 1e3, 5 decimals, 16 digits, leading zeros fail", () => {
    const amount = (text: unknown) =>
      item("value", { kind: "money", amount: text, currency: "EUR" });
    expect(refused(amount("1e3"))).toBe(true);
    expect(refused(amount("1.23456"))).toBe(true);
    expect(refused(amount("1000000000000000"))).toBe(true);
    expect(refused(amount("007"))).toBe(true);
    expect(refused(amount("+5"))).toBe(true);
    expect(refused(amount(12))).toBe(true);
    for (const good of ["0", "-0.5", "999999999999999", "999999999999999.99", "12"]) {
      expect(passes(amount(good)), good).toBe(true);
    }
    // Four decimals belong to the currencies that take four (CLF), no other.
    expect(
      passes(item("value", { kind: "money", amount: "999999999999999.9999", currency: "CLF" })),
    ).toBe(true);
    expect(valuePropsProblems({ kind: "money", amount: "1e3", currency: "EUR" })).toHaveLength(1);
  });

  test("a money Value's amount is within its currency's minor units: 0.5 JPY and -0.004 EUR fail naming amount, 12480 JPY and -0.01 EUR pass", () => {
    const money = (amount: string, currency: string) =>
      item("value", { kind: "money", amount, currency });
    for (const [amount, currency] of [
      ["0.5", "JPY"],
      ["-0.004", "EUR"],
      ["0.005", "EUR"],
      ["1.2345", "KWD"],
    ] as const) {
      const bad = money(amount, currency);
      // The schema lets four decimals through whatever the currency; the entry's checks refuse.
      expect(checkedOnly(bad), `${amount} ${currency}`).toBe(true);
      expect(pathsOf(bad), `${amount} ${currency}`).toContain("/amount");
      expect(
        valuePropsProblems({ kind: "money", amount, currency }).map(({ path }) => path),
      ).toEqual(["/amount"]);
      expect(problemsOf(bad)[0]?.message).toContain(currency);
    }
    for (const [amount, currency] of [
      ["12480", "JPY"],
      ["-0.01", "EUR"],
      ["1.234", "KWD"],
      ["0.5", "XYZ"],
    ] as const) {
      expect(passes(money(amount, currency)), `${amount} ${currency}`).toBe(true);
    }
  });

  test("the currency is three capital letters", () => {
    const currency = (code: unknown) =>
      item("value", { kind: "money", amount: "1.00", currency: code });
    expect(passes(currency("XYZ"))).toBe(true);
    for (const bad of ["eur", "EU", "EURO", "E1R", ""])
      expect(refused(currency(bad)), bad).toBe(true);
    expect(valuePropsProblems({ kind: "money", amount: "1", currency: "eur" })).toHaveLength(1);
  });

  test("a number or percent is within a quadrillion either way, and finite", () => {
    for (const kind of ["number", "percent"] as const) {
      const value = (number: unknown) => item("value", { kind, value: number });
      expect(passes(value(1_000_000_000_000_000))).toBe(true);
      expect(passes(value(-1_000_000_000_000_000))).toBe(true);
      expect(refused(value(1_000_000_000_000_001))).toBe(true);
      expect(refused(value(-1_000_000_000_000_001))).toBe(true);
      expect(refused(value("12"))).toBe(true);
      expect(valuePropsProblems({ kind, value: 1_000_000_000_000_001 })).toHaveLength(1);
      expect(valuePropsProblems({ kind, value: Number.NaN })).toHaveLength(1);
    }
  });

  test("the unit, and the label, bound in code points", () => {
    const unit = (text: string) => item("value", { kind: "number", value: 1, unit: text });
    expect(passes(unit(points(20, "😀")))).toBe(true);
    expect(refused(unit(points(21, "😀")))).toBe(true);
    expect(refused(unit(""))).toBe(true);
    const label = (text: string) => item("value", { kind: "number", value: 1, label: text });
    expect(passes(label(points(200, "😀")))).toBe(true);
    expect(refused(label(points(201, "😀")))).toBe(true);
    expect(refused(label(""))).toBe(true);
    expect(valuePropsProblems({ kind: "number", value: 1, label: points(201) })).toHaveLength(1);
    expect(valuePropsProblems({ kind: "number", value: 1, unit: points(21) })).toHaveLength(1);
  });

  test("a date is within the Gantt's first and last dates", () => {
    const date = (text: unknown) => item("value", { kind: "date", date: text });
    expect(passes(date(GANTT_FIRST_DATE))).toBe(true);
    expect(passes(date(GANTT_LAST_DATE))).toBe(true);
    expect(checkedOnly(date("1900-03-01"))).toBe(true);
    expect(refused(date("10000-01-01"))).toBe(true);
    expect(refused(date("2026-1-5"))).toBe(true);
    expect(refused(date("2026-13-01"))).toBe(true);
    expect(
      valuePropsProblems({ kind: "date", date: "1900-03-01" }).map(({ path }) => path),
    ).toEqual(["/date"]);
  });

  test("days are whole, from 0 to 100,000", () => {
    const days = (count: unknown) => item("value", { kind: "duration", days: count });
    expect(passes(days(0))).toBe(true);
    expect(passes(days(100_000))).toBe(true);
    expect(passes(days(2.0))).toBe(true);
    for (const bad of [100_001, -1, 1.5, "3", null])
      expect(refused(days(bad)), String(bad)).toBe(true);
    expect(VALUE_MAX_DAYS).toBe(100_000);
    expect(valuePropsProblems({ kind: "duration", days: 1.5 })).toHaveLength(1);
    expect(valuePropsProblems("x").map(({ path }) => path)).toEqual(["/"]);
    expect(
      valuePropsProblems({ kind: "duration", days: 1, extra: 1 }).map(({ path }) => path),
    ).toEqual(["/extra"]);
  });
});

describe("Divider items", () => {
  test("an empty props object passes, any field fails, naming it", () => {
    expect(passes(item("divider", {}))).toBe(true);
    expect(refused(item("divider", { label: "x" }))).toBe(true);
    expect(pathsOf(item("divider", { label: "x" }))).toEqual(["/label"]);
    expect(dividerPropsProblems({ label: "x" }).map(({ path }) => path)).toEqual(["/label"]);
    expect(dividerPropsProblems({})).toEqual([]);
    expect(dividerPropsProblems(null).map(({ path }) => path)).toEqual(["/"]);
    expect(refused(item("divider", []))).toBe(true);
  });
});

describe("a display atom gives no result", () => {
  test("a result for each is refused, naming the item and saying the type gives none", () => {
    const cases: readonly [Item, unknown][] = [
      [item("text", { text: "x" }, "intro"), "answer"],
      [item("value", { kind: "number", value: 1 }, "figure"), 1],
      [item("divider", {}, "rule"), true],
    ];
    for (const [it, result] of cases) {
      const found = widgetResultProblems(it, result, it.props, TYPES);
      expect(found).toHaveLength(1);
      const noun = it.type === "text" ? "a Text" : it.type === "value" ? "a Value" : "a Divider";
      expect(found[0]?.message).toBe(`item ${it.id} is ${noun}, and ${noun} gives no result`);
    }
  });
});
