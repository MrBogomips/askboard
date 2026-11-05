import { describe, expect, test } from "bun:test";
import {
  dateEcho,
  type Locale,
  numberEcho,
  parseDate,
  parseNumber,
  plainNumber,
} from "../src/index.ts";

// Number and date entry in the ask's locale (settings-languages design decision 8; contract spec,
// "Number entry in the ask's locale", "Date entry in the ask's locale"). A refusal names the first
// rule broken, in the ask's language, with an example in its locale.

const reasonOf = (text: string, locale: Locale = "en-US", language: Locale = locale): string => {
  const entry = parseNumber(text, locale, language);
  return entry.kind === "refused" ? entry.reason : `not refused: ${JSON.stringify(entry)}`;
};

const dateReasonOf = (text: string, locale: Locale, language: Locale = locale): string => {
  const entry = parseDate(text, locale, language);
  return entry.kind === "refused" ? entry.reason : `not refused: ${JSON.stringify(entry)}`;
};

// The Tree's tests of its en-US parser (tree-widget, packages/widgets/src/shared/number.test.ts),
// every case unchanged, through the contract's entry in en-US.
describe("parsing an en-US number (the Tree's cases)", () => {
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
    expect(parseNumber(text, "en-US")).toEqual({ kind: "number", value });
  });

  test("trims surrounding spaces", () => {
    expect(parseNumber("  1,234.5\t", "en-US")).toEqual({ kind: "number", value: 1234.5 });
  });

  test("reads an empty or blank entry as an empty field", () => {
    expect(parseNumber("", "en-US")).toEqual({ kind: "empty" });
    expect(parseNumber("   ", "en-US")).toEqual({ kind: "empty" });
  });

  test("reads minus zero as zero", () => {
    expect(Object.is((parseNumber("-0", "en-US") as { value: number }).value, 0)).toBe(true);
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
    for (const text of ["12", "", "1,5"]) {
      expect(Object.isFrozen(parseNumber(text, "en-US"))).toBe(true);
    }
  });
});

describe("formatting an en-US number for the echo (the Tree's cases)", () => {
  test("echoes 1234.5 as the value the field holds", () => {
    expect(numberEcho(1234.5, "en-US")).toBe("= 1234.5");
    expect(plainNumber(1234.5, "en-US")).toBe("1234.5");
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
    expect(plainNumber(value, "en-US")).toBe(text);
  });

  test("writes what the parser reads back", () => {
    for (const value of [0, 0.1, -0.5, 1234.5, 123456789.125, 1e21, 1.5e-7, 2 ** 53 + 2]) {
      expect(parseNumber(plainNumber(value, "en-US"), "en-US")).toEqual({ kind: "number", value });
    }
  });

  test("refuses a value that is not a finite number", () => {
    expect(() => plainNumber(Number.NaN, "en-US")).toThrow("NaN");
    expect(() => plainNumber(Number.POSITIVE_INFINITY, "en-US")).toThrow("Infinity");
  });
});

describe("the en-US reasons, word for word the Tree's", () => {
  test.each([
    ["1e3", "exponent", "Write the number in full, without an exponent."],
    ["12x", "character", '"x" is not part of a number: use digits, as in 1,234.5.'],
    ["--5", "sign", "Put at most one sign, before the digits."],
    ["-", "no-digits", "Type digits, as in 1,234.5."],
    ["1.2.3", "decimal-marks", "Use one decimal point at most."],
    [".5", "decimal-sides", "Put digits on both sides of the decimal point, as in 0.5."],
    ["1,5", "grouping", "Use commas only between groups of three digits, as in 1,234.5."],
    [`1${"0".repeat(400)}`, "too-large", "The number is too large."],
  ] as const)("%p is refused as %s", (text, code, reason) => {
    expect(parseNumber(text, "en-US")).toEqual({ kind: "refused", code, reason });
  });
});

