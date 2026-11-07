import { describe, expect, test } from "bun:test";
import {
  changeMoney,
  type MoneyHandling,
  moneyPickHandler,
  moneyTextHandler,
  pickCurrency,
  readMoney,
  shownMoney,
} from "./read.ts";

// A MoneyField's amount read in the ask's locale for a currency, against its bounds (atoms, task 5.4;
// view-and-widgets spec: Number, amount and date entry in the fields, An entry blocks Answer; design
// decisions 2, 3 and 7): never through a float, and a readable amount before a currency is picked
// is an entry with "Pick a currency.". Plain functions, tested without a DOM.

const EUR = { label: "Fee", currency: "EUR" } as const;
const PICK = { label: "Fee", currencies: ["EUR", "USD", "JPY"] } as const;

describe("reading an amount", () => {
  test("the spec's Italian amount: 1.234,5 in EUR is 1234.50, with its echo", () => {
    expect(readMoney("1.234,5", "EUR", EUR, "it-IT", "it-IT")).toEqual({
      kind: "value",
      result: { amount: "1234.50", currency: "EUR" },
    });
  });

  test("an en-US amount; JPY takes none", () => {
    expect(readMoney("1,234.5", "EUR", EUR, "en-US", "en-US")).toEqual({
      kind: "value",
      result: { amount: "1234.50", currency: "EUR" },
    });
    expect(readMoney("1500", "JPY", PICK, "en-US", "en-US")).toEqual({
      kind: "value",
      result: { amount: "1500", currency: "JPY" },
    });
  });

  test("an empty text is none", () => {
    expect(readMoney("", "EUR", EUR, "en-US", "en-US")).toEqual({ kind: "empty" });
    expect(readMoney("", undefined, PICK, "en-US", "en-US")).toEqual({ kind: "empty" });
  });

  test("more decimals than the currency takes is an entry, the reason naming the currency", () => {
    expect(readMoney("12.345", "EUR", EUR, "en-US", "en-US")).toEqual({
      kind: "entry",
      error: "EUR takes at most 2 decimals, as in 12.50.",
      echo: undefined,
    });
    expect(readMoney("12,5", "JPY", PICK, "it-IT", "it-IT")).toMatchObject({
      kind: "entry",
      error: "JPY non ammette decimali, come in 50.",
    });
  });

  test("the number entry's refusals are the amount's: an English habit in Italian", () => {
    const reading = readMoney("1.23", "EUR", EUR, "it-IT", "it-IT");
    expect(reading.kind === "entry" && reading.error).toContain("Usa i punti solo tra gruppi");
  });

  test("a readable amount before a currency is picked is an entry: 'Pick a currency.'", () => {
    expect(readMoney("12", undefined, PICK, "en-US", "en-US")).toEqual({
      kind: "entry",
      error: "Pick a currency.",
      echo: undefined,
    });
    expect(readMoney("12,5", undefined, PICK, "it-IT", "it-IT")).toMatchObject({
      error: "Scegli una valuta.",
    });
  });

  test("an unreadable amount before a currency is picked gives the parser's reason, not the pick", () => {
    const reading = readMoney("12x", undefined, PICK, "en-US", "en-US");
    expect(reading.kind === "entry" && reading.error).toContain('"x" is not part of a number');
  });

  test("below the minimum or past the maximum, compared as decimals: the bound in the locale's money", () => {
    const bounded = { label: "Fee", currency: "EUR", min: "10.00", max: "100.50" } as const;
    expect(readMoney("9.99", "EUR", bounded, "en-US", "en-US")).toEqual({
      kind: "entry",
      error: "At least €10.00.",
      echo: "= 9.99 EUR",
    });
    expect(readMoney("100,51", "EUR", bounded, "it-IT", "it-IT")).toEqual({
      kind: "entry",
      error: "Al massimo € 100,50.",
      echo: "= 100,51 EUR",
    });
    expect(readMoney("10", "EUR", bounded, "en-US", "en-US").kind).toBe("value");
    expect(readMoney("100.50", "EUR", bounded, "en-US", "en-US").kind).toBe("value");
  });

  test("a currency the item does not offer is an entry asking for one", () => {
    expect(readMoney("12", "GBP", PICK, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: "Pick a currency.",
    });
  });

  test("an amount of 16 integer digits is refused by the parser, never rounded", () => {
    const reading = readMoney("1234567890123456", "EUR", EUR, "en-US", "en-US");
    expect(reading.kind).toBe("entry");
    expect(readMoney("123456789012345", "EUR", EUR, "en-US", "en-US").kind).toBe("value");
  });
});

