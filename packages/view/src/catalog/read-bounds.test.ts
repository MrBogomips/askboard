import { describe, expect, test } from "bun:test";
import {
  ATOM_NUMBER_BOUND,
  dateFieldBound,
  dateFieldPropsProblems,
  formatDate,
  formatMoney,
  formatNumber,
  type Locale,
  moneyFieldBound,
  moneyFieldPropsProblems,
  numberFieldBound,
  numberFieldPropsProblems,
  parseAmount,
  parseDate,
  parseNumber,
  plainNumber,
} from "@askboard/contract";
import { readDate } from "./date-field/read.ts";
import { readMoney } from "./money-field/read.ts";
import { readNumber } from "./number-field/read.ts";
import { say } from "./port.ts";

// The atoms' readers on the bound codes (table-widget, task 4.1; design decision 3): for generated
// values, each reader's error is the string the contract's code names, a value that breaks no bound
// is the item's result, and the readers' own tests stand unchanged.

// mulberry32, a small seeded generator: a failing case reports its index, so its run can be replayed.
const generator = (seed: number) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (count: number): number => Math.floor(next() * count);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)] as T;
  return { next, int, pick };
};

const CASES = 1_000;
const LOCALES: readonly Locale[] = ["en-US", "it-IT"];

describe("the NumberField reader's bound words", () => {
  test("1,000 generated values: the error is the string the code names", () => {
    const random = generator(0xa11ce);
    const seen = { whole: 0, min: 0, max: 0, step: 0, none: 0 };
    let index = 0;
    while (index < CASES) {
      const props: Record<string, unknown> = { label: "L" };
      const min = random.pick([undefined, -10, 0, 0.5, 1]);
      const max = random.pick([undefined, 10, 100, 0.75]);
      const step = random.pick([undefined, 1, 2, 0.1, 0.25, 3, 100]);
      if (min !== undefined) props.min = min;
      if (max !== undefined) props.max = max;
      if (step !== undefined) props.step = step;
      if (random.int(3) === 0) props.integer = true;
      if (numberFieldPropsProblems(props).length > 0) continue;
      const locale = random.pick(LOCALES);
      const language = random.pick(LOCALES);
      const from = min ?? 0;
      const k = random.int(20) - 5;
      const typed = plainNumber(
        random.pick([
          from + k * (step ?? 1),
          from + k * (step ?? 1) + (step ?? 1) / 2,
          Math.round((random.next() * 200 - 100) * 100) / 100,
          Math.round(random.next() * 200 - 100),
        ]),
        locale,
      );
      const parsed = parseNumber(typed, locale, language);
      if (parsed.kind !== "number") continue;
      index++;
      const code = numberFieldBound(parsed.value, props);
      const reading = readNumber(typed, props as never, locale, language);
      if (code === undefined) {
        seen.none++;
        expect([index, typed, reading]).toEqual([
          index,
          typed,
          { kind: "value", value: parsed.value },
        ]);
        continue;
      }
      seen[code]++;
      const words = {
        whole: () => say(language, "field.whole"),
        min: () =>
          say(language, "field.atLeast", {
            min: formatNumber((props.min as number | undefined) ?? -ATOM_NUMBER_BOUND, locale),
          }),
        max: () =>
          say(language, "field.atMost", {
            max: formatNumber((props.max as number | undefined) ?? ATOM_NUMBER_BOUND, locale),
          }),
        step: () =>
          say(language, "field.step", {
            step: formatNumber((props.step as number | undefined) ?? 1, locale),
            base: formatNumber((props.min as number | undefined) ?? 0, locale),
          }),
      };
      expect([index, typed, props, reading.kind === "entry" && reading.error]).toEqual([
        index,
        typed,
        props,
        words[code](),
      ]);
    }
    for (const [name, count] of Object.entries(seen))
      expect([name, count > 10]).toEqual([name, true]);
  });

  test("a number past the contract's own bound is refused as the parser or the bound does", () => {
    const text = plainNumber(ATOM_NUMBER_BOUND, "en-US");
    const reading = readNumber(`${text}0`, { label: "L" }, "en-US", "en-US");
    expect(reading.kind).toBe("entry");
  });
});

