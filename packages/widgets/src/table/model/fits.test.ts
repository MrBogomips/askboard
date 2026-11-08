import { describe, expect, test } from "bun:test";
import { TABLE_EDITED_PROPS, TABLE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { tableValueFits } from "./fits.ts";

const SENT = TABLE_FIXTURE_ITEM.props;

describe("an edited value fits the Table the revision shows", () => {
  test("when its columns, label and fixedRows are the revision's and its cells pass", () => {
    expect(tableValueFits(SENT, SENT)).toBe(true);
    expect(tableValueFits(TABLE_EDITED_PROPS, SENT)).toBe(true);
    // The order of an object's keys is no difference.
    const reordered = { rows: SENT.rows, label: SENT.label, columns: SENT.columns };
    expect(tableValueFits(reordered, SENT)).toBe(true);
  });

  test("not when a column, the label or fixedRows differs", () => {
    expect(tableValueFits({ ...SENT, columns: SENT.columns.slice(0, 3) }, SENT)).toBe(false);
    expect(tableValueFits({ ...SENT, label: "Other" }, SENT)).toBe(false);
    expect(tableValueFits({ ...SENT, fixedRows: true }, SENT)).toBe(false);
    const columns = SENT.columns.map((column, at) => (at === 1 ? { ...column, min: 1 } : column));
    expect(tableValueFits({ ...SENT, columns }, SENT)).toBe(false);
  });

  test("not when a cell breaks its column's check or a row holds a computed field", () => {
    const [pm, dev] = SENT.rows;
    expect(tableValueFits({ ...SENT, rows: [{ ...pm, days: -1 }, dev] }, SENT)).toBe(false);
    expect(tableValueFits({ ...SENT, rows: [{ ...pm, amount: "5.00" }, dev] }, SENT)).toBe(false);
  });

  test("not for a value that is no object, and props that are none", () => {
    expect(tableValueFits(undefined, SENT)).toBe(false);
    expect(tableValueFits(null, SENT)).toBe(false);
    expect(tableValueFits("x", SENT)).toBe(false);
    expect(tableValueFits([], SENT)).toBe(false);
    expect(tableValueFits(SENT, undefined)).toBe(false);
    for (const none of [undefined, null, 5, "s", [], {}])
      expect(tableValueFits(none, none)).toBe(false);
    expect(tableValueFits({ ...SENT, columns: 5 }, { ...SENT, columns: [5] })).toBe(false);
  });
});