describe("what the field shows", () => {
  test("the entry while one is held", () => {
    expect(shownMoney({ entry: "12", result: undefined, typed: undefined, locale: "en-US" })).toBe(
      "12",
    );
  });

  test("else the amount as the parser reads it back, with the locale's decimal mark", () => {
    const result = { amount: "1234.50", currency: "EUR" };
    expect(shownMoney({ entry: undefined, result, typed: undefined, locale: "en-US" })).toBe(
      "1234.50",
    );
    expect(shownMoney({ entry: undefined, result, typed: undefined, locale: "it-IT" })).toBe(
      "1234,50",
    );
  });

  test("the text as typed while it still reads as the same amount in the same currency", () => {
    const result = { amount: "12.50", currency: "EUR" };
    expect(shownMoney({ entry: undefined, result, typed: "12.5", locale: "en-US" })).toBe("12.5");
    expect(shownMoney({ entry: undefined, result, typed: "12.6", locale: "en-US" })).toBe("12.50");
  });

  test("no result, or one that is no amount, is an empty field", () => {
    expect(shownMoney({ entry: undefined, result: undefined, typed: "5", locale: "en-US" })).toBe(
      "",
    );
    expect(
      shownMoney({ entry: undefined, result: { amount: 5 }, typed: undefined, locale: "en-US" }),
    ).toBe("");
    expect(shownMoney({ entry: undefined, result: "5", typed: undefined, locale: "en-US" })).toBe(
      "",
    );
  });
});

describe("what a change puts into the draft", () => {
  const sink = () => {
    const calls: [string, unknown][] = [];
    return {
      calls,
      put: {
        result: (value: unknown) => calls.push(["result", value]),
        entry: (value: string | undefined) => calls.push(["entry", value]),
      },
    };
  };

  test("an amount in a currency is the result", () => {
    const { calls, put } = sink();
    changeMoney("1.234,5", "EUR", EUR, "it-IT", "it-IT", put);
    expect(calls).toEqual([["result", { amount: "1234.50", currency: "EUR" }]]);
  });

  test("an empty text clears the result and the entry", () => {
    const { calls, put } = sink();
    changeMoney("", "EUR", EUR, "en-US", "en-US", put);
    expect(calls).toEqual([
      ["result", undefined],
      ["entry", undefined],
    ]);
  });

  test("an amount typed before a currency is picked is an entry, and sets no result", () => {
    const { calls, put } = sink();
    changeMoney("12", undefined, PICK, "en-US", "en-US", put);
    expect(calls).toEqual([["entry", "12"]]);
  });

  test("picking a currency reads the text again: an entry becomes the result, an empty text gives none", () => {
    const first = sink();
    pickCurrency("USD", "12.5", PICK, "en-US", "en-US", first.put);
    expect(first.calls).toEqual([["result", { amount: "12.50", currency: "USD" }]]);
    const empty = sink();
    pickCurrency("USD", "", PICK, "en-US", "en-US", empty.put);
    expect(empty.calls).toEqual([]);
  });

  test("picking a currency that takes fewer decimals than the text has keeps the text as an entry", () => {
    const { calls, put } = sink();
    pickCurrency("JPY", "12.5", PICK, "en-US", "en-US", put);
    expect(calls).toEqual([["entry", "12.5"]]);
  });

  test("a text past 200 code points is cut before it is read", () => {
    const { calls, put } = sink();
    changeMoney("9".repeat(300), "EUR", EUR, "en-US", "en-US", put);
    expect(calls).toHaveLength(1);
    expect(Array.from(String(calls[0]?.[1])).length).toBe(200);
  });
});

describe("the field's handlers", () => {
  const handling = (over: Partial<MoneyHandling> = {}) => {
    const calls: [string, unknown][] = [];
    const base: MoneyHandling = {
      props: PICK,
      locale: "en-US",
      language: "en-US",
      put: {
        result: (value) => calls.push(["result", value]),
        entry: (value) => calls.push(["entry", value]),
      },
      currency: undefined,
      text: "12.5",
      remember: (text) => calls.push(["remember", text]),
      picked: (code) => calls.push(["picked", code]),
    };
    return { calls, handling: { ...base, ...over } };
  };

  test("the text handler remembers the text and reads it for the currency in hand", () => {
    const none = handling();
    moneyTextHandler(none.handling)("12");
    expect(none.calls).toEqual([
      ["remember", "12"],
      ["entry", "12"],
    ]);
    const euro = handling({ currency: "EUR" });
    moneyTextHandler(euro.handling)("12");
    expect(euro.calls).toEqual([
      ["remember", "12"],
      ["result", { amount: "12.00", currency: "EUR" }],
    ]);
  });

  test("the pick handler remembers the currency, then reads the shown text for it", () => {
    const { calls, handling: given } = handling();
    moneyPickHandler(given)("USD");
    expect(calls).toEqual([
      ["picked", "USD"],
      ["result", { amount: "12.50", currency: "USD" }],
    ]);
  });

  test("a pressed item pressed again gives an empty value: the pick stays", () => {
    const { calls, handling: given } = handling();
    moneyPickHandler(given)("");
    expect(calls).toEqual([]);
  });
});