describe("the MoneyField reader's bound words", () => {
  const places = { JPY: 0, USD: 2, BHD: 3 } as const;

  test("1,000 generated amounts: the error is the string the code names, JPY, USD and BHD", () => {
    const random = generator(0xbeef);
    const seen = { min: 0, max: 0, none: 0 };
    const text = (code: keyof typeof places, whole: number): string => {
      const decimals = places[code];
      if (decimals === 0) return String(whole);
      return `${whole}.${String(random.int(10 ** decimals)).padStart(decimals, "0")}`;
    };
    let index = 0;
    while (index < CASES) {
      const currency = random.pick(["JPY", "USD", "BHD"] as const);
      const props: Record<string, unknown> = { label: "L", currency };
      const low = random.int(100) - 50;
      const high = low + random.int(100);
      if (random.int(4) > 0) props.min = text(currency, low);
      if (random.int(4) > 0) props.max = text(currency, high);
      if (moneyFieldPropsProblems(props).length > 0) continue;
      const locale = random.pick(LOCALES);
      const language = random.pick(LOCALES);
      const typed = text(
        currency,
        random.pick([low - 1, low, high, high + 1, random.int(200) - 100]),
      );
      const parsed = parseAmount(typed, currency, "en-US", language);
      if (parsed.kind !== "amount") continue;
      // The text is typed in en-US plain form; the language only words the error.
      index++;
      const code = moneyFieldBound(parsed.amount, props);
      const reading = readMoney(typed, currency, props as never, "en-US", language);
      if (code === undefined) {
        seen.none++;
        expect([index, typed, reading]).toEqual([
          index,
          typed,
          { kind: "value", result: { amount: parsed.amount, currency } },
        ]);
        continue;
      }
      seen[code]++;
      const expected =
        code === "min"
          ? say(language, "field.atLeast", {
              min: formatMoney(props.min as string, currency, "en-US"),
            })
          : say(language, "field.atMost", {
              max: formatMoney(props.max as string, currency, "en-US"),
            });
      expect([index, typed, props, reading.kind === "entry" && reading.error]).toEqual([
        index,
        typed,
        props,
        expected,
      ]);
    }
    for (const [name, count] of Object.entries(seen))
      expect([name, count > 10]).toEqual([name, true]);
  });
});

describe("the DateField reader's bound words", () => {
  test("1,000 generated days: the error is the string the code names", () => {
    const random = generator(0xda7e);
    const seen = { min: 0, max: 0, none: 0 };
    const day = (offset: number): string => {
      const date = new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000);
      return date.toISOString().slice(0, 10);
    };
    let index = 0;
    while (index < CASES) {
      const props: Record<string, unknown> = { label: "L" };
      const low = random.int(200);
      const high = low + random.int(200);
      if (random.int(4) > 0) props.min = day(low);
      if (random.int(4) > 0) props.max = day(high);
      if (dateFieldPropsProblems(props).length > 0) continue;
      const locale = random.pick(LOCALES);
      const language = random.pick(LOCALES);
      const date = day(random.pick([low - 1, low, high, high + 1, random.int(400) - 100]));
      const typed = formatDate(date, locale);
      const parsed = parseDate(typed, locale, language);
      if (parsed.kind !== "date") continue;
      index++;
      const code = dateFieldBound(parsed.date, props);
      const reading = readDate(typed, props as never, locale, language);
      if (code === undefined) {
        seen.none++;
        expect([index, typed, reading]).toEqual([
          index,
          typed,
          { kind: "value", date: parsed.date },
        ]);
        continue;
      }
      seen[code]++;
      const expected =
        code === "min"
          ? say(language, "field.onOrAfter", { date: formatDate(props.min as string, locale) })
          : say(language, "field.onOrBefore", { date: formatDate(props.max as string, locale) });
      expect([index, typed, props, reading.kind === "entry" && reading.error]).toEqual([
        index,
        typed,
        props,
        expected,
      ]);
    }
    for (const [name, count] of Object.entries(seen))
      expect([name, count > 10]).toEqual([name, true]);
  });
});
