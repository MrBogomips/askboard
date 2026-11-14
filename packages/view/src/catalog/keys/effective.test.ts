import { describe, expect, test } from "bun:test";
import { type KeyEntry, ownEntry, RANKING_KEYS, vocabularyEntry } from "@askboard/contract";
import { entryInEffect, keysOpenEntryOf, keyTableOf, sameOverrides } from "./effective.ts";
import { KEYS_OPEN_ENTRY } from "./hint.ts";

// The keys in effect for a widget type (keyboard-shortcuts-help, design decision 19; view spec: The
// user's keys on the board): its table with the user's overrides applied, each entry marked with
// whose keys it holds, the table's or the user's. Pure.

const TABLE: readonly KeyEntry[] = [
  vocabularyEntry("cursor.down", "list", "navigation"),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("move.top", "list", "tool"),
  vocabularyEntry("keys.open", "list", "panel"),
  ownEntry("probe.menu", "toolbar", [], "menu", { readOnly: true, label: "kanban.moveTo" }),
];

const byAction = <Entry extends KeyEntry>(table: readonly Entry[], action: string): Entry => {
  const found = table.find((entry) => entry.action === action);
  if (found === undefined) throw new Error(`no ${action}`);
  return found;
};

describe("keyTableOf", () => {
  test("with no overrides every entry is the table's own", () => {
    const table = keyTableOf(TABLE, undefined);
    expect(table.map((entry) => entry.source)).toEqual([
      "table",
      "table",
      "table",
      "table",
      "table",
    ]);
    expect(table.map((entry) => entry.keys)).toEqual(TABLE.map((entry) => entry.keys));
  });

  test("an action the overrides name has the user's keys, an empty list none, both marked the user's", () => {
    const table = keyTableOf(TABLE, { "move.top": ["Mod+Alt+ArrowUp"], "move.up": [] });
    expect(byAction(table, "move.top").keys).toEqual([{ key: "ArrowUp", hold: "mod+alt" }]);
    expect(byAction(table, "move.up").keys).toEqual([]);
    expect(table.map((entry) => [entry.action, entry.source])).toEqual([
      ["cursor.down", "table"],
      ["move.up", "user"],
      ["move.top", "user"],
      ["keys.open", "table"],
      ["probe.menu", "table"],
    ]);
  });

  test("the part, label, shows and readOnly of a changed entry stay", () => {
    const table = keyTableOf(TABLE, { "move.top": ["Mod+Alt+ArrowUp"] });
    const { keys: _, source: __, ...changed } = byAction(table, "move.top");
    const { keys: ___, ...before } = byAction(TABLE, "move.top");
    expect(changed).toEqual(before);
  });

  test("keys equal to the table's, in another order, leave the table's own entry unmarked (S-42)", () => {
    const table = keyTableOf(TABLE, { "move.top": ["Mod+Shift+ArrowUp", "Alt+Shift+Home"] });
    expect(byAction(table, "move.top").source).toBe("table");
    const entry = byAction(table, "move.top");
    expect(entry.keys).toBe(byAction(TABLE, "move.top").keys);
    expect(table.every((each) => each.source === "table")).toBe(true);
  });

  test("keys equal to the table's with one repeated are not a change; a removed action stays the user's", () => {
    const repeated = keyTableOf(TABLE, {
      "move.top": ["Alt+Shift+Home", "Mod+Shift+ArrowUp", "Alt+Shift+Home"],
    });
    expect(byAction(repeated, "move.top").source).toBe("table");
    expect(byAction(keyTableOf(TABLE, { "move.top": [] }), "move.top").source).toBe("user");
    expect(byAction(keyTableOf(TABLE, { "move.top": ["Alt+Shift+Home"] }), "move.top").source).toBe(
      "user",
    );
  });

  test("an override that does not parse changes nothing and marks nothing", () => {
    const table = keyTableOf(TABLE, { "move.top": ["Ctrl+Home"] });
    expect(byAction(table, "move.top").source).toBe("table");
    expect(byAction(table, "move.top").keys).toEqual(byAction(TABLE, "move.top").keys);
  });

  test("a name from the prototype chain, or `__proto__` as an own name, changes no entry and marks none", () => {
    const own = JSON.parse('{"__proto__": ["Mod+Alt+ArrowUp"], "constructor": [], "toString": []}');
    const prototypes: readonly KeyEntry[] = [
      { ...vocabularyEntry("cursor.down", "list", "navigation"), action: "constructor" },
      { ...vocabularyEntry("cursor.down", "list", "navigation"), action: "toString" },
      { ...vocabularyEntry("cursor.down", "list", "navigation"), action: "__proto__" },
      { ...vocabularyEntry("cursor.down", "list", "navigation"), action: "hasOwnProperty" },
    ];
    // Overrides that name none of them as their own: nothing is looked up through the prototype.
    for (const table of [keyTableOf(prototypes, {}), keyTableOf(TABLE, own)]) {
      expect(table.every((entry) => entry.source === "table")).toBe(true);
    }
    const afterOwn = keyTableOf(TABLE, own);
    expect(afterOwn.map((entry) => entry.keys)).toEqual(TABLE.map((entry) => entry.keys));
  });

  test("a native entry is never the user's", () => {
    const native = ownEntry("probe.native", "list", [{ key: " ", hold: "none" }], "native", {
      readOnly: true,
    });
    const [entry] = keyTableOf([native], { "probe.native": ["x"] });
    expect(entry?.source).toBe("table");
  });

  test("the input is untouched and the result is not the input", () => {
    const before = JSON.stringify(TABLE);
    const table = keyTableOf(TABLE, { "move.up": [] });
    expect(JSON.stringify(TABLE)).toBe(before);
    expect(table).not.toBe(TABLE);
  });
});

