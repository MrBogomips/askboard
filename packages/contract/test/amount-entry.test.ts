import { describe, expect, test } from "bun:test";
import { amountEcho, compareDecimal, type Locale, parseAmount, parseNumber } from "../src/index.ts";

// Amount entry in the ask's locale (atoms design decision 2; contract spec, "Amount entry in the
// ask's locale"): a decimal string with exactly the currency's minor units, never through a float.

const amountOf = (text: string, currency: string, locale: Locale = "en-US"): string => {
  const entry = parseAmount(text, currency, locale);
  return entry.kind === "amount" ? entry.amount : `not an amount: ${JSON.stringify(entry)}`;
};

const refusalOf = (
  text: string,
  currency: string,
  locale: Locale = "en-US",
  language: Locale = locale,
) => {
  const entry = parseAmount(text, currency, locale, language);
  if (entry.kind !== "refused") throw new Error(`not refused: ${JSON.stringify(entry)}`);
  return entry;
};

describe("reading an amount", () => {
  test("an Italian amount reads as a decimal string, and its echo follows", () => {
    expect(parseAmount("1.234,5", "EUR", "it-IT")).toEqual({ kind: "amount", amount: "1234.50" });
    expect(amountEcho("1234.50", "EUR", "it-IT")).toBe("= 1234,50 EUR");
  });

  test("an en-US amount and its echo", () => {
    expect(amountOf("1,234.5", "USD")).toBe("1234.50");
    expect(amountEcho("1234.50", "USD", "en-US")).toBe("= 1234.50 USD");
  });

  test("more decimals than the currency's minor units are refused, naming the currency", () => {
    const eur = refusalOf("12.345", "EUR");
    expect(eur.code).toBe("decimals");
    expect(eur.reason).toBe("EUR takes at most 2 decimals, as in 12.50.");
    const yen = refusalOf("12.5", "JPY");
    expect(yen.code).toBe("decimals");
    expect(yen.reason).toContain("JPY");
    expect(yen.reason).toBe("JPY takes no decimals, as in 50.");
  });

  test("the refusal is in the ask's language, with the example in its locale's marks", () => {
    expect(refusalOf("12,345", "EUR", "it-IT").reason).toBe(
      "EUR ammette al massimo 2 decimali, come in 12,50.",
    );
    expect(refusalOf("12.345", "EUR", "en-US", "it-IT").reason).toBe(
      "EUR ammette al massimo 2 decimali, come in 12.50.",
    );
    expect(refusalOf("12,5", "JPY", "it-IT").reason).toBe("JPY non ammette decimali, come in 50.");
  });

  test("a precision a float cannot hold is kept exactly", () => {
    expect(amountOf("999999999999999.99", "USD")).toBe("999999999999999.99");
    expect(amountOf("0.07", "USD")).toBe("0.07");
    expect(amountOf("123456789012345.67", "EUR")).toBe("123456789012345.67");
    expect(amountOf("-999999999999999.99", "EUR")).toBe("-999999999999999.99");
  });

  test("EUR, USD and GBP take two decimals, JPY none, an unlisted code two", () => {
    for (const code of ["EUR", "USD", "GBP", "XYZ", "constructor"]) {
      expect(amountOf("5", code)).toBe("5.00");
      expect(amountOf("5.1", code)).toBe("5.10");
      expect(refusalOf("5.123", code).code).toBe("decimals");
    }
    expect(amountOf("1500", "JPY")).toBe("1500");
    expect(amountOf("1,500", "JPY")).toBe("1500");
    expect(refusalOf("1500.0", "JPY").code).toBe("decimals");
  });

  test("15 integer digits pass and 16 are refused as too large", () => {
    expect(amountOf("999999999999999", "EUR")).toBe("999999999999999.00");
    expect(amountOf("999,999,999,999,999", "EUR")).toBe("999999999999999.00");
    for (const text of ["1000000000000000", "1,000,000,000,000,000", "-1000000000000000.00"]) {
      expect(refusalOf(text, "EUR").code).toBe("too-large");
    }
    expect(refusalOf("1000000000000000", "EUR").reason).toBe(
      "The amount is too large: use at most 15 digits before the decimal point.",
    );
    expect(refusalOf("1.000.000.000.000.000", "EUR", "it-IT").reason).toBe(
      "L'importo è troppo grande: usa al massimo 15 cifre prima della virgola decimale.",
    );
  });

  test("leading zeros do not count as integer digits and are dropped", () => {
    expect(amountOf("0000000000000000012", "EUR")).toBe("12.00");
    expect(amountOf("007", "EUR")).toBe("7.00");
  });

  test("minus zero and a zero amount read as zero, never negative", () => {
    expect(amountOf("-0", "EUR")).toBe("0.00");
    expect(amountOf("-0.00", "EUR")).toBe("0.00");
    expect(amountOf("0,00", "EUR", "it-IT")).toBe("0.00");
    expect(amountOf("-0", "JPY")).toBe("0");
    expect(amountOf("+12", "EUR")).toBe("12.00");
  });

  test("an empty or blank entry is an empty field", () => {
    expect(parseAmount("", "EUR", "en-US")).toEqual({ kind: "empty" });
    expect(parseAmount("   ", "EUR", "it-IT")).toEqual({ kind: "empty" });
  });

  test("surrounding spaces are ignored", () => {
    expect(amountOf("  12.5\t", "EUR")).toBe("12.50");
  });
});

