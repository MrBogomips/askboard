import { describe, expect, test } from "bun:test";
import { formatNumber, numberEcho, parseNumber } from "./number.ts";

// AskBoard's own en-US number entry (EXPERIENCE, Input atoms; design decision 5): a text input
// read by this parser, never the browser's number input, and the parsed value echoed.
const reasonOf = (text: string): string => {
  const entry = parseNumber(text);
  return entry.kind === "refused" ? entry.reason : `not refused: ${JSON.stringify(entry)}`;
};

describe("parsing an en-US number", () => {
  test.each([
    ["12", 12],
    ["-0.5", -0.5],
    ["1,234.5", 1234.5],
    ["1234.5", 1234.5],
    ["+7", 7],
    ["1,234,567.25", 1234567.25],
    ["0", 0],
    ["007", 7],
  ])("accepts %p as %p", (text, value) => {
    expect(parseNumber(text)).toEqual({ kind: "number", value });
  });

  test("trims surrounding spaces", () => {
    expect(parseNumber("  1,234.5\t")).toEqual({ kind: "number", value: 1234.5 });
  });

  test("reads an empty or blank entry as an empty field", () => {
    expect(parseNumber("")).toEqual({ kind: "empty" });
    expect(parseNumber("   ")).toEqual({ kind: "empty" });
  });

  test("reads minus zero as zero", () => {
    expect(Object.is((parseNumber("-0") as { value: number }).value, 0)).toBe(true);
  });

  test.each([
    ["1,5", "comma"],
    ["12,34", "comma"],
    ["1,2345", "comma"],
    ["0,123", "comma"],
    ["1.234,5", "comma"],
    ["1.2.3", "one decimal point"],
    ["1e3", "exponent"],
    [".", "digits"],
    ["-", "digits"],
    [".5", "both sides"],
    ["5.", "both sides"],
    ["a", '"a"'],
    ["12x", '"x"'],
    ["1 234", '" "'],
    ["--5", "sign"],
    ["+-5", "sign"],
    ["5-", "sign"],
  ])("refuses %p with a reason", (text, words) => {
    expect(reasonOf(text)).toContain(words);
  });

  test("refuses a number too large to hold", () => {
    expect(reasonOf(`1${"0".repeat(400)}`)).toContain("too large");
  });

  test("every result is frozen", () => {
    for (const text of ["12", "", "1,5"]) expect(Object.isFrozen(parseNumber(text))).toBe(true);
  });
});

describe("formatting a number for the echo", () => {
  test("echoes 1234.5 as the value the field holds", () => {
    expect(numberEcho(1234.5)).toBe("= 1234.5");
    expect(formatNumber(1234.5)).toBe("1234.5");
  });

  test.each([
    [-0.5, "-0.5"],
    [12, "12"],
    [-0, "0"],
    [1e21, "1000000000000000000000"],
    [-1.25e22, "-12500000000000000000000"],
    [1.5e-7, "0.00000015"],
    [0.1, "0.1"],
  ])("writes %p as %p, with no exponent", (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });

  test("writes what the parser reads back", () => {
    for (const value of [0, 0.1, -0.5, 1234.5, 123456789.125, 1e21, 1.5e-7, 2 ** 53 + 2]) {
      expect(parseNumber(formatNumber(value))).toEqual({ kind: "number", value });
    }
  });

  test("refuses a value that is not a finite number", () => {
    expect(() => formatNumber(Number.NaN)).toThrow("NaN");
    expect(() => formatNumber(Number.POSITIVE_INFINITY)).toThrow("Infinity");
  });
});
