// The atoms' bound codes (table-widget, task 1.1; design decision 3): which bound a value breaks,
// beside each atom's result check, so that the view's readers and the Table's cell reader word one
// rule. The codes give a bound if and only if the result check (with its shape check) refuses the
// value, and the property tests below check that for 1,000 generated values per atom.

import { describe, expect, test } from "bun:test";
import {
  ATOM_NUMBER_BOUND,
  dateFieldBound,
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
  GANTT_FIRST_DATE,
  GANTT_LAST_DATE,
  moneyFieldBound,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
  numberFieldBound,
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
} from "../src/index.ts";

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

describe("numberFieldBound", () => {
  const base = { label: "Seats" };

  test("each code", () => {
    expect(numberFieldBound(2.5, { ...base, integer: true })).toBe("whole");
    expect(numberFieldBound(-1, { ...base, min: 0 })).toBe("min");
    expect(numberFieldBound(11, { ...base, max: 10 })).toBe("max");
    expect(numberFieldBound(3, { ...base, step: 2 })).toBe("step");
  });

  test("a value the check takes gives no code", () => {
    expect(
      numberFieldBound(4, { ...base, min: 0, max: 10, step: 2, integer: true }),
    ).toBeUndefined();
    expect(numberFieldBound(0, base)).toBeUndefined();
    expect(numberFieldBound(0.1 + 0.2, { ...base, step: 0.1 })).toBeUndefined();
  });

  test("the bound that fails first is named: whole, then the minimum, the maximum, the step", () => {
    const all = { ...base, integer: true, min: 1, max: 9, step: 2 };
    expect(numberFieldBound(0.5, all)).toBe("whole");
    expect(numberFieldBound(-3, all)).toBe("min");
    expect(numberFieldBound(11, all)).toBe("max");
    expect(numberFieldBound(4, all)).toBe("step");
  });

  test("a value past the contract's own bound, which the shape check refuses, is below or above it", () => {
    expect(numberFieldBound(-ATOM_NUMBER_BOUND * 2, base)).toBe("min");
    expect(numberFieldBound(ATOM_NUMBER_BOUND * 2, base)).toBe("max");
    expect(numberFieldBound(ATOM_NUMBER_BOUND, base)).toBeUndefined();
  });

  test("a value too large for the step to be told is off the step, as the check says", () => {
    const props = { ...base, min: 0, step: 1 };
    expect(numberFieldBound(ATOM_NUMBER_BOUND, props)).toBe("step");
    expect(numberFieldResultProblems(ATOM_NUMBER_BOUND, props)).not.toEqual([]);
    expect(numberFieldBound(1000, props)).toBeUndefined();
  });

  test("a value or props nothing can be said of give no code", () => {
    expect(numberFieldBound("3", base)).toBeUndefined();
    expect(numberFieldBound(Number.NaN, base)).toBeUndefined();
    expect(numberFieldBound(Number.POSITIVE_INFINITY, base)).toBeUndefined();
    expect(numberFieldBound(3, { min: 0 })).toBeUndefined();
    expect(numberFieldBound(3, null)).toBeUndefined();
    expect(numberFieldBound(3, { ...base, min: 5, max: 1 })).toBeUndefined();
  });

  test("1,000 generated values: a code if and only if the result check refuses, and the code is the first bound", () => {
    const random = generator(0x1a2b3c);
    let refusals = 0;
    let index = 0;
    while (index < CASES) {
      const props: Record<string, unknown> = { label: "L" };
      const min = random.pick([undefined, -10, 0, 0.5, 1, -ATOM_NUMBER_BOUND, 1e14]);
      const max = random.pick([undefined, 10, 100, 0.75, ATOM_NUMBER_BOUND, 1e14 + 3]);
      const step = random.pick([undefined, 1, 2, 0.1, 0.25, 0.5, 3, 1e-6, 100]);
      if (min !== undefined) props.min = min;
      if (max !== undefined) props.max = max;
      if (step !== undefined) props.step = step;
      if (random.int(3) === 0) props.integer = true;
      if (numberFieldPropsProblems(props).length > 0) continue;
      const from = typeof min === "number" ? min : 0;
      const k = random.int(20) - 5;
      const value = random.pick([
        from + k * (step ?? 1),
        from + k * (step ?? 1) + 1e-10,
        from + k * (step ?? 1) + (step ?? 1) / 2,
        from + k * (step ?? 1) - 1e-8,
        random.next() * 200 - 100,
        Math.round(random.next() * 200 - 100),
        ATOM_NUMBER_BOUND - random.int(4),
        -ATOM_NUMBER_BOUND + random.int(4),
        ATOM_NUMBER_BOUND + 1 + random.int(3) * 1e15,
        0.1 + 0.2,
      ]);
      index++;
      const refused =
        !numberFieldResultShape(value) || numberFieldResultProblems(value, props).length > 0;
      const code = numberFieldBound(value, props);
      expect([index, value, props, code !== undefined]).toEqual([index, value, props, refused]);
      if (!refused) continue;
      refusals++;
      const low = (props.min as number | undefined) ?? -ATOM_NUMBER_BOUND;
      const high = (props.max as number | undefined) ?? ATOM_NUMBER_BOUND;
      const first =
        props.integer === true && !Number.isInteger(value)
          ? "whole"
          : value < low
            ? "min"
            : value > high
              ? "max"
              : "step";
      expect([index, value, props, code]).toEqual([index, value, props, first]);
    }
    expect(refusals).toBeGreaterThan(100);
    expect(refusals).toBeLessThan(CASES);
  });
});

