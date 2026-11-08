import { describe, expect, test } from "bun:test";
import {
  ENTRY_MAX_CHARS,
  TABLE_TEXT_MAX_CHARS,
  type TableColumn,
  tableCellProblems,
} from "@askboard/contract";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { say } from "@askboard/view/catalog";
import { readCell } from "./read.ts";

const [ROLE, DAYS, RATE] = TABLE_FIXTURE_ITEM.props.columns as [
  TableColumn,
  TableColumn,
  TableColumn,
];
const STEP: TableColumn = {
  field: "hours",
  label: "Hours",
  type: "number",
  min: 2,
  max: 10,
  step: 2,
};
const WHOLE: TableColumn = { field: "heads", label: "Heads", type: "number", integer: true };
const CAPPED: TableColumn = { field: "code", label: "Code", type: "text", maxLength: 5 };
const MONEY: TableColumn = {
  field: "fee",
  label: "Fee",
  type: "money",
  currency: "USD",
  min: "10.00",
  max: "99.50",
};
const DATE: TableColumn = {
  field: "due",
  label: "Due",
  type: "date",
  min: "2026-10-01",
  max: "2026-12-31",
};
const TOGGLE: TableColumn = { field: "billable", label: "Billable", type: "toggle" };

const read = (text: string, column: TableColumn, locale: "en-US" | "it-IT" = "en-US") =>
  readCell(text, column, locale, locale);

describe("a cell's text read in the ask's locale", () => {
  test("a number, money and a date give a value, and an empty text empties the cell", () => {
    expect(read("72", DAYS)).toEqual({ kind: "value", value: 72 });
    expect(read("1.234,5", { ...DAYS, max: undefined }, "it-IT")).toEqual({
      kind: "value",
      value: 1234.5,
    });
    expect(read("960,00", RATE, "it-IT")).toEqual({ kind: "value", value: "960.00" });
    expect(read("12/11/2026", DATE, "it-IT")).toEqual({ kind: "value", value: "2026-11-12" });
    expect(read("10/27/2026", DATE)).toEqual({ kind: "value", value: "2026-10-27" });
    for (const column of [ROLE, DAYS, RATE, DATE, TOGGLE]) {
      expect(read("  ", column).kind).toBe(column.type === "text" ? "value" : "empty");
      expect(read("", column)).toEqual({ kind: "empty" });
    }
  });

  test("the echo and the error are the parser's, in the ask's language", () => {
    expect(read("1.234,5", DAYS)).toMatchObject({
      kind: "entry",
      text: "1.234,5",
      echo: undefined,
    });
    const entry = read("1.234,5", DAYS);
    expect(entry.kind === "entry" && entry.error.length > 0).toBe(true);
    expect(read("abc", RATE, "it-IT").kind).toBe("entry");
  });

  test("a value of the wrong bound is an entry with the atoms' words and its echo", () => {
    expect(read("-1", DAYS)).toEqual({
      kind: "entry",
      text: "-1",
      error: "At least 0.",
      echo: "= -1",
    });
    expect(read("12", STEP)).toMatchObject({ error: "At most 10.", echo: "= 12" });
    expect(read("1", STEP)).toMatchObject({ error: "At least 2." });
    expect(read("5", STEP)).toMatchObject({ error: "A multiple of 2 from 2." });
    expect(read("2,5", WHOLE, "it-IT")).toMatchObject({
      error: say("it-IT", "field.whole"),
    });
    expect(read("2.5", WHOLE)).toMatchObject({ error: "A whole number." });
    expect(read("9", MONEY)).toMatchObject({ error: "At least $10.00.", echo: "= 9.00 USD" });
    expect(read("100", MONEY)).toMatchObject({ error: "At most $99.50." });
    expect(read("09/30/2026", DATE)).toMatchObject({ error: "On or after 10/1/2026." });
    expect(read("01/01/2027", DATE)).toMatchObject({ error: "On or before 12/31/2026." });
    expect(read("30/09/2026", DATE, "it-IT")).toMatchObject({
      error: say("it-IT", "field.onOrAfter", { date: "01/10/2026" }),
    });
  });

  test("a date and a number with no bound of their own read against the contract's range", () => {
    expect(read("12/31/1899", { ...DATE, min: undefined })).toMatchObject({
      kind: "entry",
      error: "On or after 3/2/1900.",
    });
    expect(read("12e30", { ...DAYS, min: undefined })).toMatchObject({ kind: "entry" });
  });

  test("a currency's minor units are held: a half yen is an entry", () => {
    const yen: TableColumn = { field: "fee", label: "Fee", type: "money", currency: "JPY" };
    expect(read("1200", yen)).toEqual({ kind: "value", value: "1200" });
    expect(read("1200.5", yen).kind).toBe("entry");
  });

  test("a text of 500 code points is taken and 501 is an entry cut at 200", () => {
    const taken = "é".repeat(TABLE_TEXT_MAX_CHARS);
    expect(read(taken, ROLE)).toEqual({ kind: "value", value: taken });
    const over = read("𝒳".repeat(TABLE_TEXT_MAX_CHARS + 1), ROLE);
    expect(over.kind).toBe("entry");
    if (over.kind === "entry") {
      expect(Array.from(over.text)).toHaveLength(ENTRY_MAX_CHARS);
      expect(over.error).toBe(`A text field holds at most ${TABLE_TEXT_MAX_CHARS} characters.`);
    }
  });

  test("a text over its column's maxLength is an entry naming the limit", () => {
    expect(read("12345", CAPPED)).toEqual({ kind: "value", value: "12345" });
    expect(read("123456", CAPPED)).toMatchObject({
      kind: "entry",
      text: "123456",
      error: "A text field holds at most 5 characters.",
    });
  });

  test("an entry of a number is cut at 200 code points before it is read", () => {
    const entry = read("9".repeat(300), DAYS);
    expect(entry.kind === "entry" && Array.from(entry.text).length).toBe(ENTRY_MAX_CHARS);
  });

  test("a toggle takes no text: no reading of one is an entry", () => {
    for (const text of ["", "  ", "on", "yes", "x".repeat(300)]) {
      for (const locale of ["en-US", "it-IT"] as const) {
        expect(read(text, TOGGLE, locale).kind).not.toBe("entry");
      }
    }
  });

  test("a value is a value exactly when the contract's cell check takes it", () => {
    const columns = [ROLE, DAYS, RATE, STEP, WHOLE, CAPPED, MONEY, DATE];
    const texts = [
      "",
      "0",
      "-1",
      "3",
      "4",
      "12",
      "1040.00",
      "9.99",
      "10",
      "99.5",
      "100",
      "12/09/2026",
      "abcdef",
      "2.5",
    ];
    for (const column of columns) {
      for (const text of texts) {
        const reading = read(text, column);
        if (reading.kind === "value") {
          expect(tableCellProblems(reading.value, column)).toEqual([]);
        }
      }
    }
  });

  test("a prototype name is only text", () => {
    expect(read("__proto__", ROLE)).toEqual({ kind: "value", value: "__proto__" });
    expect(read("constructor", DAYS).kind).toBe("entry");
  });
});