describe("every number refusal comes through with the number entry's reason", () => {
  const CASES: readonly [string, string][] = [
    ["1e3", "exponent"],
    ["12 EUR", "character"],
    ["€12", "character"],
    ["1-2", "sign"],
    ["--1", "sign"],
    ["-", "no-digits"],
    [".", "no-digits"],
    ["1.2.3", "decimal-marks"],
    [".5", "decimal-sides"],
    ["5.", "decimal-sides"],
    ["1,23", "grouping"],
    ["12,34.5", "grouping"],
  ];

  test.each(CASES)("%p is refused as %p, as the number entry words it", (text, code) => {
    for (const locale of ["en-US", "it-IT"] as const) {
      const number: unknown = parseNumber(text, locale);
      const amount: unknown = parseAmount(text, "EUR", locale);
      if ((number as { kind: string }).kind !== "refused") continue;
      expect(amount).toEqual(number);
    }
    const number = parseNumber(text, "en-US");
    expect<unknown>(number.kind === "refused" && number.code).toBe(code);
    const amount: unknown = parseAmount(text, "EUR", "en-US");
    expect(amount).toEqual(number);
  });

  test("the reason is in the ask's language when it differs from the locale", () => {
    const amount: unknown = parseAmount("1e3", "EUR", "en-US", "it-IT");
    expect(amount).toEqual(parseNumber("1e3", "en-US", "it-IT"));
  });
});

describe("the echo", () => {
  test("writes the amount without grouping, with the minor units and the code", () => {
    expect(amountEcho("5", "EUR", "en-US")).toBe("= 5.00 EUR");
    expect(amountEcho("1500", "JPY", "it-IT")).toBe("= 1500 JPY");
    expect(amountEcho("-12.5", "USD", "it-IT")).toBe("= -12,50 USD");
    expect(amountEcho("0.07", "USD", "it-IT")).toBe("= 0,07 USD");
  });

  test("echoes what the parser read, in the locale it was typed in", () => {
    for (const locale of ["en-US", "it-IT"] as const) {
      const entry = parseAmount(locale === "en-US" ? "1,234.5" : "1.234,5", "EUR", locale);
      if (entry.kind !== "amount") throw new Error("not an amount");
      expect(amountEcho(entry.amount, "EUR", locale)).toBe(
        locale === "en-US" ? "= 1234.50 EUR" : "= 1234,50 EUR",
      );
    }
  });
});

describe("comparing decimal strings", () => {
  test.each([
    ["1", "2", -1],
    ["2", "1", 1],
    ["1", "1", 0],
    ["-1", "1", -1],
    ["1", "-1", 1],
    ["-2", "-1", -1],
    ["-1", "-2", 1],
    ["-1", "-1", 0],
    ["9", "10", -1],
    ["10", "9", 1],
    ["999999999999999.99", "999999999999999.98", 1],
    ["999999999999999.99", "1000000000000000", -1],
    ["0.1", "0.09", 1],
    ["0.09", "0.1", -1],
    ["-0.1", "-0.09", -1],
    ["1.5", "1.50", 0],
    ["1.50", "1.5", 0],
    ["1.500", "1.5001", -1],
    ["0", "-0", 0],
    ["-0.00", "0", 0],
    ["0", "0.0001", -1],
    ["-0.0001", "0", -1],
    ["-100.5", "-99.5", -1],
  ] as const)("%p against %p is %p", (a, b, expected) => {
    expect(compareDecimal(a, b)).toBe(expected);
    const flipped: number = expected === 0 ? 0 : -expected;
    expect<number>(compareDecimal(b, a)).toBe(flipped);
  });
});

describe("the parser never goes through a float", () => {
  test("amount.ts calls no Number, parseFloat or parseInt", async () => {
    const source = await Bun.file(new URL("../src/locale/amount.ts", import.meta.url)).text();
    expect(source).not.toMatch(/\bNumber\s*\(/);
    expect(source).not.toMatch(/\bparseFloat\b/);
    expect(source).not.toMatch(/\bparseInt\b/);
    expect(source).not.toMatch(/\bMath\./);
  });
});

describe("the number entry is unchanged", () => {
  test("parseNumber still reads a float", () => {
    expect(parseNumber("1,234.5", "en-US")).toEqual({ kind: "number", value: 1234.5 });
    expect(parseNumber("1e999", "en-US").kind).toBe("refused");
  });
});
