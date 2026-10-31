import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { echoDate, gridDate, parseDateEntry } from "./date.ts";

describe("the Gantt's en-US date entry", () => {
  test.each([
    ["12/9/2026", "2026-12-09"],
    ["2026-12-09", "2026-12-09"],
    [" 12/09/2026 ", "2026-12-09"],
    ["1/1/2027", "2027-01-01"],
    ["2/29/2028", "2028-02-29"],
    ["3/2/1900", "1900-03-02"],
    ["12/31/9999", "9999-12-31"],
  ])("reads %j as %s", (text, date) => {
    expect(parseDateEntry(text)).toEqual({ kind: "date", date });
  });

  test.each(["", "   "])("reads %j as an empty field", (text) => {
    expect(parseDateEntry(text)).toEqual({ kind: "empty" });
  });

  test.each([
    ["13/1/2026", "13 is not a month: write month/day/year, as in 12/9/2026"],
    ["0/1/2026", "0 is not a month: write month/day/year, as in 12/9/2026"],
    ["2/30/2026", "February 2026 has no day 30"],
    ["2/29/2027", "February 2027 has no day 29"],
    ["2026-02-30", "February 2026 has no day 30"],
    ["12/9", "Write the year too: month/day/year, as in 12/9/2026"],
    ["9.12.2026", "Write the date as month/day/year, as in 12/9/2026"],
    ["12/9/26", "Write the date as month/day/year, as in 12/9/2026"],
    ["2026-12-9", "Write the date as month/day/year, as in 12/9/2026"],
    ["Dec 9", "Write the date as month/day/year, as in 12/9/2026"],
    ["1899-12-31", "Pick a day from 3/2/1900 to 12/31/9999"],
    ["2/28/1900", "Pick a day from 3/2/1900 to 12/31/9999"],
    ["3/1/1900", "Pick a day from 3/2/1900 to 12/31/9999"],
  ])("refuses %j, saying why", (text, reason) => {
    expect(parseDateEntry(text)).toEqual({ kind: "refused", reason });
  });

  test.each([
    ["2026-12-09", "12/9/2026", "= Wed, Dec 9, 2026"],
    ["2026-11-02", "11/2/2026", "= Mon, Nov 2, 2026"],
    ["2028-02-29", "2/29/2028", "= Tue, Feb 29, 2028"],
    ["1900-03-02", "3/2/1900", "= Fri, Mar 2, 1900"],
    ["9999-12-31", "12/31/9999", "= Fri, Dec 31, 9999"],
  ])("shows %s as %s in the grid and echoes %s", (date, grid, echo) => {
    expect(gridDate(date)).toBe(grid);
    expect(echoDate(date)).toBe(echo);
  });

  test("reads back every day it shows, over 800 days of 2027", () => {
    for (let day = 0; day < 800; day++) {
      const month = 1 + (Math.floor(day / 28) % 12);
      const date = `2027-${String(month).padStart(2, "0")}-${String(1 + (day % 28)).padStart(2, "0")}`;
      expect(parseDateEntry(gridDate(date))).toEqual({ kind: "date", date });
    }
  });

  test.each(["2026-02-30", "12/9/2026", "1899-12-31", "1900-03-01"])(
    "refuses to show %s, no date it holds",
    (date) => {
      expect(() => gridDate(date)).toThrow(RangeError);
      expect(() => echoDate(date)).toThrow(RangeError);
    },
  );

  test("gives the same results in any time zone, using no Date", async () => {
    const source = await Bun.file(join(import.meta.dir, "date.ts")).text();
    expect(/\bDate\b/.test(source.replace(/\/\/.*$/gm, ""))).toBe(false);
    const script = `import { echoDate, parseDateEntry } from ${JSON.stringify(join(import.meta.dir, "date.ts"))};
console.log(JSON.stringify(["12/9/2026", "2/29/2028", "1/1/2027"].map((t) => {
  const entry = parseDateEntry(t);
  return entry.kind === "date" ? echoDate(entry.date) : entry;
})));`;
    const run = (tz: string) =>
      Bun.spawnSync(["bun", "-e", script], { env: { ...process.env, TZ: tz } }).stdout.toString();
    const here = run("Pacific/Kiritimati");
    expect(JSON.parse(here)).toEqual([
      "= Wed, Dec 9, 2026",
      "= Tue, Feb 29, 2028",
      "= Fri, Jan 1, 2027",
    ]);
    expect(run("America/Adak")).toBe(here);
  });
});
