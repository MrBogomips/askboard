import { describe, expect, test } from "bun:test";
import type { TreeProps } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import {
  editableCells,
  enterCell,
  entryKindAt,
  entryKindOf,
  NAME_TOO_LONG,
  startTextOf,
  TEXT_TOO_LONG,
} from "./entry.ts";
import { ESTIMATE_OUT_OF_RANGE } from "./model/edits.ts";

const tree: TreeProps = Object.freeze({
  columns: [
    { field: "days", label: "Days", type: "number" },
    { field: "note", label: "Note", type: "text" },
  ],
  nodes: [
    { id: "a", label: "Alpha", days: 1234.5, note: "first" },
    { id: "b", label: "Beta", children: [{ id: "c", label: "Gamma" }] },
  ],
});

const nodeOf = (value: TreeProps, id: string) =>
  [...value.nodes, ...value.nodes.flatMap((node) => node.children ?? [])].find(
    (node) => node.id === id,
  );

describe("the cell editor's kind and starting text", () => {
  test("the name's cell, then one kind per column; past the columns there is none", () => {
    expect([0, 1, 2, 3].map((cell) => entryKindOf(tree.columns, cell))).toEqual([
      "name",
      "number",
      "text",
      undefined,
    ]);
    expect(entryKindOf(undefined, 0)).toBe("name");
    expect(entryKindOf(undefined, 1)).toBeUndefined();
  });

  test("the name, a number as the parser reads it back, a text, and nothing for an absent field", () => {
    const [alpha, beta] = tree.nodes;
    if (alpha === undefined || beta === undefined) throw new Error("no fixture nodes");
    expect(startTextOf(tree.columns, alpha, 0)).toBe("Alpha");
    expect(startTextOf(tree.columns, alpha, 1)).toBe("1234.5");
    expect(startTextOf(tree.columns, alpha, 2)).toBe("first");
    expect(startTextOf(tree.columns, beta, 1)).toBe("");
    expect(startTextOf(tree.columns, beta, 3)).toBe("");
  });
});

