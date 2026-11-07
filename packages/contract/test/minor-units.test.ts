import { describe, expect, test } from "bun:test";
import {
  amountEcho,
  formatMoney,
  minorUnitsOf,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  parseAmount,
} from "../src/index.ts";
import { MINOR_UNITS } from "../src/locale/tables.ts";

// The minor-units table (atoms, task 1.12; review 2.3 and 4.4 S-3; contract spec: MoneyField items
// and results): ISO 4217's currencies whose minor unit is not two decimals, so that the amount a
// currency's users write is neither refused nor shown at the wrong precision.

const THREE = ["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"];
const FOUR = ["CLF", "UYW"];
const ZERO = [
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
];

describe("the table", () => {
  test("BHD, IQD, JOD, KWD, LYD, OMR and TND take 3 decimals, CLF and UYW 4, the zero-decimal currencies 0", () => {
    for (const code of THREE) expect(minorUnitsOf(code), code).toBe(3);
    for (const code of FOUR) expect(minorUnitsOf(code), code).toBe(4);
    for (const code of ZERO) expect(minorUnitsOf(code), code).toBe(0);
  });

  test("a currency not listed, and the two-decimal ones, take 2", () => {
    for (const code of ["EUR", "USD", "GBP", "CHF", "HUF", "XYZ"]) {
      expect(minorUnitsOf(code), code).toBe(2);
    }
  });

  test("the table lists only codes of three capital letters and units other than 2", () => {
    for (const [code, units] of Object.entries(MINOR_UNITS)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect([0, 3, 4]).toContain(units);
    }
  });
});

describe("amounts follow the table", () => {
  test("a BHD amount of 1.234 is read, and 1.2345 is refused naming the 3 decimals", () => {
    expect(parseAmount("1.234", "BHD", "en-US")).toEqual({ kind: "amount", amount: "1.234" });
    expect(parseAmount("1,5", "KWD", "it-IT")).toEqual({ kind: "amount", amount: "1.500" });
    const refused = parseAmount("1.2345", "BHD", "en-US");
    expect(refused.kind).toBe("refused");
    if (refused.kind === "refused") {
      expect(refused.code).toBe("decimals");
      expect(refused.reason).toContain("BHD takes at most 3 decimals");
    }
  });

  test("a CLF amount of 1.2345 is read and 1.23456 is refused", () => {
    expect(parseAmount("1.2345", "CLF", "en-US")).toEqual({ kind: "amount", amount: "1.2345" });
    expect(parseAmount("1.23456", "CLF", "en-US").kind).toBe("refused");
  });

  test("a KRW amount takes none", () => {
    expect(parseAmount("1500", "KRW", "en-US")).toEqual({ kind: "amount", amount: "1500" });
    expect(parseAmount("1500.5", "KRW", "en-US").kind).toBe("refused");
  });

  test("the echo and the formatting write the currency's units", () => {
    expect(amountEcho("1.234", "BHD", "en-US")).toBe("= 1.234 BHD");
    expect(amountEcho("1.5", "KWD", "it-IT")).toBe("= 1,500 KWD");
    expect(formatMoney("1.234", "BHD", "en-US")).toBe("BHD 1.234");
    expect(formatMoney("1234.5", "OMR", "it-IT")).toBe("OMR 1.234,500");
    expect(formatMoney("1234.5678", "CLF", "en-US")).toBe("CLF 1,234.5678");
    expect(formatMoney("1500", "KRW", "en-US")).toBe("KRW 1,500");
  });
});

describe("a MoneyField follows the table", () => {
  const props = (rest: object) => ({ label: "Fee", ...rest });

  test("a BHD result of 1.234 fits; 1.2345 and a two-decimal currency's third decimal do not", () => {
    expect(
      moneyFieldResultProblems({ amount: "1.234", currency: "BHD" }, props({ currency: "BHD" })),
    ).toEqual([]);
    expect(
      moneyFieldResultProblems({ amount: "1.2345", currency: "BHD" }, props({ currency: "BHD" })),
    ).not.toEqual([]);
    expect(
      moneyFieldResultProblems({ amount: "1.234", currency: "EUR" }, props({ currency: "EUR" })),
    ).not.toEqual([]);
  });

  test("a BHD bound of 0.005 stands, since BHD takes 3 decimals; the same bound in EUR is refused", () => {
    expect(moneyFieldPropsProblems(props({ currency: "BHD", max: "0.005" }))).toEqual([]);
    const eur = moneyFieldPropsProblems(props({ currency: "EUR", max: "0.005" }));
    expect(eur).toHaveLength(1);
    expect(eur[0]?.message).toContain("more decimals than EUR takes (2)");
  });

  test("a BHD bound of 0.0005 is refused, the problem naming the 3 decimals", () => {
    const problems = moneyFieldPropsProblems(props({ currency: "BHD", max: "0.0005" }));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain("more decimals than BHD takes (3)");
  });
});
