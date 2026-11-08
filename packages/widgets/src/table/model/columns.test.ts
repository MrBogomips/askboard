import { describe, expect, test } from "bun:test";
import type { TableColumn } from "@askboard/contract";
import { TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import {
  alignmentOf,
  ariaChecked,
  inputColumns,
  isInputColumn,
  nextToggle,
  shownCell,
  toggleState,
} from "./columns.ts";

const [ROLE, DAYS, RATE, AMOUNT] = TABLE_FIXTURE_ITEM.props.columns as [
  TableColumn,
  TableColumn,
  TableColumn,
  TableColumn,
];
const TOGGLE: TableColumn = { field: "billable", label: "Billable", type: "toggle" };
const DATE: TableColumn = { field: "due", label: "Due", type: "date" };
const UNIT: TableColumn = { field: "load", label: "Load", type: "number", unit: "h" };

describe("the columns the user edits", () => {
  test("are those without a formula", () => {
    expect(isInputColumn(DAYS)).toBe(true);
    expect(isInputColumn(AMOUNT)).toBe(false);
    expect(inputColumns([ROLE, DAYS, RATE, AMOUNT])).toEqual([ROLE, DAYS, RATE]);
  });
});

describe("alignment", () => {
  test("numbers and money read from the right, a toggle from the middle", () => {
    expect(alignmentOf("number")).toBe("end");
    expect(alignmentOf("money")).toBe("end");
    expect(alignmentOf("toggle")).toBe("center");
    expect(alignmentOf("text")).toBe("start");
    expect(alignmentOf("date")).toBe("start");
  });
});

describe("a cell shown in the ask's locale", () => {
  test.each([
    ["en-US", "3", "$1,040.00", "10/27/2026"],
    ["it-IT", "3", "$ 1.040,00", "27/10/2026"],
  ] as const)("each type in %s", (locale, _, money, date) => {
    expect(shownCell(DAYS, 1234.5, locale, locale)).toBe(
      locale === "en-US" ? "1,234.5" : "1.234,5",
    );
    expect(shownCell(RATE, "1040.00", locale, locale)).toBe(money);
    expect(shownCell(DATE, "2026-10-27", locale, locale)).toBe(date);
    expect(shownCell(ROLE, "Project manager", locale, locale)).toBe("Project manager");
  });

  test("a computed money value, which the graph gives as a number, shows at the currency's units", () => {
    expect(shownCell(AMOUNT, 18720, "en-US", "en-US")).toBe("$18,720.00");
    expect(shownCell(AMOUNT, 0.3333333, "it-IT", "it-IT")).toBe("$ 0,33");
    expect(shownCell({ ...AMOUNT, currency: "JPY" }, 1200, "en-US", "en-US")).toBe("JPY 1,200");
    expect(shownCell(AMOUNT, Number.POSITIVE_INFINITY, "en-US", "en-US")).toBe("—");
  });

  test("a number's unit follows after a space", () => {
    expect(shownCell(UNIT, 12, "en-US", "en-US")).toBe("12 h");
    expect(shownCell(UNIT, 1200, "it-IT", "it-IT")).toBe("1.200 h");
  });

  test("an empty cell shows nothing, except a toggle", () => {
    for (const column of [ROLE, DAYS, RATE, DATE]) {
      expect(shownCell(column, undefined, "en-US", "en-US")).toBe("");
    }
    expect(shownCell(TOGGLE, undefined, "en-US", "en-US")).toBe("Not set");
  });

  test("a toggle shows on, off or unset, in the ask's language", () => {
    expect(shownCell(TOGGLE, true, "en-US", "en-US")).toBe("On");
    expect(shownCell(TOGGLE, false, "en-US", "en-US")).toBe("Off");
    expect(shownCell(TOGGLE, undefined, "it-IT", "it-IT")).not.toBe("Not set");
    expect(shownCell(TOGGLE, true, "en-US", "it-IT")).not.toBe("On");
  });

  test("a value of the wrong kind, or text no format reads, shows as a dash", () => {
    for (const [column, value] of [
      [DAYS, "12"],
      [DAYS, Number.NaN],
      [RATE, true],
      [RATE, "twelve"],
      [DATE, 20261027],
      [DATE, "2026-02-30"],
      [ROLE, 7],
    ] as const) {
      expect(shownCell(column, value, "en-US", "en-US")).toBe("—");
    }
  });
});

describe("a toggle's states", () => {
  test("unset is apart from off", () => {
    expect(toggleState(true)).toBe("on");
    expect(toggleState(false)).toBe("off");
    expect(toggleState(undefined)).toBe("unset");
    expect(ariaChecked(true)).toBe("true");
    expect(ariaChecked(false)).toBe("false");
    expect(ariaChecked(undefined)).toBe("mixed");
  });

  test("Space cycles unset, on, off, on", () => {
    const first = nextToggle(undefined);
    const second = nextToggle(first);
    const third = nextToggle(second);
    expect([first, second, third]).toEqual([true, false, true]);
  });
});
