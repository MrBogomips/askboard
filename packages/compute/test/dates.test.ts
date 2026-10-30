import { describe, expect, test } from "bun:test";
import { fullDateOf, MAX_SERIAL, MIN_SERIAL, serialOf, workday } from "../src/dates.ts";
import { convertInput } from "../src/inputs.ts";
import { isFormulaError } from "../src/types.ts";

describe("dates as serials", () => {
  test("match Excel's 1900 system from 1900-03-01 to 9999-12-31", () => {
    expect(serialOf("1900-03-01")).toBe(MIN_SERIAL);
    expect(serialOf("9999-12-31")).toBe(MAX_SERIAL);
    expect(serialOf("2026-11-02")).toBe(46_328);
    expect(serialOf("2028-02-29")).toBe(46_812);
  });

  test("refuse days that do not exist or fall outside Excel's range", () => {
    for (const text of [
      "1900-02-28",
      "2026-02-30",
      "2027-02-29",
      "2026-13-01",
      "2026-00-10",
      "2026-1-5",
      "x",
    ]) {
      expect(serialOf(text)).toBeUndefined();
    }
  });

  test("round-trip every day of a leap year and its neighbours", () => {
    const first = serialOf("2027-12-01") as number;
    for (let serial = first; serial < first + 500; serial++) {
      expect(serialOf(fullDateOf(serial) as string)).toBe(serial);
    }
  });

  test("drop the fraction of a day, and refuse serials out of range", () => {
    expect(fullDateOf(46_328.75)).toBe("2026-11-02");
    expect(fullDateOf(MIN_SERIAL - 1)).toBeUndefined();
    expect(fullDateOf(MAX_SERIAL + 1)).toBeUndefined();
    expect(fullDateOf(Number.NaN)).toBeUndefined();
    expect(fullDateOf(MAX_SERIAL)).toBe("9999-12-31");
  });
});

describe("WORKDAY without holidays", () => {
  const day = (text: string): number => serialOf(text) as number;

  test.each([
    ["2026-11-06", 1, "2026-11-09"],
    ["2026-11-07", 0, "2026-11-07"],
    ["2026-11-07", 1, "2026-11-09"],
    ["2026-11-02", -1, "2026-10-30"],
    ["2026-11-02", 5, "2026-11-09"],
    ["2026-11-02", 2.7, "2026-11-04"],
    ["2026-11-02", -2.7, "2026-10-29"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-11-02", 260, "2027-11-01"],
    ["2026-11-08", -1, "2026-11-06"],
  ])("from %s, %d working days is %s", (start, n, expected) => {
    expect(fullDateOf(workday(day(start), n))).toBe(expected);
  });
});

describe("input conversion", () => {
  test("describes lists and objects it refuses", () => {
    expect(convertInput("number", [] as never)).toEqual({ reason: "a number, not a list" });
    expect(convertInput("text", {} as never)).toEqual({ reason: "text, not an object" });
  });

  test("refuses money past the largest number", () => {
    const huge = `1${"0".repeat(400)}`;
    expect(convertInput("money", huge)).toEqual({
      reason: `money is a decimal string, not "${huge}"`,
    });
  });

  test("gives dates as serials and money as numbers", () => {
    expect(convertInput("date", "2026-11-02")).toEqual({ value: 46_328 });
    expect(convertInput("money", "-0.50")).toEqual({ value: -0.5 });
    expect(convertInput("boolean", undefined)).toEqual({ value: null });
  });
});

describe("formula errors", () => {
  test("are objects; every other result is a scalar", () => {
    expect(isFormulaError({ error: "cycle", address: "x.a" })).toBe(true);
    for (const value of [0, "", false, null]) expect(isFormulaError(value)).toBe(false);
  });
});
