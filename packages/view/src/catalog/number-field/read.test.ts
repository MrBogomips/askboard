import { describe, expect, test } from "bun:test";
import { changeNumber, numberTextHandler, readNumber, shownNumber } from "./read.ts";

// A NumberField's text read in the ask's locale against its bounds (atoms, task 5.4; view-and-widgets
// spec: Number, amount and date entry in the fields, An entry blocks Answer; design decision 3):
// a value within bounds is a result, an empty text is none, anything else is an entry with the
// parser's reason or the bound broken. Plain functions, tested without a DOM.

const DAYS = { label: "Days", min: 0, max: 20, step: 0.5 } as const;

describe("reading a number", () => {
  test("a value within the bounds, in en-US and in it-IT", () => {
    expect(readNumber("3.5", DAYS, "en-US", "en-US")).toEqual({ kind: "value", value: 3.5 });
    expect(readNumber("3,5", DAYS, "it-IT", "it-IT")).toEqual({ kind: "value", value: 3.5 });
    expect(readNumber("1.000", { label: "L" }, "it-IT", "it-IT")).toEqual({
      kind: "value",
      value: 1000,
    });
  });

  test("an empty text, or spaces, is none", () => {
    expect(readNumber("", DAYS, "en-US", "en-US")).toEqual({ kind: "empty" });
    expect(readNumber("  ", DAYS, "en-US", "en-US")).toEqual({ kind: "empty" });
  });

  test("an English habit in an Italian field is an entry, with the parser's reason in the ask's language", () => {
    const reading = readNumber("1.23", { label: "L" }, "it-IT", "it-IT");
    expect(reading.kind).toBe("entry");
    if (reading.kind === "entry") {
      expect(reading.error).toBe("Usa i punti solo tra gruppi di tre cifre, come in 1.234,5.");
      expect(reading.echo).toBeUndefined();
    }
  });

  test("the locale and the language can differ: the reason is in the language", () => {
    const reading = readNumber("1.23", { label: "L" }, "it-IT", "en-US");
    expect(reading.kind === "entry" && reading.error).toBe(
      "Use periods only between groups of three digits, as in 1.234,5.",
    );
  });

  test("past the maximum: 'At most 20.' with the echo of what was read", () => {
    expect(readNumber("21", DAYS, "en-US", "en-US")).toEqual({
      kind: "entry",
      error: "At most 20.",
      echo: "= 21",
    });
    expect(readNumber("21", DAYS, "it-IT", "it-IT")).toEqual({
      kind: "entry",
      error: "Al massimo 20.",
      echo: "= 21",
    });
  });

  test("below the minimum: 'At least 0.'", () => {
    expect(readNumber("-1", DAYS, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: "At least 0.",
    });
    expect(readNumber("-1", DAYS, "it-IT", "it-IT")).toMatchObject({ error: "Almeno 0." });
  });

  test("a fraction where only whole numbers go: 'A whole number.'", () => {
    const whole = { label: "Seats", integer: true, min: 1 };
    expect(readNumber("2.5", whole, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: "A whole number.",
    });
    expect(readNumber("2", whole, "en-US", "en-US")).toEqual({ kind: "value", value: 2 });
    expect(readNumber("2,5", whole, "it-IT", "it-IT")).toMatchObject({
      error: "Un numero intero.",
    });
  });

  test("off the step: 'A multiple of 0.5 from 0.', the step counted from the minimum", () => {
    expect(readNumber("3.25", DAYS, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: "A multiple of 0.5 from 0.",
    });
    expect(readNumber("3,25", DAYS, "it-IT", "it-IT")).toMatchObject({
      error: "Un multiplo di 0,5 a partire da 0.",
    });
    const from = { label: "L", min: 1, step: 2 };
    expect(readNumber("4", from, "en-US", "en-US")).toMatchObject({
      error: "A multiple of 2 from 1.",
    });
    expect(readNumber("5", from, "en-US", "en-US")).toEqual({ kind: "value", value: 5 });
  });

  test("the bound that fails first is named: whole, then the minimum, the maximum, the step", () => {
    const all = { label: "L", integer: true, min: 1, max: 9, step: 2 };
    expect(readNumber("0.5", all, "en-US", "en-US")).toMatchObject({ error: "A whole number." });
    expect(readNumber("0", all, "en-US", "en-US")).toMatchObject({ error: "At least 1." });
    expect(readNumber("11", all, "en-US", "en-US")).toMatchObject({ error: "At most 9." });
    expect(readNumber("4", all, "en-US", "en-US")).toMatchObject({
      error: "A multiple of 2 from 1.",
    });
  });
});

