// The keys in the generated skills (keyboard-shortcuts-help, design decisions 6 and 10; skills spec:
// Keys from the key tables): the English names and the two written forms of each key, held to the
// board's own `keyLabel`, and the Keys section of a widget type.

import { describe, expect, test } from "bun:test";
import { KEY_HOLDS, KEY_VOCABULARY, type KeyBinding, WIDGET_TYPES } from "@askboard/contract";
import { keyLabel } from "@askboard/view/catalog";
import { t } from "@askboard/view/strings";
import { contractSchemaResolver } from "./fields.ts";
import { actionLine, actionName, actionRows, keyForms, keysSection, keysText } from "./keys.ts";
import { renderWidgetReference } from "./references.ts";

const widget = (type: string) => {
  const entry = WIDGET_TYPES.find((candidate) => candidate.type === type);
  if (entry === undefined) throw new Error(`no widget ${type}`);
  return entry;
};

const say = (key: Parameters<typeof t>[1]) => t("en-US", key);

describe("keyForms", () => {
  const KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
    "Escape",
    "Delete",
    "Backspace",
    " ",
    "F2",
    "PageUp",
    "a",
    "z",
  ];

  test("writes every hold of every key as the board's keyLabel does, on Linux and on macOS", () => {
    for (const hold of [...KEY_HOLDS, "mod+alt"] as const) {
      if (hold === "char") continue;
      for (const key of KEYS) {
        const binding: KeyBinding = { key, hold };
        expect(keyForms(binding).linux).toBe(keyLabel(binding, "other", say));
        expect(keyForms(binding).mac).toBe(keyLabel(binding, "mac", say));
      }
    }
  });

  test("writes a printed character as it is, on both", () => {
    expect(keyForms({ key: "?", hold: "char" })).toEqual({ linux: "?", mac: "?" });
    expect(keyForms({ key: "%", hold: "char" })).toEqual({ linux: "%", mac: "%" });
  });

  test("keysText joins bindings with 'and' and puts the macOS forms in brackets", () => {
    expect(
      keysText([
        { key: "Home", hold: "alt+shift" },
        { key: "ArrowUp", hold: "mod+shift" },
      ]),
    ).toBe("Alt+Shift+Home and Ctrl+Shift+↑ (⌥⇧Home and ⇧⌘↑)");
  });
});

describe("the Ranking's Keys section", () => {
  const text = keysSection(widget("ranking"));

  test("lists Move up, To top and Keep this order with their keys in both forms", () => {
    expect(text).toContain("| Move up | list | Alt+Shift+↑ (⌥⇧↑) |");
    expect(text).toMatch(
      /\| To top \| list \| Alt\+Shift\+Home and Ctrl\+Shift\+↑ \(⌥⇧Home and ⇧⌘↑\) \|/,
    );
    expect(text).toContain("| Keep this order | list | Enter (↩) |");
  });

  test("says that the keys panel shows the keys in effect", () => {
    expect(text).toContain("keys panel");
    expect(text).toContain("keys in effect");
  });

  test("is empty for a type without a table, and holds no keyless entry", () => {
    expect(keysSection(widget("approval"))).toBe("");
    const tree = keysSection(widget("tree"));
    expect(tree.split("\n").filter((line) => line.endsWith("|  |"))).toEqual([]);
    expect(tree).not.toContain("tree.tool");
  });

  test("a selection-only action says so", () => {
    expect(text).toContain("Select none (with a selection)");
  });

  test("is in the reference of the type, before its example", () => {
    const reference = renderWidgetReference(widget("ranking"), contractSchemaResolver([])).text;
    expect(reference).toContain(text);
    expect(reference.indexOf("## Keys")).toBeLessThan(reference.indexOf("## Example"));
    const none = renderWidgetReference(widget("approval"), contractSchemaResolver([])).text;
    expect(none).not.toContain("## Keys");
  });
});

describe("the actions an override may name", () => {
  const rows = actionRows(WIDGET_TYPES);

  test("has every vocabulary action, then the own actions the tables bind with keys", () => {
    const names = rows.map(({ action }) => action);
    expect(names.slice(0, Object.keys(KEY_VOCABULARY).length)).toEqual(Object.keys(KEY_VOCABULARY));
    const own = WIDGET_TYPES.flatMap(({ keys }) =>
      (keys ?? []).filter((entry) => entry.keys.length > 0 && !(entry.action in KEY_VOCABULARY)),
    );
    expect(own.length).toBeGreaterThan(5);
    for (const { action } of own) expect(names).toContain(action);
    expect(new Set(names).size).toBe(names.length);
  });

  test("names each action as the board's tooltips do, with its default keys", () => {
    const line = (action: string) => {
      const row = rows.find((candidate) => candidate.action === action);
      if (row === undefined) throw new Error(`no row ${action}`);
      return actionLine(row);
    };
    expect(line("move.up")).toBe("- `move.up`: Move up, Alt+Shift+↑ (⌥⇧↑)");
    expect(line("select.none")).toContain("with a selection");
    expect(line("gantt.togglePredecessor")).toContain("not changeable");
    expect(line("keys.open")).toContain("?");
  });

  test("a vocabulary action no table binds still has its label's name", () => {
    expect(actionRows([]).find(({ action }) => action === "undo")?.name).toBe(
      actionName("keys.action.undo"),
    );
    expect(actionRows([])).toHaveLength(Object.keys(KEY_VOCABULARY).length);
  });
});
