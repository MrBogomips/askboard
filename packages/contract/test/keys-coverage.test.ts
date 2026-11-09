// Every shipped widget type has a key table or a line saying why not (keyboard-shortcuts-help,
// task 1.5, design decision 6; contract spec: Widget types without a key table). A widget that
// merges after this change declares its table or why it has none, or this test fails naming it, as
// `tools/nested-items.test.ts` does for direct reads.

import { describe, expect, test } from "bun:test";
import { PROBE_WIDGET } from "../src/fixtures/index.ts";
import { WIDGET_TYPES, type WidgetType } from "../src/index.ts";

/**
 * Why a shipped type has no key table:
 * - `standard`: only keys the browser, Radix or the WAI-ARIA radio group define, which `askboard-help`'s
 *   concepts teach;
 * - `none`: no keys of its own;
 * - `keyboard-retrofit-grids`: the change that adds its table.
 */
type Reason = "standard" | "none" | "keyboard-retrofit-grids";

/** A type's line ends where its table begins: a retrofit deletes its own lines. */
const WITHOUT_TABLE: Readonly<Record<string, Reason>> = {
  approval: "standard",
  scale: "standard",
  "text-field": "standard",
  "number-field": "standard",
  "money-field": "standard",
  "date-field": "standard",
  toggle: "standard",
  "pick-field": "standard",
  tabs: "standard",
  text: "none",
  value: "none",
  divider: "none",
  stack: "none",
  row: "none",
  group: "none",
  latex: "keyboard-retrofit-grids",
  table: "keyboard-retrofit-grids",
  "document-review": "keyboard-retrofit-grids",
};

/** The types with neither a table nor a line, by name. */
const uncovered = (types: readonly WidgetType[]): readonly string[] =>
  types
    .filter(({ type, keys }) => keys === undefined && !Object.hasOwn(WITHOUT_TABLE, type))
    .map(({ type }) => type);

/** The lines that no longer say anything true: a type that has a table, or is not registered. */
const stale = (types: readonly WidgetType[]): readonly string[] =>
  Object.keys(WITHOUT_TABLE).filter((name) => {
    const found = types.find(({ type }) => type === name);
    return found === undefined || found.keys !== undefined;
  });

describe("the shipped types' key tables", () => {
  test("every type has a table or a line with its reason", () => {
    expect(uncovered(WIDGET_TYPES)).toEqual([]);
  });

  test("no line is stale: each names a registered type that has no table", () => {
    expect(stale(WIDGET_TYPES)).toEqual([]);
  });

  test("lists every shipped type but the six with tables, the LaTeX, the Table and the Document review under the grids retrofit", () => {
    const withTable = WIDGET_TYPES.filter(({ keys }) => keys !== undefined).map(({ type }) => type);
    expect(withTable).toEqual(["tree", "gantt", "ranking", "kanban", "timeline", "chart"]);
    expect(Object.keys(WITHOUT_TABLE)).toHaveLength(WIDGET_TYPES.length - withTable.length);
    const retrofit = Object.entries(WITHOUT_TABLE)
      .filter(([, reason]) => reason === "keyboard-retrofit-grids")
      .map(([type]) => type);
    expect(retrofit.sort()).toEqual(["document-review", "latex", "table"]);
  });

  test("a reason is one of the three", () => {
    for (const reason of Object.values(WITHOUT_TABLE)) {
      expect(["standard", "none", "keyboard-retrofit-grids"]).toContain(reason);
    }
  });
});

describe("a type registered with neither", () => {
  test("fails by name", () => {
    expect(uncovered([...WIDGET_TYPES, PROBE_WIDGET])).toEqual(["probe"]);
  });

  test("a type with a table needs no line, and one with a line needs no table", () => {
    const keyed: WidgetType = { ...PROBE_WIDGET, keys: [] };
    expect(uncovered([...WIDGET_TYPES, keyed])).toEqual([]);
    const lined: WidgetType = { ...PROBE_WIDGET, type: "latex" };
    expect(uncovered([lined])).toEqual([]);
  });

  test("a line for a type that has since got a table, or is gone, is stale", () => {
    const [latex] = WIDGET_TYPES.filter(({ type }) => type === "latex");
    if (latex === undefined) throw new Error("no latex");
    expect(stale([{ ...latex, keys: [] }])).toContain("latex");
    expect(stale([])).toContain("latex");
  });
});