describe("enterCell", () => {
  test("a name renames the node", () => {
    const entry = enterCell(tree, "c", 0, "Gamma: two");
    expect(entry.kind).toBe("value");
    if (entry.kind !== "value") return;
    expect(nodeOf(entry.value, "c")?.label).toBe("Gamma: two");
  });

  test("an empty name, or the same name, changes nothing and is no refusal", () => {
    expect(enterCell(tree, "a", 0, "")).toEqual({ kind: "value", value: tree });
    expect(enterCell(tree, "a", 0, "Alpha")).toEqual({ kind: "value", value: tree });
  });

  test("a name past 200 characters is refused with its reason", () => {
    expect(enterCell(tree, "a", 0, "x".repeat(200)).kind).toBe("value");
    expect(enterCell(tree, "a", 0, "😀".repeat(201))).toEqual({
      kind: "refused",
      reason: NAME_TOO_LONG,
    });
  });

  test("an en-US number sets the field, and an empty entry empties it", () => {
    const entry = enterCell(tree, "c", 1, " 1,234.5 ");
    if (entry.kind !== "value") throw new Error("refused");
    expect(nodeOf(entry.value, "c")?.days).toBe(1234.5);
    const emptied = enterCell(tree, "a", 1, "");
    if (emptied.kind !== "value") throw new Error("refused");
    expect(Object.hasOwn(nodeOf(emptied.value, "a") ?? {}, "days")).toBe(false);
  });

  test("an ambiguous number is refused with the parser's reason", () => {
    const entry = enterCell(tree, "a", 1, "1,5");
    expect(entry.kind).toBe("refused");
    if (entry.kind !== "refused") return;
    expect(entry.reason).toContain("groups of three digits");
  });

  test("a text sets the field, an empty one empties it, and one past 1,000 characters is refused", () => {
    const entry = enterCell(tree, "a", 2, "<b>second</b>");
    if (entry.kind !== "value") throw new Error("refused");
    expect(nodeOf(entry.value, "a")?.note).toBe("<b>second</b>");
    const emptied = enterCell(tree, "a", 2, "");
    if (emptied.kind !== "value") throw new Error("refused");
    expect(Object.hasOwn(nodeOf(emptied.value, "a") ?? {}, "note")).toBe(false);
    expect(enterCell(tree, "a", 2, "x".repeat(1_001))).toEqual({
      kind: "refused",
      reason: TEXT_TOO_LONG,
    });
  });

  test("a cell past the columns or an unknown node changes nothing", () => {
    expect(enterCell(tree, "a", 3, "1")).toEqual({ kind: "value", value: tree });
    expect(enterCell(tree, "zz", 1, "1")).toEqual({ kind: "value", value: tree });
  });

  test("the entries are frozen and the input untouched", () => {
    const before = JSON.stringify(tree);
    const entry = enterCell(tree, "a", 1, "1,5");
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(enterCell(tree, "a", 1, "2"))).toBe(true);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe("a work breakdown's entries (molecules design decision 14; view spec, WBS values follow the edits)", () => {
  const wbs = uj2ExpandedBoardDocument.items[0].props.items[0].props;

  test("an estimate outside 0 to 100,000 working days is refused with its reason, the value kept", () => {
    expect(enterCell(wbs, "portal", 1, "-2")).toEqual({
      kind: "refused",
      reason: ESTIMATE_OUT_OF_RANGE,
    });
    expect(enterCell(wbs, "portal", 3, "100,001")).toEqual({
      kind: "refused",
      reason: ESTIMATE_OUT_OF_RANGE,
    });
    const taken = enterCell(wbs, "portal", 1, "4");
    expect(taken.kind === "value" ? nodeOf(taken.value, "portal")?.optimistic : undefined).toBe(4);
  });

  test("a parent's estimate cells, and the value cells past the fields, open no editor; a leaf's do", () => {
    expect(entryKindAt(wbs, "design", 1)).toBeUndefined();
    expect(entryKindAt(wbs, "design", 0)).toBe("name");
    expect(entryKindAt(wbs, "portal", 1)).toBe("number");
    expect(entryKindAt(wbs, "portal", 4)).toBeUndefined();
    expect(entryKindAt(wbs, "portal", 5)).toBeUndefined();
    expect(entryKindAt(tree, "b", 1)).toBe("number");
  });
});

describe("a number column in the ask's locale (settings-languages, task 9.1)", () => {
  test("starts an edit with the value as the locale writes it", () => {
    expect(startTextOf(tree.columns, nodeOf(tree, "a") as never, 1, "it-IT")).toBe("1234,5");
    expect(startTextOf(tree.columns, nodeOf(tree, "a") as never, 1)).toBe("1234.5");
  });

  test("reads 1.234,5 in it-IT as the JSON number 1234.5", () => {
    const entry = enterCell(tree, "b", 1, "1.234,5", "it-IT");
    expect(entry.kind).toBe("value");
    if (entry.kind !== "value") return;
    expect(nodeOf(entry.value, "b")?.days).toBe(1234.5);
  });

  test("refuses an en-US entry in it-IT with the Italian reason, and an en-US ask in English", () => {
    const italian = enterCell(tree, "b", 1, "1,234.5", "it-IT");
    expect(italian.kind).toBe("refused");
    if (italian.kind === "refused") expect(italian.reason).not.toBe("");
    const english = enterCell(tree, "b", 1, "1.234,5", "it-IT", "en-US");
    expect(english.kind).toBe("value");
    const mixed = enterCell(tree, "b", 1, "1.2.3", "it-IT", "en-US");
    const plain = enterCell(tree, "b", 1, "1.2.3", "it-IT", "it-IT");
    expect(
      mixed.kind === "refused" && plain.kind === "refused" && mixed.reason !== plain.reason,
    ).toBe(true);
  });
});

describe("the cells of a row that take an edit", () => {
  test("the name and each field of a Tree with columns, as a list of cell numbers", () => {
    expect(editableCells(tree, "a")).toBe("0,1,2");
  });

  test("none once the Tree is read-only", () => {
    expect(editableCells(tree, "a", true)).toBe("");
  });

  test("a work breakdown parent's estimates and the value cells are left out", () => {
    const wbs = uj2ExpandedBoardDocument.items[0].props.items[0].props;
    expect(editableCells(wbs, "design")).toBe("0");
    expect(editableCells(wbs, "portal")).toBe("0,1,2,3");
  });
});