describe("parsing an it-IT number", () => {
  test.each([
    ["1.234,5", 1234.5],
    ["1.234", 1234],
    ["1,5", 1.5],
    ["-0,5", -0.5],
    ["1.234.567,25", 1234567.25],
    ["+7", 7],
    ["1234,5", 1234.5],
    ["007", 7],
  ])("accepts %p as %p", (text, value) => {
    expect(parseNumber(text, "it-IT")).toEqual({ kind: "number", value });
  });

  test.each([
    ["1234.5", "grouping", "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."],
    ["1.23", "grouping", "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."],
    ["1,234.5", "grouping", "Usa i punti solo tra gruppi di tre cifre, come in 1.234,5."],
    ["1,2,3", "decimal-marks", "Usa al massimo una virgola decimale."],
    ["1e3", "exponent", "Scrivi il numero per intero, senza esponente."],
    ["--1", "sign", "Metti al massimo un segno, prima delle cifre."],
    [",5", "decimal-sides", "Metti delle cifre prima e dopo la virgola decimale, come in 0,5."],
    ["5,", "decimal-sides", "Metti delle cifre prima e dopo la virgola decimale, come in 0,5."],
    ["12x", "character", '"x" non fa parte di un numero: usa le cifre, come in 1.234,5.'],
    [",", "no-digits", "Scrivi delle cifre, come in 1.234,5."],
    [`1${"0".repeat(400)}`, "too-large", "Il numero è troppo grande."],
  ] as const)("refuses %p as %s, in Italian", (text, code, reason) => {
    expect(parseNumber(text, "it-IT")).toEqual({ kind: "refused", code, reason });
  });

  test("an empty entry is an empty field, and every result is frozen", () => {
    expect(parseNumber(" ", "it-IT")).toEqual({ kind: "empty" });
    for (const text of ["1,5", "", "1234.5"]) {
      expect(Object.isFrozen(parseNumber(text, "it-IT"))).toBe(true);
    }
  });
});

describe("a refusal in the ask's language, with the locale's marks", () => {
  test("English words, Italian marks", () => {
    expect(reasonOf("1234.5", "it-IT", "en-US")).toBe(
      "Use periods only between groups of three digits, as in 1.234,5.",
    );
    expect(reasonOf("1,2,3", "it-IT", "en-US")).toBe("Use one decimal comma at most.");
    expect(reasonOf(",5", "it-IT", "en-US")).toBe(
      "Put digits on both sides of the decimal comma, as in 0,5.",
    );
  });

  test("Italian words, English marks", () => {
    expect(reasonOf("1,5", "en-US", "it-IT")).toBe(
      "Usa le virgole solo tra gruppi di tre cifre, come in 1,234.5.",
    );
    expect(reasonOf("1.2.3", "en-US", "it-IT")).toBe("Usa al massimo un punto decimale.");
    expect(reasonOf(".5", "en-US", "it-IT")).toBe(
      "Metti delle cifre prima e dopo il punto decimale, come in 0.5.",
    );
  });

  test("the language defaults to the locale", () => {
    expect(reasonOf("1234.5", "it-IT")).toBe(reasonOf("1234.5", "it-IT", "it-IT"));
  });
});

describe("the number echo", () => {
  test.each([
    ["en-US", 1234.5, "= 1234.5"],
    ["it-IT", 1234.5, "= 1234,5"],
    ["it-IT", -0.5, "= -0,5"],
    ["it-IT", 1234567, "= 1234567"],
    ["it-IT", 1e21, "= 1000000000000000000000"],
  ] as const)("in %s, %p echoes %p, with no grouping", (locale, value, echo) => {
    expect(numberEcho(value, locale)).toBe(echo);
  });

  test("writes what the it-IT parser reads back", () => {
    for (const value of [0, 0.1, -0.5, 1234.5, 123456789.125, 1e21, 1.5e-7, 2 ** 53 + 2]) {
      expect(parseNumber(plainNumber(value, "it-IT"), "it-IT")).toEqual({ kind: "number", value });
    }
  });
});