describe("moneyFieldBound", () => {
  const usd = { label: "Rate", currency: "USD" };

  test("each code", () => {
    expect(moneyFieldBound("-5.00", { ...usd, min: "0" })).toBe("min");
    expect(moneyFieldBound("100.01", { ...usd, max: "100" })).toBe("max");
  });

  test("an amount the check takes gives no code, and bounds compare as decimals", () => {
    expect(moneyFieldBound("0.10", { ...usd, min: "0.1", max: "0.1000" })).toBeUndefined();
    expect(
      moneyFieldBound("99999999999999.99", { ...usd, max: "99999999999999.99" }),
    ).toBeUndefined();
    expect(moneyFieldBound("1", usd)).toBeUndefined();
  });

  test("an amount that breaks no bound but the currency's minor units gives no code", () => {
    expect(
      moneyFieldResultProblems(
        { amount: "1200.5", currency: "JPY" },
        { label: "Y", currency: "JPY" },
      ),
    ).not.toEqual([]);
    expect(moneyFieldBound("1200.5", { label: "Y", currency: "JPY" })).toBeUndefined();
  });

  test("an amount or props nothing can be said of give no code", () => {
    expect(moneyFieldBound(12, usd)).toBeUndefined();
    expect(moneyFieldBound("12,5", usd)).toBeUndefined();
    expect(moneyFieldBound("1", { label: "Rate" })).toBeUndefined();
    expect(moneyFieldBound("1", null)).toBeUndefined();
  });

  const scaled = (amount: string): bigint => {
    const [whole = "", fraction = ""] = amount.replace("-", "").split(".");
    const value = BigInt(whole + fraction.padEnd(4, "0"));
    return amount.startsWith("-") ? -value : value;
  };

  test("1,000 generated amounts: a code if and only if the check refuses for a bound, in JPY, USD and BHD", () => {
    const random = generator(0x5eed);
    const places = { JPY: 0, USD: 2, BHD: 3 } as const;
    const text = (code: keyof typeof places, whole: number): string => {
      const decimals = places[code];
      if (decimals === 0) return String(whole);
      return `${whole}.${String(random.int(10 ** decimals)).padStart(decimals, "0")}`;
    };
    let bounded = 0;
    let index = 0;
    while (index < CASES) {
      const code = random.pick(["JPY", "USD", "BHD"] as const);
      const props: Record<string, unknown> = { label: "L", currency: code };
      const lowWhole = random.int(100) - 50;
      const highWhole = lowWhole + random.int(100);
      if (random.int(4) > 0) props.min = text(code, lowWhole);
      if (random.int(4) > 0) props.max = text(code, highWhole);
      const wholeValue = random.pick([
        lowWhole - 1,
        lowWhole,
        highWhole,
        highWhole + 1,
        random.int(200) - 100,
      ]);
      const amount = random.pick([
        text(code, wholeValue),
        text(code, wholeValue).replace(/\.?0+$/, "") || "0",
        `${wholeValue}.00005`.slice(0, 6),
      ]);
      if (!/^-?(0|[1-9][0-9]{0,14})(\.[0-9]{1,4})?$/.test(amount)) continue;
      if (moneyFieldPropsProblems(props).length > 0) continue;
      index++;
      const result = { amount, currency: code };
      const bound = moneyFieldBound(amount, props);
      const outside =
        (typeof props.min === "string" && scaled(amount) < scaled(props.min)) ||
        (typeof props.max === "string" && scaled(amount) > scaled(props.max));
      const expected =
        typeof props.min === "string" && scaled(amount) < scaled(props.min)
          ? "min"
          : typeof props.max === "string" && scaled(amount) > scaled(props.max)
            ? "max"
            : undefined;
      expect([index, amount, props, bound]).toEqual([index, amount, props, expected]);
      expect(moneyFieldResultShape(result)).toBe(true);
      const refusedForBound = moneyFieldResultProblems(result, props).some(
        (problem) => problem.path === "/amount" && /minimum|maximum/.test(problem.message),
      );
      expect([index, amount, props, refusedForBound]).toEqual([index, amount, props, outside]);
      if (outside) bounded++;
    }
    expect(bounded).toBeGreaterThan(100);
  });
});

