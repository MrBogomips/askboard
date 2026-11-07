import { describe, expect, test } from "bun:test";
import { type Locale, tableOf } from "../../src/index.ts";

// The month and weekday names a calendar draws (atoms, task 5.5; view-and-widgets spec: The
// DateField's calendar): AskBoard's own tables, in the ask's language, never the runtime's.
describe("the calendar's names in each locale's table", () => {
  test("en-US months are the full names, January first, and weekdays Sunday first", () => {
    const table = tableOf("en-US");
    expect(table.months).toHaveLength(12);
    expect(table.months[0]).toBe("January");
    expect(table.months[11]).toBe("December");
    expect(table.weekdays).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  test("it-IT months are the full names in lower case and weekdays start at domenica", () => {
    const table = tableOf("it-IT");
    expect(table.months[0]).toBe("gennaio");
    expect(table.months[11]).toBe("dicembre");
    expect(table.weekdays).toEqual(["dom", "lun", "mar", "mer", "gio", "ven", "sab"]);
  });

  test("a weekday name is the one the long date writes for that day", () => {
    // 2026-11-01 is a Sunday.
    for (const locale of ["en-US", "it-IT"] as const satisfies readonly Locale[]) {
      const table = tableOf(locale);
      for (let day = 0; day < 7; day += 1) {
        const parts = { year: 2026, month: 11, day: 1 + day, weekday: day };
        expect(table.longDate(parts)).toContain(table.weekdays[day] ?? "none");
      }
    }
  });

  test("a locale outside the two is a RangeError", () => {
    expect(() => tableOf("fr-FR" as Locale)).toThrow(RangeError);
  });
});
