import { describe, expect, test } from "bun:test";
import type { TableColumn } from "@askboard/contract";
import { editText } from "./columns.ts";
import { readCell } from "./read.ts";

const DAYS: TableColumn = { field: "days", label: "Days", type: "number", min: 0 };
const RATE: TableColumn = { field: "rate", label: "Rate", type: "money", currency: "USD" };
const DUE: TableColumn = { field: "due", label: "Due", type: "date" };
const ROLE: TableColumn = { field: "role", label: "Role", type: "text" };
const BILLABLE: TableColumn = { field: "billable", label: "Billable", type: "toggle" };

describe("the text an editor starts with", () => {
  test("is the value in the ask's locale, which the parsers read back", () => {
    expect(editText(DAYS, 1234.5, "en-US")).toBe("1,234.5");
    expect(editText(DAYS, 1234.5, "it-IT")).toBe("1.234,5");
    expect(editText(RATE, "1040.00", "it-IT")).toBe("1.040,00");
    expect(editText(RATE, "-5.50", "en-US")).toBe("-5.50");
    expect(editText({ ...RATE, currency: "JPY" }, "1200", "en-US")).toBe("1,200");
    expect(editText(DUE, "2026-10-27", "en-US")).toBe("10/27/2026");
    expect(editText(DUE, "2026-10-27", "it-IT")).toBe("27/10/2026");
    expect(editText(ROLE, "Developer", "en-US")).toBe("Developer");
    for (const [column, value, locale] of [
      [DAYS, 72, "it-IT"],
      [RATE, "960.00", "it-IT"],
      [DUE, "2026-10-27", "it-IT"],
    ] as const) {
      const reading = readCell(editText(column, value, locale), column, locale, locale);
      expect(reading.kind).toBe("value");
      expect(reading.kind === "value" && reading.value).toBe(value);
    }
  });

  test("is empty for an empty cell, a toggle and a value of the wrong kind", () => {
    expect(editText(DAYS, undefined, "en-US")).toBe("");
    expect(editText(DAYS, null, "en-US")).toBe("");
    expect(editText(BILLABLE, true, "en-US")).toBe("");
    expect(editText(DAYS, "x", "en-US")).toBe("");
    expect(editText(RATE, 5, "en-US")).toBe("");
    expect(editText(DUE, 5, "en-US")).toBe("");
    expect(editText(ROLE, 5, "en-US")).toBe("");
    expect(editText(DUE, "not a date", "en-US")).toBe("");
  });
});

describe("the echo of the typed text", () => {
  const echoOf = (typed: string, column: TableColumn, locale: "en-US" | "it-IT") => {
    const reading = readCell(typed, column, locale, locale);
    return reading.kind === "empty" ? undefined : "echo" in reading ? reading.echo : undefined;
  };

  test("names the value read, in the ask's locale", () => {
    expect(echoOf("960,00", RATE, "it-IT")).toBe("= 960,00 USD");
    expect(echoOf("12,5", DAYS, "it-IT")).toBe("= 12,5");
    expect(echoOf("27/10/2026", DUE, "it-IT")).toContain("2026");
  });

  test("is the entry's own when a bound is broken, and none for a text, an empty text, a refusal or a toggle", () => {
    expect(echoOf("-1", DAYS, "en-US")).toBe("= -1");
    expect(echoOf("Dev", ROLE, "en-US")).toBeUndefined();
    expect(echoOf("", DAYS, "en-US")).toBeUndefined();
    expect(echoOf("1.234,5", DAYS, "en-US")).toBeUndefined();
    expect(echoOf("on", BILLABLE, "en-US")).toBeUndefined();
  });
});
