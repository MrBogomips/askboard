import { describe, expect, test } from "bun:test";
import type { TreeColumn, TreePertProps } from "@askboard/contract";
import { affixOf, fieldText, nameColumnOf, PERT_VALUE_COLUMNS, pertFieldText } from "./cells.ts";

const days: TreeColumn = { field: "days", label: "Days", type: "number" };
const note: TreeColumn = { field: "note", label: "Note", type: "text" };

describe("fieldText in the ask's locale", () => {
  test("shows a number with the locale's decimal mark and no grouping", () => {
    expect(fieldText({ id: "a", label: "A", days: 1234.5 }, days, "it-IT")).toBe("1234,5");
    expect(fieldText({ id: "a", label: "A", days: 1234.5 }, days, "en-US")).toBe("1234.5");
  });
});

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

describe("a work breakdown's cells (molecules design decision 14)", () => {
  const optimistic: TreeColumn = { field: "optimistic", label: "Optimistic", type: "number" };
  const leaf = { id: "a", label: "A", optimistic: 3, note: "n", days: 2 };

  test("the name column reads Work package with pert, Name without", () => {
    const wbs: TreePertProps = { columns: [optimistic], nodes: [], pert: true };
    expect(nameColumnOf(wbs)).toBe("Work package");
    expect(nameColumnOf({ nodes: [] })).toBe("Name");
  });

  test("the two value columns follow the fields, labelled Expected effort and Spread", () => {
    expect(PERT_VALUE_COLUMNS).toEqual(["Expected effort", "Spread"]);
  });

  test("a leaf's estimate shows with the d affix; a parent's shows nothing", () => {
    expect(pertFieldText(leaf, optimistic, true)).toBe("3 d");
    expect(pertFieldText({ ...leaf, optimistic: 1234.5 }, optimistic, true)).toBe("1234.5 d");
    expect(pertFieldText(leaf, optimistic, false)).toBe("");
  });

  test("an emptied estimate shows nothing, and a field that is no estimate as it is", () => {
    expect(pertFieldText({ id: "a", label: "A" }, optimistic, true)).toBe("");
    expect(pertFieldText(leaf, note, true)).toBe("n");
    expect(pertFieldText(leaf, days, false)).toBe("2");
  });

  test("an estimate's editor keeps the d affix in a work breakdown; no other cell's does", () => {
    const wbs: TreePertProps = { columns: [optimistic, note], nodes: [], pert: true };
    expect([0, 1, 2, 3].map((cell) => affixOf(wbs, cell))).toEqual([
      undefined,
      "d",
      undefined,
      undefined,
    ]);
    expect(affixOf({ columns: [optimistic], nodes: [] }, 1)).toBeUndefined();
  });
});
