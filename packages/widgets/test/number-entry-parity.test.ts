import { describe, expect, test } from "bun:test";
import {
  numberEcho as contractEcho,
  parseNumber as contractParse,
  plainNumber,
} from "@askboard/contract";
import { formatNumber, numberEcho, parseNumber } from "../src/shared/number.ts";

// The contract's en-US number entry (settings-languages task 2.4) reads exactly as the Tree's
// parser does, reason for reason, until the Tree delegates to it (task 9.1).

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

const sameAs = (text: string) => {
  const { code: _, ...entry } = contractParse(text, "en-US") as { code?: string };
  return entry;
};

describe("the contract's en-US entry and the Tree's", () => {
  test.each(FIXED)("read %p alike", (text) => {
    expect(sameAs(text)).toEqual(parseNumber(text));
  });

  test("read 5,000 generated entries alike", () => {
    for (const text of entries(5_000, 42))
      expect({ text, entry: sameAs(text) }).toEqual({
        text,
        entry: parseNumber(text),
      });
  });

  test("write a value back alike", () => {
    for (const value of [0, -0, 0.1, -0.5, 1234.5, 1e21, -1.25e22, 1.5e-7, 2 ** 53 + 2]) {
      expect(plainNumber(value, "en-US")).toBe(formatNumber(value));
      expect(contractEcho(value, "en-US")).toBe(numberEcho(value));
    }
  });
});