describe("dateFieldBound", () => {
  const field = { label: "Start" };

  test("each code", () => {
    expect(dateFieldBound("2026-01-01", { ...field, min: "2026-02-01" })).toBe("min");
    expect(dateFieldBound("2026-03-01", { ...field, max: "2026-02-01" })).toBe("max");
  });

  test("a day the check takes gives no code, at each end of the range too", () => {
    expect(
      dateFieldBound("2026-02-01", { ...field, min: "2026-02-01", max: "2026-02-01" }),
    ).toBeUndefined();
    expect(dateFieldBound(GANTT_FIRST_DATE, field)).toBeUndefined();
    expect(dateFieldBound(GANTT_LAST_DATE, field)).toBeUndefined();
  });

  test("a day that does not exist, or lies outside the range, breaks no bound of the item", () => {
    expect(dateFieldBound("2026-02-30", field)).toBeUndefined();
    expect(dateFieldBound("1900-03-01", field)).toBeUndefined();
    expect(dateFieldBound("2026-02-30", { ...field, min: "2026-02-01" })).toBeUndefined();
  });

  test("a value or props nothing can be said of give no code", () => {
    expect(dateFieldBound(20260101, field)).toBeUndefined();
    expect(dateFieldBound("2026-01-01", { min: "2026-02-01" })).toBeUndefined();
    expect(dateFieldBound("2026-01-01", null)).toBeUndefined();
  });

  test("1,000 generated days: a code if and only if the check refuses for a bound", () => {
    const random = generator(0xda7e);
    const day = (): string => {
      const year = random.pick([1900, 1999, 2000, 2024, 2026, 2100, 9999]);
      const month = 1 + random.int(12);
      const date = 1 + random.int(31);
      return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    };
    let bounded = 0;
    let index = 0;
    while (index < CASES) {
      const props: Record<string, unknown> = { label: "L" };
      const a = day();
      const b = day();
      const [min, max] = a <= b ? [a, b] : [b, a];
      if (random.int(4) > 0) props.min = min;
      if (random.int(4) > 0) props.max = max;
      const value = random.pick([
        day(),
        min,
        max,
        GANTT_FIRST_DATE,
        GANTT_LAST_DATE,
        "2026-02-30",
        "2025-02-29",
        "2024-02-29",
      ]);
      if (dateFieldPropsProblems(props).length > 0 || !dateFieldResultShape(value)) continue;
      index++;
      const problems = dateFieldResultProblems(value, props);
      const exists = !problems.some((problem) => /is not a day that exists/.test(problem.message));
      const bound = dateFieldBound(value, props);
      const expected = !exists
        ? undefined
        : typeof props.min === "string" && value < props.min
          ? "min"
          : typeof props.max === "string" && value > props.max
            ? "max"
            : undefined;
      expect([index, value, props, bound]).toEqual([index, value, props, expected]);
      expect([index, value, props, bound !== undefined]).toEqual([
        index,
        value,
        props,
        exists && problems.length > 0,
      ]);
      if (bound !== undefined) bounded++;
    }
    expect(bounded).toBeGreaterThan(100);
  });
});