describe("what the field shows", () => {
  test("the entry while one is held, as typed", () => {
    expect(shownNumber({ entry: "21", result: undefined, typed: "21", locale: "en-US" })).toBe(
      "21",
    );
    expect(shownNumber({ entry: "1.23", result: 3, typed: undefined, locale: "it-IT" })).toBe(
      "1.23",
    );
  });

  test("else the result written as the parser reads it back, with the locale's mark", () => {
    expect(shownNumber({ entry: undefined, result: 3.5, typed: undefined, locale: "en-US" })).toBe(
      "3.5",
    );
    expect(shownNumber({ entry: undefined, result: 3.5, typed: undefined, locale: "it-IT" })).toBe(
      "3,5",
    );
    expect(
      shownNumber({ entry: undefined, result: 1234.5, typed: undefined, locale: "it-IT" }),
    ).toBe("1234,5");
  });

  test("the text as typed while it still reads as the result, so 10.0 stays 10.0 and a trailing zero is not lost", () => {
    expect(shownNumber({ entry: undefined, result: 10, typed: "10.0", locale: "en-US" })).toBe(
      "10.0",
    );
    expect(shownNumber({ entry: undefined, result: 10, typed: "10,0", locale: "it-IT" })).toBe(
      "10,0",
    );
  });

  test("a typed text that no longer reads as the result gives way to the result", () => {
    expect(shownNumber({ entry: undefined, result: 11, typed: "10.0", locale: "en-US" })).toBe(
      "11",
    );
    expect(shownNumber({ entry: undefined, result: 5, typed: "x", locale: "en-US" })).toBe("5");
  });

  test("no result and no entry is an empty field, whatever else the result holds", () => {
    expect(shownNumber({ entry: undefined, result: undefined, typed: "5", locale: "en-US" })).toBe(
      "",
    );
    expect(shownNumber({ entry: undefined, result: "5", typed: undefined, locale: "en-US" })).toBe(
      "",
    );
  });
});

describe("what a change of the text puts into the draft", () => {
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

  test("a value is the item's result", () => {
    const { calls, put } = sink();
    changeNumber("3.5", DAYS, "en-US", "en-US", put);
    expect(calls).toEqual([["result", 3.5]]);
  });

  test("an empty text clears both the result and the entry", () => {
    const { calls, put } = sink();
    changeNumber("", DAYS, "en-US", "en-US", put);
    expect(calls).toEqual([
      ["result", undefined],
      ["entry", undefined],
    ]);
  });

  test("anything else is the entry, as typed, and sets no result", () => {
    const { calls, put } = sink();
    changeNumber("21", DAYS, "en-US", "en-US", put);
    changeNumber("1,5x", DAYS, "en-US", "en-US", put);
    expect(calls).toEqual([
      ["entry", "21"],
      ["entry", "1,5x"],
    ]);
  });

  test("a text past 200 code points is cut before it is read", () => {
    const { calls, put } = sink();
    changeNumber("9".repeat(300), { label: "L" }, "en-US", "en-US", put);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("entry");
    expect(Array.from(String(calls[0]?.[1])).length).toBe(200);
  });
});

describe("the field's text handler", () => {
  test("it remembers the text as typed, cut at 200 code points, and changes the draft by it", () => {
    const calls: [string, unknown][] = [];
    const handle = numberTextHandler({
      props: DAYS,
      locale: "it-IT",
      language: "it-IT",
      put: {
        result: (value) => calls.push(["result", value]),
        entry: (value) => calls.push(["entry", value]),
      },
      remember: (text) => calls.push(["remember", text]),
    });
    handle("3,5");
    handle("21");
    expect(calls).toEqual([
      ["remember", "3,5"],
      ["result", 3.5],
      ["remember", "21"],
      ["entry", "21"],
    ]);
  });
});
