import { describe, expect, test } from "bun:test";
import { formatValue, SUMMARY_VALUE_MAX_CHARS, type ValueWords } from "./values.ts";

// The Approval summary's values (design decision 8): shown in the ask's locale with the contract's
// formatters; the words for on, off and nothing are the caller's, from the view's tables.
const words: ValueWords = { on: "on", off: "off", none: "—" };

describe("formatValue", () => {
  test("numbers in each locale", () => {
    expect(formatValue(12480.5, "en-US", words)).toBe("12,480.5");
    expect(formatValue(12480.5, "it-IT", words)).toBe("12.480,5");
  });

  test("money, an amount with its currency", () => {
    expect(formatValue({ amount: "12480", currency: "EUR" }, "en-US", words)).toBe("€12,480.00");
    expect(formatValue({ amount: "12480", currency: "EUR" }, "it-IT", words)).toBe("€ 12.480,00");
  });

  test("a full-date", () => {
    expect(formatValue("2026-10-27", "en-US", words)).toBe("10/27/2026");
    expect(formatValue("2026-10-27", "it-IT", words)).toBe("27/10/2026");
  });

  test("a date-shaped string that is no date stays text", () => {
    expect(formatValue("2026-13-45", "en-US", words)).toBe("2026-13-45");
  });

  test("booleans and null use the caller's words", () => {
    expect(formatValue(true, "en-US", words)).toBe("on");
    expect(formatValue(false, "en-US", words)).toBe("off");
    expect(formatValue(null, "en-US", words)).toBe("—");
    expect(formatValue(true, "it-IT", { on: "sì", off: "no", none: "—" })).toBe("sì");
  });

  test("a long string is cut at 80 characters with an ellipsis", () => {
    const long = "a".repeat(120);
    expect(SUMMARY_VALUE_MAX_CHARS).toBe(80);
    expect(formatValue(long, "en-US", words)).toBe(`${"a".repeat(80)}…`);
    expect(formatValue("a".repeat(80), "en-US", words)).toBe("a".repeat(80));
  });

  test("a cut never splits a surrogate pair", () => {
    const text = "😀".repeat(81);
    expect(formatValue(text, "en-US", words)).toBe(`${"😀".repeat(80)}…`);
  });

  test("other JSON is written out and cut the same way", () => {
    expect(formatValue({ a: [1, 2] }, "en-US", words)).toBe('{"a":[1,2]}');
    const wide = formatValue(
      Array.from({ length: 100 }, (_, i) => i),
      "en-US",
      words,
    );
    expect(wide.endsWith("…")).toBe(true);
    expect(Array.from(wide)).toHaveLength(81);
  });

  test("an amount that is no decimal or an unknown shape falls back to JSON", () => {
    expect(formatValue({ amount: "x", currency: "EUR" }, "en-US", words)).toBe(
      '{"amount":"x","currency":"EUR"}',
    );
  });

  test("a value with no JSON form gives the word for nothing", () => {
    expect(formatValue(undefined, "en-US", words)).toBe("—");
  });
});
