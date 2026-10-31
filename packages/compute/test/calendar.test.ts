import { describe, expect, test } from "bun:test";
import * as compute from "../src/index.ts";

const { addWorkingDays, firstWorkingDateFrom, isWorkingDate, workingDaysBetween } = compute;

describe("the working-day calendar on full-date strings", () => {
  test.each([
    ["2026-11-13", true],
    ["2026-11-14", false],
    ["2026-11-15", false],
    ["2026-11-16", true],
    ["2028-02-29", true],
    ["9999-12-31", true],
  ])("says whether %s is a working day", (date, working) => {
    expect(isWorkingDate(date)).toBe(working);
  });

  test.each([
    ["2026-11-13", "2026-11-13"],
    ["2026-11-14", "2026-11-16"],
    ["2026-11-15", "2026-11-16"],
    ["2026-12-26", "2026-12-28"],
    ["2027-01-02", "2027-01-04"],
  ])("gives the first working day on or after %s", (date, expected) => {
    expect(firstWorkingDateFrom(date)).toBe(expected);
  });

  test.each([
    ["2026-11-13", 1, "2026-11-16"],
    ["2026-11-13", 0, "2026-11-13"],
    ["2026-11-14", 0, "2026-11-14"],
    ["2026-11-02", 22, "2026-12-02"],
    ["2026-11-02", 29, "2026-12-11"],
    ["2026-11-16", -1, "2026-11-13"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-11-02", -5, "2026-10-26"],
  ])("gives the day %s plus %d working days as %s", (date, n, expected) => {
    expect(addWorkingDays(date, n)).toBe(expected);
  });

  test.each([
    ["2026-11-02", "2026-12-09", 27],
    ["2026-11-13", "2026-11-16", 1],
    ["2026-11-14", "2026-11-16", 0],
    ["2026-11-02", "2026-11-02", 0],
    ["2026-12-09", "2026-11-02", -27],
    ["2026-12-28", "2027-01-04", 5],
  ])("counts the working days from %s up to %s as %d", (from, to, expected) => {
    expect(workingDaysBetween(from, to)).toBe(expected);
  });

  test("adds back what it counts, from every working day to every working day of a year", () => {
    const from = "2026-11-02";
    for (let n = -130; n <= 130; n++) {
      const to = addWorkingDays(from, n);
      expect({ n, back: workingDaysBetween(from, to) }).toEqual({ n, back: n });
      expect(isWorkingDate(to)).toBe(true);
    }
  });

  test("works at the ends of the dates the graph holds", () => {
    expect(firstWorkingDateFrom("1900-03-03")).toBe("1900-03-05");
    expect(addWorkingDays("9999-12-30", 1)).toBe("9999-12-31");
    expect(() => addWorkingDays("9999-12-31", 1)).toThrow(RangeError);
    expect(() => addWorkingDays("1900-03-01", -1)).toThrow(RangeError);
    expect(() => firstWorkingDateFrom("9999-12-31")).not.toThrow();
  });

  test.each(["2026-02-30", "2026-11-2", "1900-02-28", "soon"])(
    "refuses the malformed date %s, naming it",
    (date) => {
      for (const call of [
        () => isWorkingDate(date),
        () => firstWorkingDateFrom(date),
        () => addWorkingDays(date, 1),
        () => workingDaysBetween(date, "2026-11-02"),
        () => workingDaysBetween("2026-11-02", date),
      ]) {
        expect(call).toThrow(RangeError);
        expect(call).toThrow(`"${date}" is not a date from 1900-03-01 to 9999-12-31`);
      }
    },
  );

  test("refuses a number of working days that is not a whole number", () => {
    expect(() => addWorkingDays("2026-11-02", 1.5)).toThrow(RangeError);
  });
});
