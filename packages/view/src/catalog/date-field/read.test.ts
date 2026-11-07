import { describe, expect, test } from "bun:test";
import { changeDate, dateTextHandler, readDate, shownDate } from "./read.ts";

// A DateField's text read in the ask's locale against its range (atoms, task 5.5; view-and-widgets
// spec: Number, amount and date entry in the fields, An entry blocks Answer; design decision 3): a
// date within the range is the result, an empty text is none, anything else is an entry with the
// parser's reason or the bound broken. Plain functions, tested without a DOM.

const LEAVE = { label: "Leave", min: "2026-03-01", max: "2026-06-30" } as const;
const OPEN = { label: "Start" } as const;

describe("reading a date", () => {
  test("a date typed in the locale's order, within the range", () => {
    expect(readDate("3/9/2026", LEAVE, "en-US", "en-US")).toEqual({
      kind: "value",
      date: "2026-03-09",
    });
    expect(readDate("9/3/2026", LEAVE, "it-IT", "it-IT")).toEqual({
      kind: "value",
      date: "2026-03-09",
    });
    expect(readDate("2026-03-09", LEAVE, "it-IT", "it-IT")).toEqual({
      kind: "value",
      date: "2026-03-09",
    });
  });

  test("an empty text is none", () => {
    expect(readDate("", OPEN, "en-US", "en-US")).toEqual({ kind: "empty" });
    expect(readDate("   ", OPEN, "en-US", "en-US")).toEqual({ kind: "empty" });
  });

  test("a date the parser refuses is an entry with its reason in the ask's language", () => {
    const en = readDate("13/45/2026", OPEN, "en-US", "en-US");
    expect(en).toMatchObject({ kind: "entry" });
    expect(en.kind === "entry" && en.echo).toBeUndefined();
    expect(en.kind === "entry" && en.error).toContain("13 is not a month");
    const it = readDate("2/30/2026", OPEN, "en-US", "it-IT");
    expect(it.kind === "entry" && it.error).toContain("non ha il giorno 30");
  });

  test("before the first day: 'On or after 3/1/2026.' with the echo of what was read", () => {
    expect(readDate("2/28/2026", LEAVE, "en-US", "en-US")).toEqual({
      kind: "entry",
      error: "On or after 3/1/2026.",
      echo: "= Sat, Feb 28, 2026",
    });
    expect(readDate("28/2/2026", LEAVE, "it-IT", "it-IT")).toEqual({
      kind: "entry",
      error: "Dal 01/03/2026 in poi.",
      echo: "= sab 28 feb 2026",
    });
  });

  test("after the last day: 'On or before 6/30/2026.'", () => {
    expect(readDate("7/1/2026", LEAVE, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: "On or before 6/30/2026.",
    });
    expect(readDate("1/7/2026", LEAVE, "it-IT", "it-IT")).toMatchObject({
      error: "Fino al 30/06/2026.",
    });
    expect(readDate("6/30/2026", LEAVE, "en-US", "en-US").kind).toBe("value");
    expect(readDate("3/1/2026", LEAVE, "en-US", "en-US").kind).toBe("value");
  });

  test("with no min or max the Gantt's days are the range", () => {
    expect(readDate("1/1/1900", OPEN, "en-US", "en-US")).toMatchObject({
      kind: "entry",
      error: expect.stringContaining("On or after"),
    });
    // The last day the Gantt knows is the last day a four-digit year can write.
    expect(readDate("12/31/9999", OPEN, "en-US", "en-US").kind).toBe("value");
    expect(readDate("3/2/1900", OPEN, "en-US", "en-US").kind).toBe("value");
    expect(readDate("3/1/1900", OPEN, "en-US", "en-US").kind).toBe("entry");
  });
});

describe("what the field shows", () => {
  test("the entry while one is held", () => {
    expect(shownDate({ entry: "13/45", result: undefined, typed: "13/45", locale: "en-US" })).toBe(
      "13/45",
    );
  });

  test("else the result written in the locale's own form", () => {
    expect(
      shownDate({ entry: undefined, result: "2026-03-09", typed: undefined, locale: "en-US" }),
    ).toBe("3/9/2026");
    expect(
      shownDate({ entry: undefined, result: "2026-03-09", typed: undefined, locale: "it-IT" }),
    ).toBe("09/03/2026");
  });

  test("the text as typed while it still reads as the result, so 2026-03-09 is not rewritten under the cursor", () => {
    expect(
      shownDate({ entry: undefined, result: "2026-03-09", typed: "2026-03-09", locale: "en-US" }),
    ).toBe("2026-03-09");
    expect(
      shownDate({ entry: undefined, result: "2026-03-09", typed: "3/9/2026", locale: "en-US" }),
    ).toBe("3/9/2026");
  });

  test("a typed text that no longer reads as the result gives way to it", () => {
    expect(
      shownDate({ entry: undefined, result: "2026-03-10", typed: "3/9/2026", locale: "en-US" }),
    ).toBe("3/10/2026");
  });

  test("no result is an empty field, and a result that is no date too", () => {
    expect(
      shownDate({ entry: undefined, result: undefined, typed: "3/9/2026", locale: "en-US" }),
    ).toBe("");
    expect(shownDate({ entry: undefined, result: "soon", typed: undefined, locale: "en-US" })).toBe(
      "",
    );
    expect(shownDate({ entry: undefined, result: 5, typed: undefined, locale: "en-US" })).toBe("");
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

  test("a date in the range is the result; an empty text clears the result and the entry; anything else is the entry", () => {
    const { calls, put } = sink();
    changeDate("3/9/2026", LEAVE, "en-US", "en-US", put);
    changeDate("", LEAVE, "en-US", "en-US", put);
    changeDate("7/1/2026", LEAVE, "en-US", "en-US", put);
    expect(calls).toEqual([
      ["result", "2026-03-09"],
      ["result", undefined],
      ["entry", undefined],
      ["entry", "7/1/2026"],
    ]);
  });

  test("a text past 200 code points is cut before it is read", () => {
    const { calls, put } = sink();
    changeDate("9".repeat(300), OPEN, "en-US", "en-US", put);
    expect(calls).toHaveLength(1);
    expect(Array.from(String(calls[0]?.[1])).length).toBe(200);
  });

  test("the text handler remembers the text as typed and changes the draft by it", () => {
    const { calls, put } = sink();
    const handle = dateTextHandler({
      props: LEAVE,
      locale: "en-US",
      language: "en-US",
      put,
      remember: (text) => calls.push(["remember", text]),
    });
    handle("3/9/2026");
    expect(calls).toEqual([
      ["remember", "3/9/2026"],
      ["result", "2026-03-09"],
    ]);
  });
});