describe("date entry", () => {
  test.each([
    ["9/12/2026", "en-US", "2026-09-12", "= Sat, Sep 12, 2026"],
    ["9/12/2026", "it-IT", "2026-12-09", "= mer 9 dic 2026"],
    ["2026-12-09", "en-US", "2026-12-09", "= Wed, Dec 9, 2026"],
    ["2026-12-09", "it-IT", "2026-12-09", "= mer 9 dic 2026"],
    ["29/2/2028", "it-IT", "2028-02-29", "= mar 29 feb 2028"],
    ["2/29/2028", "en-US", "2028-02-29", "= Tue, Feb 29, 2028"],
    [" 09/12/2026 ", "it-IT", "2026-12-09", "= mer 9 dic 2026"],
  ] as const)("%p in %s reads as %p and echoes %p", (text, locale, date, echo) => {
    expect(parseDate(text, locale)).toEqual({ kind: "date", date });
    expect(dateEcho(date, locale)).toBe(echo);
  });

  test("an empty entry is an empty field, and every result is frozen", () => {
    expect(parseDate("  ", "it-IT")).toEqual({ kind: "empty" });
    for (const text of ["9/12/2026", "", "31/11/2026"]) {
      expect(Object.isFrozen(parseDate(text, "it-IT"))).toBe(true);
    }
  });

  test.each([
    ["31/11/2026", "day", "Novembre 2026 non ha il giorno 31"],
    ["29/2/2027", "day", "Febbraio 2027 non ha il giorno 29"],
    ["0/1/2026", "day", "Gennaio 2026 non ha il giorno 0"],
    ["9/13/2026", "month", "13 non è un mese: scrivi giorno/mese/anno, come in 9/12/2026"],
    ["9/12", "no-year", "Scrivi anche l'anno: giorno/mese/anno, come in 9/12/2026"],
    ["9.12.2026", "format", "Scrivi la data come giorno/mese/anno, come in 9/12/2026"],
    ["9/12/26", "format", "Scrivi la data come giorno/mese/anno, come in 9/12/2026"],
    ["2026-12-9", "format", "Scrivi la data come giorno/mese/anno, come in 9/12/2026"],
    ["2026-02-30", "day", "Febbraio 2026 non ha il giorno 30"],
  ] as const)("in it-IT, %p is refused as %s, in Italian", (text, code, reason) => {
    expect(parseDate(text, "it-IT")).toEqual({ kind: "refused", code, reason });
  });

  test.each([
    ["11/31/2026", "day", "November 2026 has no day 31"],
    ["2/29/2027", "day", "February 2027 has no day 29"],
    ["13/9/2026", "month", "13 is not a month: write month/day/year, as in 12/9/2026"],
    ["12/9", "no-year", "Write the year too: month/day/year, as in 12/9/2026"],
    ["9.12.2026", "format", "Write the date as month/day/year, as in 12/9/2026"],
    ["Dec 9", "format", "Write the date as month/day/year, as in 12/9/2026"],
  ] as const)("in en-US, %p is refused as %s", (text, code, reason) => {
    expect(parseDate(text, "en-US")).toEqual({ kind: "refused", code, reason });
  });

  test("a refusal in the ask's language, with the locale's order", () => {
    expect(dateReasonOf("31/11/2026", "it-IT", "en-US")).toBe("November 2026 has no day 31");
    expect(dateReasonOf("9/12", "it-IT", "en-US")).toBe(
      "Write the year too: day/month/year, as in 9/12/2026",
    );
    expect(dateReasonOf("12/9", "en-US", "it-IT")).toBe(
      "Scrivi anche l'anno: mese/giorno/anno, come in 12/9/2026",
    );
  });

  test("the echo refuses a date that does not exist", () => {
    expect(() => dateEcho("2026-02-30", "it-IT")).toThrow(RangeError);
  });
});