describe("entryInEffect", () => {
  const table = keyTableOf(TABLE, { "move.top": ["Mod+Alt+ArrowUp"] });

  test("outside a frame (no table) the entry is as given", () => {
    const given = byAction(TABLE, "move.top");
    expect(entryInEffect(undefined, given)).toBe(given);
  });

  test("looks the entry's action and part up in the table in effect", () => {
    const found = entryInEffect(table, byAction(TABLE, "move.top"));
    expect(found.keys).toEqual([{ key: "ArrowUp", hold: "mod+alt" }]);
  });

  test("the part counts: another part's entry of the same action is not it", () => {
    const toolbar = { ...byAction(TABLE, "move.top"), part: "toolbar" };
    expect(entryInEffect(table, toolbar)).toBe(toolbar);
  });

  test("an entry the table does not hold stays as given", () => {
    const stranger = ownEntry("other.thing", "list", [{ key: "k", hold: "none" }], "tool", {
      readOnly: true,
    });
    expect(entryInEffect(table, stranger)).toBe(stranger);
  });

  test("an entry already in effect is not looked up again", () => {
    const inEffect = byAction(table, "move.up");
    expect(entryInEffect(table, inEffect)).toBe(inEffect);
  });
});

describe("keysOpenEntryOf", () => {
  test("is `?` with no overrides, or overrides that do not name it", () => {
    expect(keysOpenEntryOf(undefined).keys).toEqual(KEYS_OPEN_ENTRY.keys);
    expect(keysOpenEntryOf({ "move.top": [] }).keys).toEqual(KEYS_OPEN_ENTRY.keys);
    expect(keysOpenEntryOf(undefined).source).toBe("table");
  });

  test("takes the user's keys, none for an empty list", () => {
    const bound = keysOpenEntryOf({ "keys.open": ["Mod+Alt+Enter"] });
    expect(bound.keys).toEqual([{ key: "Enter", hold: "mod+alt" }]);
    expect(bound.source).toBe("user");
    expect(keysOpenEntryOf({ "keys.open": [] }).keys).toEqual([]);
  });

  test("keeps the Keys button's name and part", () => {
    const entry = keysOpenEntryOf({ "keys.open": [] });
    expect(entry.label).toBe(KEYS_OPEN_ENTRY.label);
    expect(entry.part).toBe(KEYS_OPEN_ENTRY.part);
  });
});

describe("sameOverrides", () => {
  test("the same object, or the same actions with the same combinations in the same order", () => {
    const a = { "move.top": ["Mod+Alt+ArrowUp"], "select.all": [] };
    expect(sameOverrides(a, a)).toBe(true);
    expect(sameOverrides(a, { "select.all": [], "move.top": ["Mod+Alt+ArrowUp"] })).toBe(true);
    expect(sameOverrides(undefined, undefined)).toBe(true);
  });

  test("a different set, a different list, or one side with none", () => {
    const a = { "move.top": ["Mod+Alt+ArrowUp"] };
    expect(sameOverrides(a, undefined)).toBe(false);
    expect(sameOverrides(undefined, a)).toBe(false);
    expect(sameOverrides(a, { "move.top": ["Mod+Alt+ArrowDown"] })).toBe(false);
    expect(sameOverrides(a, { "move.top": [] })).toBe(false);
    expect(sameOverrides(a, { "move.top": ["Mod+Alt+ArrowUp", "Mod+Alt+Home"] })).toBe(false);
    expect(sameOverrides(a, { "move.bottom": ["Mod+Alt+ArrowUp"] })).toBe(false);
    expect(sameOverrides(a, { ...a, "select.all": [] })).toBe(false);
  });

  test("an own name against an inherited one", () => {
    const own = JSON.parse('{"__proto__": ["x"]}');
    expect(sameOverrides(own, {})).toBe(false);
    expect(sameOverrides({ a: [] }, { b: [] })).toBe(false);
  });
});

describe("the Ranking's real table", () => {
  test("select.none given no key is the user's and keyless in effect", () => {
    const table = keyTableOf(RANKING_KEYS, { "select.none": [] });
    const entry = byAction(table, "select.none");
    expect(entry.keys).toEqual([]);
    expect(entry.source).toBe("user");
  });
});
