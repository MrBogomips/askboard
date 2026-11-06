import { describe, expect, test } from "bun:test";
import { PERT_HEADERS } from "./cells.ts";
import { FIELD_HEADER, HEADER_ROW, NOT_SELECTABLE, ROW } from "./classes.ts";

// Review F-22 and F-23: the work breakdown's headers fit on one line with the full name as a tip,
// and the rows take the density's height; F-05: a cell that is not edited takes no selection.
describe("the Tree's work breakdown headers", () => {
  test("a short label and the full name as the tip, both from the catalogue", () => {
    expect(PERT_HEADERS).toEqual([
      { label: "tree.expected", tip: "tree.expectedEffort" },
      { label: "tree.spread", tip: "tree.spread" },
    ]);
    expect(FIELD_HEADER.number).toContain("w-36");
  });
});

describe("the Tree's rows and cells", () => {
  test("rows and header row are the density's height, 32px compact and 40px comfortable", () => {
    expect(ROW).toContain("h-header-row");
    expect(HEADER_ROW).toContain("h-header-row");
    expect(`${ROW} ${HEADER_ROW}`).not.toContain("h-[36px]");
  });

  test("a cell takes no text selection unless it is edited", async () => {
    expect(NOT_SELECTABLE).toBe("select-none");
    const row = await Bun.file(new URL("./row.tsx", import.meta.url)).text();
    expect(row).toContain("selectable(edits(0))");
    expect(row).toContain("selectable(edited)");
  });
});
