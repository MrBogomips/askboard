import { describe, expect, test } from "bun:test";
import { costOf100, mixQuestion, PRICES, pricesFor, usd } from "../src/cost.ts";
import { spreadOf } from "../src/stats.ts";

const price = (model: string) => {
  const found = pricesFor(model);
  if (found === undefined) throw new Error(`no prices for ${model}`);
  return found;
};

describe("spreadOf", () => {
  test("median, nearest-rank p90, minimum and maximum", () => {
    expect(spreadOf([5, 1, 3])).toEqual({ n: 3, median: 3, min: 1, p90: 5, max: 5 });
    expect(spreadOf([4, 1, 3, 2])).toEqual({ n: 4, median: 2.5, min: 1, p90: 4, max: 4 });
    expect(spreadOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])?.p90).toBe(9);
    expect(spreadOf([7])).toEqual({ n: 1, median: 7, min: 7, p90: 7, max: 7 });
    expect(spreadOf([])).toBeUndefined();
  });
});

describe("the cost model on the addendum's worked inputs (§6.3)", () => {
  const scenarios = {
    a: { k1: 700, k2: 520, x: 0, a: 150, t: 1_500 },
    b: { k1: 12_400, k2: 3_900, x: 300, a: 300, t: 0 },
    c: { k1: 450, k2: 520, x: 0, a: 60, t: 0 },
  };

  test.each([
    ["claude-opus-5-5", 5.02, 58.55, 3.49],
    ["claude-sonnet-5-5", 2.51, 29.28, 1.74],
  ] as const)("%s, 5-minute TTL", (model, a, b, c) => {
    const prices = pricesFor(model);
    if (prices === undefined) throw new Error("no prices");
    expect(usd(costOf100(scenarios.a, prices, "5m").total)).toBe(a);
    expect(usd(costOf100(scenarios.b, prices, "5m").total)).toBe(b);
    expect(usd(costOf100(scenarios.c, prices, "5m").total)).toBe(c);
  });

  test("the parts of (a) on Opus 5.5", () => {
    const cost = costOf100(scenarios.a, price("claude-opus-5-5"), "5m");
    expect(usd(cost.generation)).toBe(2.44);
    expect(usd(cost.cacheWrite)).toBe(0.69);
    expect(usd(cost.reReads)).toBe(1.37);
    expect(usd(cost.toolOverhead)).toBe(0.53);
  });

  test("answers after the TTL at a 60k context add 28.80 on Opus 5.5 and 14.40 on Sonnet 5.5", () => {
    expect(usd(costOf100(scenarios.c, price("claude-opus-5-5"), "5m").afterTtl)).toBe(28.8);
    expect(usd(costOf100(scenarios.c, price("claude-sonnet-5-5"), "5m").afterTtl)).toBe(14.4);
  });

  test("a 1-hour TTL writes at the 1-hour price", () => {
    const cost = costOf100(scenarios.c, price("claude-opus-5-5"), "1h");
    expect(cost.cacheWrite).toBeCloseTo(100 * 1_030 * 8e-6, 10);
  });

  test("T = 5,000 raises (a)'s tool overhead to about 1.75", () => {
    expect(
      usd(costOf100({ ...scenarios.a, t: 5_000 }, price("claude-opus-5-5"), "5m").toolOverhead),
    ).toBe(1.75);
  });

  test("a model without list prices has none", () => {
    expect(pricesFor("claude-other-9")).toBeUndefined();
    expect(Object.keys(PRICES).sort()).toEqual([
      "claude-fable-5-1",
      "claude-haiku-5-5",
      "claude-opus-5-5",
      "claude-sonnet-5-5",
    ]);
  });
});

describe("mixQuestion", () => {
  test("a 10-question session is one cold and nine warm asks", () => {
    expect(mixQuestion(1_000, 100)).toBe(190);
    expect(mixQuestion(undefined, 100)).toBeUndefined();
    expect(mixQuestion(100, undefined)).toBeUndefined();
  });

  test("usd rounds half up to cents", () => {
    expect(usd(3.485)).toBe(3.49);
    expect(usd(29.275)).toBe(29.28);
    expect(usd(0.004)).toBe(0);
  });
});
