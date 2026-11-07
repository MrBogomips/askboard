// The MoneyField (atoms, task 1.5; contract spec: MoneyField items and results, Atom types in the
// registry), composed over the shipped registry with `withWidgetTypes(...ATOM_TYPES)` while the type
// is not registered (design decision 10).

import { describe, expect, test } from "bun:test";
import {
  ATOM_TYPES,
  DATE_FIELD_FIXTURE_ITEMS,
  DIVIDER_FIXTURE_ITEM,
  MONEY_FIELD_FIXTURE_ITEMS,
  MONEY_FIELD_RESULTS,
  NUMBER_FIELD_FIXTURE_ITEMS,
  TEXT_FIELD_FIXTURE_ITEMS,
  TEXT_FIXTURE_ITEMS,
  TOGGLE_FIXTURE_ITEM,
  VALUE_FIXTURE_ITEMS,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  AMOUNT_PATTERN,
  ATOM_LABEL_MAX_CHARS,
  MONEY_FIELD_MAX_CURRENCIES,
  MONEY_FIELD_MIN_CURRENCIES,
  MONEY_FIELD_WIDGET,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
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
const checkedOnly = (it: Item) => problemsOf(it).length > 0 && askAccepted(TYPES, it);
const money = (props: Record<string, unknown>, id = "budget") =>
  item("money-field", { label: "Budget", ...props }, id);
const resultOf = (it: Item, result: unknown) => widgetResultProblems(it, result, it.props, TYPES);
const fits = (it: Item, result: unknown) => widgetResultFits(it, result, it.props, TYPES);
const euros = money({ currency: "EUR", min: "0" });
const eur = (amount: string) => ({ amount, currency: "EUR" });
const CODES = ["EUR", "USD", "GBP", "JPY", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"];

describe("the MoneyField in the registry", () => {
  test("holds a result and nothing else, and the registry that holds it is sound", () => {
    const entry = MONEY_FIELD_WIDGET;
    expect(entry.result?.schema.$id).toBe("urn:askboard:output:money-field-result");
    expect(entry.result?.shape).toBeFunction();
    expect(entry.edits).toBeUndefined();
    expect(entry.derived).toBeUndefined();
    expect(entry.noun).toBe("a MoneyField");
    expect(entry.skill?.use.length).toBeLessThanOrEqual(90);
    expect(entry.props.$id).toBe("urn:askboard:input:money-field-props");
    expect(entry.props.description).toEndWith("In the input format since atoms.");
    expect(entry.result?.schema.description).toEndWith("In the output format since atoms.");
    expect(widgetRegistryProblems(TYPES)).toEqual([]);
    const order = ATOM_TYPES.map(({ type }) => type);
    expect(order.slice(3)).toEqual([
      "text-field",
      "number-field",
      "money-field",
      "date-field",
      "toggle",
    ]);
  });

  test("the schemas' patterns are the amount pattern", () => {
    expect(MONEY_FIELD_WIDGET.props.properties.min.pattern).toBe(AMOUNT_PATTERN.source);
    expect(MONEY_FIELD_WIDGET.props.properties.max.pattern).toBe(AMOUNT_PATTERN.source);
    expect(MONEY_FIELD_WIDGET.result?.schema.properties.amount.pattern).toBe(AMOUNT_PATTERN.source);
    expect(MONEY_FIELD_WIDGET.props.properties.currencies.minItems).toBe(
      MONEY_FIELD_MIN_CURRENCIES,
    );
    expect(MONEY_FIELD_WIDGET.props.properties.currencies.maxItems).toBe(
      MONEY_FIELD_MAX_CURRENCIES,
    );
  });

  test("every field of the props schema has wording, the codes of a list included", () => {
    const entry = MONEY_FIELD_WIDGET;
    const keys = Object.keys(entry.props.properties).map((key) => `money-field.props.${key}`);
    for (const key of [...keys, "money-field.props", "money-field.props.currencies[]"]) {
      expect(entry.wording.expected[key], key).toBeDefined();
    }
    expect(Object.keys(entry.wording.expected).length).toBe(keys.length + 2);
    expect(entry.wording.fields["money-field.props"]).toBeDefined();
  });

  test("the example item and the fixtures pass, and each fixture's result fits it", () => {
    expect(passes(MONEY_FIELD_WIDGET.example.item)).toBe(true);
    for (const fixture of MONEY_FIELD_FIXTURE_ITEMS) expect(passes(fixture), fixture.id).toBe(true);
    MONEY_FIELD_RESULTS.forEach((result, at) => {
      expect(fits(MONEY_FIELD_FIXTURE_ITEMS[at] as Item, result)).toBe(true);
    });
  });

  test("a label of 200 code points passes and 201 fails, a description of 1,000 and 1,001 likewise", () => {
    const label = (text: string) => money({ currency: "EUR", label: text }, "who");
    expect(passes(label("😀".repeat(ATOM_LABEL_MAX_CHARS)))).toBe(true);
    expect(refused(label("a".repeat(ATOM_LABEL_MAX_CHARS + 1)))).toBe(true);
    expect(pathsOf(label("a".repeat(ATOM_LABEL_MAX_CHARS + 1)))).toEqual(["/label"]);
    const described = (text: string) => money({ currency: "EUR", description: text });
    expect(passes(described("😀".repeat(1000)))).toBe(true);
    expect(refused(described("a".repeat(1001)))).toBe(true);
    expect(refused(described(""))).toBe(true);
    expect(refused(item("money-field", { currency: "EUR" }))).toBe(true);
  });
});

describe("a question built from atoms", () => {
  test("a Text, a TextField, a NumberField, a MoneyField, a DateField, a Toggle, a Divider and a Value pass, with no options", () => {
    const items = [
      TEXT_FIXTURE_ITEMS[0],
      TEXT_FIELD_FIXTURE_ITEMS[0],
      NUMBER_FIELD_FIXTURE_ITEMS[0],
      MONEY_FIELD_FIXTURE_ITEMS[0],
      DATE_FIELD_FIXTURE_ITEMS[0],
      TOGGLE_FIXTURE_ITEM,
      DIVIDER_FIXTURE_ITEM,
      VALUE_FIXTURE_ITEMS[0],
    ] as readonly Item[];
    expect(askAccepted(TYPES, ...items)).toBe(true);
    for (const entry of ATOM_TYPES) {
      expect(passes(entry.example.item), entry.type).toBe(true);
    }
    expect(ATOM_TYPES).toHaveLength(8);
  });
});

describe("MoneyField items", () => {
  test("exactly one of currency and currencies: either passes; both, neither fail, naming a field", () => {
    expect(passes(money({ currency: "EUR" }))).toBe(true);
    expect(passes(money({ currencies: ["EUR", "USD"] }))).toBe(true);
    const both = money({ currency: "EUR", currencies: ["EUR", "USD"] });
    expect(checkedOnly(both)).toBe(true);
    expect(pathsOf(both)).toEqual(["/currencies"]);
    const neither = money({});
    expect(checkedOnly(neither)).toBe(true);
    expect(pathsOf(neither)).toEqual(["/currency"]);
    expect(moneyFieldPropsProblems({ label: "L" }).map(({ path }) => path)).toEqual(["/currency"]);
    expect(
      moneyFieldPropsProblems({ label: "L", currency: "EUR", currencies: ["EUR", "USD"] }).map(
        ({ path }) => path,
      ),
    ).toEqual(["/currencies"]);
  });

  test("currencies holds 2 to 10 unique codes: one, a duplicate and 11 fail", () => {
    expect(passes(money({ currencies: CODES.slice(0, 2) }))).toBe(true);
    expect(passes(money({ currencies: CODES.slice(0, 10) }))).toBe(true);
    expect(refused(money({ currencies: ["EUR"] }))).toBe(true);
    expect(refused(money({ currencies: [] }))).toBe(true);
    expect(refused(money({ currencies: ["EUR", "EUR"] }))).toBe(true);
    expect(refused(money({ currencies: CODES.slice(0, 11) }))).toBe(true);
    expect(pathsOf(money({ currencies: ["EUR"] }))).toEqual(["/currencies"]);
    expect(pathsOf(money({ currencies: ["EUR", "EUR"] }))).toEqual(["/currencies"]);
    expect(pathsOf(money({ currencies: CODES.slice(0, 11) }))).toEqual(["/currencies"]);
    const fields = (props: Record<string, unknown>) =>
      moneyFieldPropsProblems({ label: "L", ...props }).map(({ path }) => path);
    expect(fields({ currencies: ["EUR"] })).toEqual(["/currencies"]);
    expect(fields({ currencies: ["EUR", "EUR"] })).toEqual(["/currencies"]);
    expect(fields({ currencies: CODES.slice(0, 11) })).toEqual(["/currencies"]);
    expect(fields({ currencies: "EUR" })).toEqual(["/currencies"]);
    expect(fields({ currencies: ["EUR", "usd"] })).toEqual(["/currencies/1"]);
  });

  test("a currency is three capital letters, in either field", () => {
    for (const bad of ["eur", "EU", "EURO", "E1R", "", 3]) {
      expect(refused(money({ currency: bad })), String(bad)).toBe(true);
      expect(moneyFieldPropsProblems({ label: "L", currency: bad })).toHaveLength(1);
    }
    expect(refused(money({ currencies: ["EUR", "usd"] }))).toBe(true);
    expect(passes(money({ currency: "XYZ" }))).toBe(true);
  });

  test("min and max are decimal strings: 15 digits pass, 16, an exponent and a number fail", () => {
    expect(
      passes(money({ currency: "EUR", min: "-999999999999999.99", max: "999999999999999" })),
    ).toBe(true);
    for (const bad of ["1000000000000000", "1e3", "007", "1.23456", 5, ""]) {
      expect(refused(money({ currency: "EUR", min: bad })), String(bad)).toBe(true);
      expect(refused(money({ currency: "EUR", max: bad })), String(bad)).toBe(true);
    }
    expect(
      moneyFieldPropsProblems({ label: "L", currency: "EUR", min: "1e3" }).map(({ path }) => path),
    ).toEqual(["/min"]);
    expect(
      moneyFieldPropsProblems({ label: "L", currency: "EUR", max: 5 }).map(({ path }) => path),
    ).toEqual(["/max"]);
  });

  test("min above max fails, naming max; equal bounds pass, compared as decimals", () => {
    expect(checkedOnly(money({ currency: "EUR", min: "10", max: "9.99" }))).toBe(true);
    expect(pathsOf(money({ currency: "EUR", min: "10", max: "9.99" }))).toEqual(["/max"]);
    expect(
      pathsOf(money({ currency: "EUR", min: "999999999999999.99", max: "999999999999999.98" })),
    ).toEqual(["/max"]);
    expect(passes(money({ currency: "EUR", min: "10", max: "10.00" }))).toBe(true);
    expect(passes(money({ currency: "EUR", min: "-5", max: "-4.5" }))).toBe(true);
    expect(pathsOf(money({ currency: "EUR", min: "-4.5", max: "-5" }))).toEqual(["/max"]);
  });

  // Review 1.8 U-2: the schema takes four decimals in a bound whatever the currency, so a bound the
  // currency cannot express was accepted and its field error read "At most 0.01" while 0.01 failed.
  test("min and max take at most the currency's minor units: more decimals fail, naming the bound and the currency", () => {
    const eurMax = money({ currency: "EUR", max: "0.005" });
    expect(checkedOnly(eurMax)).toBe(true);
    expect(pathsOf(eurMax)).toEqual(["/max"]);
    const message = problemsOf(eurMax)[0]?.message ?? "";
    expect(message).toContain("max");
    expect(message).toContain("0.005");
    expect(message).toContain("EUR");
    const mixed = money({ currencies: ["EUR", "JPY"], min: "0.5", max: "0.9" });
    expect(checkedOnly(mixed)).toBe(true);
    expect(pathsOf(mixed)).toEqual(["/min", "/max"]);
    expect(problemsOf(mixed)[0]?.message).toContain("JPY");
    expect(pathsOf(money({ currency: "JPY", min: "1.5" }))).toEqual(["/min"]);
    expect(pathsOf(money({ currency: "XYZ", max: "1.234" }))).toEqual(["/max"]);
    expect(pathsOf(money({ currencies: ["EUR", "USD"], min: "-0.005" }))).toEqual(["/min"]);
  });

  test("a bound the currencies can all express passes, trailing zeros as typed counting as decimals", () => {
    for (const props of [
      { currency: "EUR", min: "0", max: "99.99" },
      { currency: "EUR", max: "10" },
      { currency: "JPY", min: "0", max: "1500" },
      { currencies: ["EUR", "JPY"], min: "1", max: "900" },
      { currencies: ["EUR", "USD"], min: "-5.5", max: "0.01" },
      { currency: "XYZ", max: "12.34" },
    ]) {
      expect(passes(money(props)), JSON.stringify(props)).toBe(true);
    }
    // A zero fraction still has decimals the currency cannot express: the parser refuses `1500.0` too.
    expect(pathsOf(money({ currency: "JPY", max: "1500.0" }))).toEqual(["/max"]);
    expect(pathsOf(money({ currency: "EUR", max: "9.990" }))).toEqual(["/max"]);
  });

  test("a result is refused against props whose bound the currency cannot express", () => {
    const props = money({ currency: "EUR", max: "0.005" });
    expect(resultOf(props, eur("0.00")).length).toBeGreaterThan(0);
    expect(fits(props, eur("0.00"))).toBe(false);
  });

  test("a field of no kind, a missing label and a non-object are refused", () => {
    expect(refused(money({ currency: "EUR", other: 1 }))).toBe(true);
    expect(
      moneyFieldPropsProblems({ label: "L", currency: "EUR", other: 1 }).map(({ path }) => path),
    ).toEqual(["/other"]);
    expect(moneyFieldPropsProblems(null).map(({ path }) => path)).toEqual(["/"]);
    expect(moneyFieldPropsProblems({ currency: "EUR" }).map(({ path }) => path)).toEqual([
      "/label",
    ]);
    expect(
      moneyFieldPropsProblems({ label: "L", currency: "EUR", description: "" }).map(
        ({ path }) => path,
      ),
    ).toEqual(["/description"]);
  });
});

describe("MoneyField results", () => {
  test("a fixed currency: the amount passes; three decimals, below min and another currency fail, naming the item and the cause", () => {
    expect(resultOf(euros, eur("12480.50"))).toEqual([]);
    const decimals = resultOf(euros, eur("12480.505"));
    expect(decimals).toHaveLength(1);
    expect(decimals[0]?.message).toContain("item budget");
    expect(decimals[0]?.message).toContain("decimals");
    expect(decimals[0]?.message).toContain("EUR");
    const below = resultOf(euros, eur("-1"));
    expect(below).toHaveLength(1);
    expect(below[0]?.message).toContain("minimum");
    const other = resultOf(euros, { amount: "10", currency: "USD" });
    expect(other).toHaveLength(1);
    expect(other[0]?.message).toContain("currency");
    expect(fits(euros, eur("12480.50"))).toBe(true);
    expect(fits(euros, eur("12480.505"))).toBe(false);
    expect(fits(euros, eur("-1"))).toBe(false);
    expect(fits(euros, { amount: "10", currency: "USD" })).toBe(false);
  });

  test("a currency without minor units: 1500 JPY passes, 1500.5 JPY fails", () => {
    const price = money({ currencies: ["EUR", "JPY"] }, "price");
    expect(resultOf(price, { amount: "1500", currency: "JPY" })).toEqual([]);
    expect(resultOf(price, { amount: "1500.5", currency: "JPY" })).toHaveLength(1);
    expect(resultOf(price, { amount: "1500.50", currency: "EUR" })).toEqual([]);
    expect(resultOf(price, { amount: "1500", currency: "EUR" })).toEqual([]);
    expect(resultOf(price, { amount: "1", currency: "USD" })).toHaveLength(1);
    expect(fits(price, { amount: "1500.5", currency: "JPY" })).toBe(false);
  });

  test("an unlisted currency takes two decimals", () => {
    const odd = money({ currency: "XYZ" });
    expect(resultOf(odd, { amount: "5.25", currency: "XYZ" })).toEqual([]);
    expect(resultOf(odd, { amount: "5.255", currency: "XYZ" })).toHaveLength(1);
  });

  test("min and max bound the amount as decimals, inclusively, at 15 digits", () => {
    const window = money({ currency: "EUR", min: "-5", max: "999999999999999.99" });
    expect(resultOf(window, eur("-5.00"))).toEqual([]);
    expect(resultOf(window, eur("999999999999999.99"))).toEqual([]);
    expect(resultOf(window, eur("-5.01"))).toHaveLength(1);
    const above = resultOf(
      money({ currency: "EUR", max: "999999999999999.98" }),
      eur("999999999999999.99"),
    );
    expect(above).toHaveLength(1);
    expect(above[0]?.message).toContain("maximum");
  });

  test("an amount of 15 integer digits passes the schema, 16 fail it", () => {
    const open = money({ currency: "EUR" });
    expect(resultOf(open, eur("999999999999999"))).toEqual([]);
    expect(resultOf(open, eur("-999999999999999.99"))).toEqual([]);
    expect(resultOf(open, eur("1000000000000000")).length).toBeGreaterThan(0);
    expect(fits(open, eur("1000000000000000"))).toBe(false);
    expect(moneyFieldResultShape(eur("1000000000000000"))).toBe(false);
  });

  test("a result of the wrong shape holds nothing the user gave and is refused", () => {
    const open = money({ currency: "EUR" });
    for (const bad of [
      "12.50",
      12.5,
      null,
      {},
      [],
      { amount: "12.50" },
      { currency: "EUR" },
      { amount: 12.5, currency: "EUR" },
      { amount: "1e3", currency: "EUR" },
      { amount: "12.50", currency: "eur" },
      { amount: "12.50", currency: "EUR", extra: 1 },
      { amount: "", currency: "EUR" },
    ]) {
      expect(resultOf(open, bad).length, JSON.stringify(bad)).toBeGreaterThan(0);
      expect(fits(open, bad), JSON.stringify(bad)).toBe(false);
    }
    expect(moneyFieldResultShape(eur("1.00"))).toBe(true);
    expect(moneyFieldResultShape({ amount: "1.00" })).toBe(false);
    expect(moneyFieldResultShape(null)).toBe(false);
  });

  test("a result is refused against props that are no MoneyField's", () => {
    expect(moneyFieldResultProblems(eur("1"), { label: "L" })).toHaveLength(1);
    expect(moneyFieldResultProblems(eur("1"), null)).toHaveLength(1);
    expect(
      moneyFieldResultProblems(eur("1"), { label: "L", currency: "EUR", min: "5", max: "1" }),
    ).toHaveLength(1);
    expect(moneyFieldResultProblems("x", { label: "L", currency: "EUR" })).toEqual([]);
    expect(fits(item("money-field", "nonsense"), eur("1"))).toBe(false);
  });
});
