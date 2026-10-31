import { describe, expect, test } from "bun:test";
import type { TreeColumn } from "@askboard/contract";
import { fieldText } from "./cells.ts";

const days: TreeColumn = { field: "days", label: "Days", type: "number" };
const note: TreeColumn = { field: "note", label: "Note", type: "text" };

describe("fieldText", () => {
  test("a number as the en-US formatter writes it, without grouping or exponent", () => {
    expect(fieldText({ id: "a", label: "A", days: 1234.5 }, days)).toBe("1234.5");
    expect(fieldText({ id: "a", label: "A", days: 1e21 }, days)).toBe("1000000000000000000000");
  });

  test("a text as it is, markup included", () => {
    expect(fieldText({ id: "a", label: "A", note: "<b>x</b>" }, note)).toBe("<b>x</b>");
  });

  test("an absent field, or a key inherited from Object, as nothing", () => {
    expect(fieldText({ id: "a", label: "A" }, days)).toBe("");
    expect(fieldText({ id: "a", label: "A" }, { ...note, field: "constructor" })).toBe("");
  });
});
