// The key vocabulary (keyboard-shortcuts-help, task 1.1; view-and-widgets spec: A common key
// vocabulary, The approved keys outside the core vocabulary): each action's bindings as design
// decision 2 gives them, the PO's approved rows included.

import { describe, expect, test } from "bun:test";
import {
  isVocabularyAction,
  KEY_HOLDS,
  KEY_SHOWS,
  KEY_VOCABULARY,
  type KeyBinding,
  keyBinding,
  ownEntry,
  type VocabularyAction,
  vocabularyEntry,
  vocabularyLabel,
} from "../src/index.ts";

const b = (key: string, hold: KeyBinding["hold"] = "none"): KeyBinding => ({ key, hold });
const shown = ({ key, hold }: KeyBinding): string => `${hold}:${key}`;
const keysOf = (action: VocabularyAction): readonly string[] =>
  KEY_VOCABULARY[action].keys.map(shown);

// Design decision 2's table, row by row.
const TABLE: readonly (readonly [VocabularyAction, readonly KeyBinding[], "selected"?])[] = [
  ["cursor.up", [b("ArrowUp")]],
  ["cursor.down", [b("ArrowDown")]],
  ["cursor.left", [b("ArrowLeft")]],
  ["cursor.right", [b("ArrowRight")]],
  ["cursor.first", [b("Home")]],
  ["cursor.last", [b("End")]],
  ["select.toggle", [b(" ")]],
  ["select.extendUp", [b("ArrowUp", "shift")]],
  ["select.extendDown", [b("ArrowDown", "shift")]],
  ["select.all", [b("a", "mod")]],
  ["select.none", [b("Escape")], "selected"],
  ["move.up", [b("ArrowUp", "alt+shift")]],
  ["move.down", [b("ArrowDown", "alt+shift")]],
  ["move.left", [b("ArrowLeft", "alt+shift")]],
  ["move.right", [b("ArrowRight", "alt+shift")]],
  ["move.top", [b("Home", "alt+shift"), b("ArrowUp", "mod+shift")]],
  ["move.bottom", [b("End", "alt+shift"), b("ArrowDown", "mod+shift")]],
  ["add.after", [b("Enter", "alt+shift")]],
  ["add.child", [b("Enter", "mod+shift")]],
  ["edit.start", [b("Enter"), b("F2")]],
  ["edit.commit", [b("Enter")]],
  ["edit.cancel", [b("Escape")]],
  ["delete", [b("Delete"), b("Backspace"), b("Delete", "alt+shift"), b("Backspace", "alt+shift")]],
  ["adjust.percent", [b("%", "char")], "selected"],
  ["undo", [b("z", "mod")]],
  ["keys.open", [b("?", "char")]],
  ["toolbar.previous", [b("ArrowLeft")]],
  ["toolbar.next", [b("ArrowRight")]],
  ["toolbar.first", [b("Home")]],
  ["toolbar.last", [b("End")]],
];

