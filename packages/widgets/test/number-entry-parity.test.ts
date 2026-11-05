import { describe, expect, test } from "bun:test";
import {
  numberEcho as contractEcho,
  parseNumber as contractParse,
  plainNumber,
} from "@askboard/contract";
import { formatNumber, numberEcho, parseNumber } from "../src/shared/number.ts";

// The contract's number entry (settings-languages tasks 2.4 and 9.1) and the Tree's parser, which
// delegates to it: they read every entry alike in each locale, reason for reason, and the Tree's
// en-US exports are what they were.

const ALPHABET = ["0", "1", "5", "9", ",", ".", "+", "-", "e", " ", "x"];

// A small linear congruential generator, so every run tries the same entries.
const entries = (count: number, seed: number): string[] => {
  let state = seed;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state;
  };
  return Array.from({ length: count }, () =>
    Array.from({ length: 1 + (next() % 9) }, () => ALPHABET[next() % ALPHABET.length]).join(""),
  );
};

const FIXED = [
  "12",
  "-0.5",
  "1,234.5",
  "1234.5",
  "+7",
  "1,234,567.25",
  "0",
  "007",
  "",
  "  1,234.5\t",
  "-0",
  "1,5",
  "12,34",
  "1,2345",
  "0,123",
  "1.234,5",
  "1.2.3",
  "1e3",
  ".",
  "-",
  ".5",
  "5.",
  "a",
  "12x",
  "1 234",
  "--5",
  "+-5",
  "5-",
  `1${"0".repeat(400)}`,
];

describe("the contract's entry and the Tree's", () => {
  test.each(FIXED)("read %p alike in en-US and it-IT", (text) => {
    for (const locale of ["en-US", "it-IT"] as const) {
      expect(parseNumber(text, locale)).toEqual(contractParse(text, locale));
    }
  });

  test("read 5,000 generated entries alike", () => {
    for (const text of entries(5_000, 42))
      expect({ text, entry: parseNumber(text) }).toEqual({
        text,
        entry: contractParse(text, "en-US"),
      });
  });

  test("write a value back alike", () => {
    for (const value of [0, -0, 0.1, -0.5, 1234.5, 1e21, -1.25e22, 1.5e-7, 2 ** 53 + 2]) {
      for (const locale of ["en-US", "it-IT"] as const) {
        expect(formatNumber(value, locale)).toBe(plainNumber(value, locale));
        expect(numberEcho(value, locale)).toBe(contractEcho(value, locale));
      }
    }
  });

  test("keep en-US when no locale is given", () => {
    expect(parseNumber("1,234.5")).toEqual({ kind: "number", value: 1234.5 });
    expect(formatNumber(1234.5)).toBe("1234.5");
    expect(numberEcho(1234.5)).toBe("= 1234.5");
  });
});