describe("the vocabulary's bindings", () => {
  for (const [action, keys, when] of TABLE) {
    test(`${action} has the keys of design decision 2`, () => {
      expect(keysOf(action)).toEqual(keys.map(shown));
      expect(KEY_VOCABULARY[action].when).toBe(when);
    });
  }

  test("holds exactly the actions of the table", () => {
    expect(Object.keys(KEY_VOCABULARY).sort()).toEqual(TABLE.map(([action]) => action).sort());
  });

  test("the approved rows (question 1) are in it", () => {
    expect(keysOf("select.all")).toEqual(["mod:a"]);
    expect(keysOf("add.after")).toEqual(["alt+shift:Enter"]);
    expect(keysOf("add.child")).toEqual(["mod+shift:Enter"]);
    expect(keysOf("adjust.percent")).toEqual(["char:%"]);
    expect(keysOf("delete")).toContain("alt+shift:Delete");
    expect(keysOf("delete")).toContain("alt+shift:Backspace");
    expect(KEY_VOCABULARY["select.none"].when).toBe("selected");
    expect(KEY_VOCABULARY["adjust.percent"].when).toBe("selected");
  });

  test("a letter is written in lower case, and no binding names Tab, F1 or F3 to F12", () => {
    for (const { keys } of Object.values(KEY_VOCABULARY)) {
      for (const { key } of keys) {
        expect(key).toBe(key.length === 1 && /[a-z]/i.test(key) ? key.toLowerCase() : key);
        expect(key).not.toMatch(/^(Tab|F1|F[3-9]|F1[0-2])$/);
      }
    }
  });

  test("binds no key twice in one action", () => {
    for (const action of Object.keys(KEY_VOCABULARY) as VocabularyAction[]) {
      const keys = keysOf(action);
      expect({ action, keys: new Set(keys).size }).toEqual({ action, keys: keys.length });
    }
  });

  test("binds no key twice across the actions, but where a part keeps them apart", () => {
    // Each key and hold belongs to one action, but the six plain keys the vocabulary shares by
    // design: the cursor and the toolbar read the arrows, Home and End in their own parts, and
    // Enter and Escape are read by an editor, a list and a keep action in theirs.
    const SHARED = new Set([
      "none:ArrowLeft",
      "none:ArrowRight",
      "none:Home",
      "none:End",
      "none:Enter",
      "none:Escape",
    ]);
    const seen = new Map<string, string>();
    for (const [action, { keys }] of Object.entries(KEY_VOCABULARY)) {
      for (const key of keys) {
        const id = shown(key);
        const other = seen.get(id);
        if (other !== undefined && !SHARED.has(id)) {
          throw new Error(`${id} is bound to ${other} and to ${action}`);
        }
        seen.set(id, action);
      }
    }
  });
});

describe("the vocabulary is data", () => {
  test("is frozen at every level", () => {
    expect(Object.isFrozen(KEY_VOCABULARY)).toBe(true);
    for (const entry of Object.values(KEY_VOCABULARY)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.keys)).toBe(true);
      for (const binding of entry.keys) expect(Object.isFrozen(binding)).toBe(true);
    }
  });

  test("names the holds and the visible counterparts an entry may take", () => {
    expect([...KEY_HOLDS]).toEqual(["none", "shift", "alt+shift", "mod", "mod+shift", "char"]);
    expect([...KEY_SHOWS]).toEqual(["tool", "menu", "pointer", "navigation", "panel", "native"]);
  });

  test("tells a vocabulary action from a type's own and from an inherited name", () => {
    expect(isVocabularyAction("move.up")).toBe(true);
    expect(isVocabularyAction("ranking.keep")).toBe(false);
    expect(isVocabularyAction("toString")).toBe(false);
    expect(isVocabularyAction("__proto__")).toBe(false);
  });
});

describe("the entry builders", () => {
  test("a vocabulary entry carries the vocabulary's keys, `when` and a label key", () => {
    const entry = vocabularyEntry("select.none", "list", "tool");
    expect(entry).toEqual({
      action: "select.none",
      part: "list",
      keys: KEY_VOCABULARY["select.none"].keys,
      label: vocabularyLabel("select.none"),
      shows: "tool",
      when: "selected",
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect("when" in vocabularyEntry("move.up", "list", "tool")).toBe(false);
  });

  test("a vocabulary entry takes another label and a subset of keys, as it is given", () => {
    const entry = vocabularyEntry("delete", "grid", "tool", {
      label: "table.deleteRow",
      keys: [keyBinding("Delete", "alt+shift")],
    });
    expect(entry.label).toBe("table.deleteRow");
    expect(entry.keys.map(shown)).toEqual(["alt+shift:Delete"]);
  });

  test("an own entry names its keys and, by default, a label key from its action", () => {
    const entry = ownEntry("ranking.keep", "list", [keyBinding("Enter")], "tool");
    expect(entry).toEqual({
      action: "ranking.keep",
      part: "list",
      keys: [{ key: "Enter", hold: "none" }],
      label: "keys.action.ranking.keep",
      shows: "tool",
    });
    expect(ownEntry("a.b", "p", [], "menu", "x.y").label).toBe("x.y");
    expect(keyBinding("Home")).toEqual({ key: "Home", hold: "none" });
  });

  test("the label key of an action is `keys.action.` and the action", () => {
    expect(vocabularyLabel("cursor.up")).toBe("keys.action.cursor.up");
  });
});
