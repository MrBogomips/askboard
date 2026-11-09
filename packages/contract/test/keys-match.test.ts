// The matcher and the ARIA form (keyboard-shortcuts-help, task 1.2; view-and-widgets spec: Keys
// left to the browser, Key labels by platform).
//
// WAI-ARIA 1.2, `aria-keyshortcuts`: "The valid names for non-modifier keys are any printable
// character such as "A", "B", "1", "2", "$", "Plus" for a plus sign, "Space" for the spacebar, or
// the names of any other non-modifier key specified in the UI Events KeyboardEvent key Values spec
// - for example, "Enter", "Tab", "ArrowRight", "PageDown", "Escape", or "F1"." and "When specifying
// an alphabetic key, both the uppercase and lowercase variants are considered equivalent." It adds
// that a character a modifier produces should be given as the key used ("Shift+5", not "%"), "However,
// note that on some international keyboards the percent sign may be an unmodified key, in which case
// "%" and "Shift+%" could be correct on those keyboards."

import { describe, expect, test } from "bun:test";
import {
  ariaKeyShortcuts,
  type KeyEntry,
  type KeyPress,
  type KeyTable,
  keyActionOf,
  keyBinding,
  ownEntry,
  type PressHold,
  pressHold,
  vocabularyEntry,
} from "../src/index.ts";

const press = (key: string, hold: PressHold = "none", rest: Partial<KeyPress> = {}): KeyPress => ({
  key,
  hold,
  composing: false,
  inText: false,
  ...rest,
});

const TABLE: KeyTable = [
  vocabularyEntry("cursor.up", "list", "navigation"),
  vocabularyEntry("cursor.first", "list", "navigation"),
  vocabularyEntry("select.toggle", "list", "pointer"),
  vocabularyEntry("select.extendUp", "list", "pointer"),
  vocabularyEntry("select.all", "list", "tool"),
  vocabularyEntry("select.none", "list", "tool"),
  vocabularyEntry("move.up", "list", "tool"),
  vocabularyEntry("move.top", "list", "tool"),
  vocabularyEntry("adjust.percent", "list", "tool"),
  vocabularyEntry("keys.open", "list", "panel"),
  vocabularyEntry("undo", "list", "tool"),
  vocabularyEntry("edit.commit", "editor", "navigation"),
  vocabularyEntry("edit.cancel", "editor", "navigation"),
  vocabularyEntry("select.none", "editor", "tool"),
  ownEntry("ranking.keep", "list", [keyBinding("Enter")], "tool"),
  ownEntry("ranking.loud", "list", [], "tool"),
];

const hit = (
  part: string,
  p: KeyPress,
  selected = true,
  table: KeyTable = TABLE,
): string | undefined => keyActionOf(table, part, p, selected)?.action;

describe("pressHold", () => {
  const mods = (alt: boolean, ctrl: boolean, meta: boolean, shift: boolean) => ({
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: meta,
    shiftKey: shift,
  });

  test("names each hold a binding can name", () => {
    expect(pressHold(mods(false, false, false, false))).toBe("none");
    expect(pressHold(mods(false, false, false, true))).toBe("shift");
    expect(pressHold(mods(true, false, false, true))).toBe("alt+shift");
    expect(pressHold(mods(false, true, false, false))).toBe("mod");
    expect(pressHold(mods(false, false, true, false))).toBe("mod");
    expect(pressHold(mods(false, true, false, true))).toBe("mod+shift");
    expect(pressHold(mods(false, false, true, true))).toBe("mod+shift");
  });

  test("Alt alone, Ctrl with Alt, Ctrl with Cmd and a third modifier are `other`", () => {
    expect(pressHold(mods(true, false, false, false))).toBe("other");
    expect(pressHold(mods(true, true, false, false))).toBe("other");
    expect(pressHold(mods(true, false, true, false))).toBe("other");
    expect(pressHold(mods(false, true, true, false))).toBe("other");
    expect(pressHold(mods(false, true, true, true))).toBe("other");
    expect(pressHold(mods(true, true, false, true))).toBe("other");
    expect(pressHold(mods(true, true, true, true))).toBe("other");
  });
});

describe("keyActionOf: each hold matched exactly", () => {
  test("none, shift, alt+shift, mod and mod+shift each find their entry", () => {
    expect(hit("list", press("ArrowUp"))).toBe("cursor.up");
    expect(hit("list", press("ArrowUp", "shift"))).toBe("select.extendUp");
    expect(hit("list", press("ArrowUp", "alt+shift"))).toBe("move.up");
    expect(hit("list", press("ArrowUp", "mod+shift"))).toBe("move.top");
    expect(hit("list", press("z", "mod"))).toBe("undo");
    expect(hit("list", press("a", "mod"))).toBe("select.all");
  });

  test("a hold the entry does not name finds nothing", () => {
    expect(hit("list", press("Home", "shift"))).toBeUndefined();
    expect(hit("list", press("Home", "mod"))).toBeUndefined();
    expect(hit("list", press("ArrowDown", "alt+shift"))).toBeUndefined();
    expect(hit("list", press("Enter", "shift"))).toBeUndefined();
    expect(hit("list", press("z"))).toBeUndefined();
    expect(hit("list", press("z", "mod+shift"))).toBeUndefined();
  });

  test("Alt alone, Ctrl with Alt, a second modifier match nothing, whatever the key", () => {
    for (const key of ["ArrowUp", "Home", "Enter", "Escape", " ", "z", "a", "?", "%"]) {
      expect({ key, found: hit("list", press(key, "other")) }).toEqual({ key, found: undefined });
    }
  });

  test("a letter is matched in either case, as with Caps Lock", () => {
    expect(hit("list", press("Z", "mod"))).toBe("undo");
    expect(hit("list", press("A", "mod"))).toBe("select.all");
  });

  test("the part narrows the table: another part's keys are not this part's", () => {
    expect(hit("editor", press("ArrowUp"))).toBeUndefined();
    expect(hit("list", press("Escape"))).toBe("select.none");
    expect(hit("editor", press("Enter"))).toBe("edit.commit");
    expect(hit("list", press("Enter"))).toBe("ranking.keep");
    expect(hit("nowhere", press("Enter"))).toBeUndefined();
  });

  test("a keyless entry matches nothing", () => {
    const keyless: KeyTable = [ownEntry("x.y", "p", [], "tool")];
    expect(hit("p", press("Enter"), true, keyless)).toBeUndefined();
  });

  test("returns the entry of the table, not a copy", () => {
    const entry: KeyEntry | undefined = TABLE[0];
    expect(keyActionOf(TABLE, "list", press("ArrowUp"), false)).toBe(entry);
  });
});

describe("keyActionOf: input methods and text fields", () => {
  test("a press while an input method composes matches nothing, in any part", () => {
    expect(hit("list", press("ArrowUp", "none", { composing: true }))).toBeUndefined();
    expect(hit("editor", press("Enter", "none", { composing: true }))).toBeUndefined();
    expect(
      hit("editor", press("Escape", "none", { composing: true, inText: true })),
    ).toBeUndefined();
  });

  test("on a text field only an `editor` entry matches", () => {
    expect(hit("editor", press("Enter", "none", { inText: true }))).toBe("edit.commit");
    expect(hit("editor", press("Escape", "none", { inText: true }))).toBe("edit.cancel");
    expect(hit("list", press("ArrowUp", "none", { inText: true }))).toBeUndefined();
  });

  test("`?`, `%`, Cmd/Ctrl+A, Escape and Alt+Shift+ArrowUp match nothing on a text field", () => {
    const text = { inText: true };
    expect(hit("list", press("?", "shift", text))).toBeUndefined();
    expect(hit("list", press("%", "shift", text))).toBeUndefined();
    expect(hit("list", press("a", "mod", text))).toBeUndefined();
    expect(hit("list", press("Escape", "none", text))).toBeUndefined();
    expect(hit("list", press("ArrowUp", "alt+shift", text))).toBeUndefined();
    // Where the same keys are not on a text field, they do match.
    expect(hit("list", press("?", "shift"))).toBe("keys.open");
    expect(hit("list", press("%", "shift"))).toBe("adjust.percent");
  });
});

describe("keyActionOf: `when: selected`", () => {
  test("matches only while something is selected", () => {
    expect(hit("list", press("Escape"), true)).toBe("select.none");
    expect(hit("list", press("Escape"), false)).toBeUndefined();
    expect(hit("list", press("%", "shift"), true)).toBe("adjust.percent");
    expect(hit("list", press("%", "shift"), false)).toBeUndefined();
  });

  test("an entry without `when` matches whether or not something is selected", () => {
    expect(hit("list", press("ArrowUp"), false)).toBe("cursor.up");
    expect(hit("list", press("Enter"), false)).toBe("ranking.keep");
  });

  test("a selected-only Escape does not hide another entry that takes Escape later", () => {
    const table: KeyTable = [
      vocabularyEntry("select.none", "list", "tool"),
      vocabularyEntry("edit.cancel", "list", "navigation"),
    ];
    expect(hit("list", press("Escape"), true, table)).toBe("select.none");
    expect(hit("list", press("Escape"), false, table)).toBe("edit.cancel");
  });
});

describe("keyActionOf: a printed character", () => {
  test("`?` and `%` match with or without Shift, as a layout needs it", () => {
    for (const hold of ["none", "shift"] as const) {
      expect(hit("list", press("?", hold))).toBe("keys.open");
      expect(hit("list", press("%", hold))).toBe("adjust.percent");
    }
  });

  test("nothing with Ctrl, Alt or Cmd", () => {
    for (const hold of ["mod", "mod+shift", "alt+shift", "other"] as const) {
      expect(hit("list", press("?", hold))).toBeUndefined();
      expect(hit("list", press("%", hold))).toBeUndefined();
    }
  });

  test("only the character the binding names", () => {
    expect(hit("list", press("!", "shift"))).toBeUndefined();
    expect(hit("list", press("/", "none"))).toBeUndefined();
    expect(hit("list", press("5", "shift"))).toBeUndefined();
  });
});

describe("keyActionOf: `mod` takes Ctrl or Cmd, not both", () => {
  // A press holds one hold: Ctrl with Cmd reads `other` (`pressHold`), which no binding names.
  test("a `mod` press finds the entry whichever of the two was held", () => {
    for (const modifiers of [
      { altKey: false, ctrlKey: true, metaKey: false, shiftKey: false },
      { altKey: false, ctrlKey: false, metaKey: true, shiftKey: false },
    ]) {
      expect(hit("list", press("z", pressHold(modifiers)))).toBe("undo");
    }
    const both = { altKey: false, ctrlKey: true, metaKey: true, shiftKey: false };
    expect(hit("list", press("z", pressHold(both)))).toBeUndefined();
  });
});

describe("ariaKeyShortcuts", () => {
  const aria = (...entries: readonly Parameters<typeof ariaKeyShortcuts>[0][number][]) =>
    ariaKeyShortcuts(entries);

  test("writes WAI-ARIA's names: Alt+Shift+ArrowUp, Shift+ArrowDown, Home", () => {
    expect(aria(keyBinding("ArrowUp", "alt+shift"))).toBe("Alt+Shift+ArrowUp");
    expect(aria(keyBinding("ArrowDown", "shift"))).toBe("Shift+ArrowDown");
    expect(aria(keyBinding("Home"))).toBe("Home");
    expect(aria(keyBinding("Escape"))).toBe("Escape");
  });

  test("writes the spacebar as `Space`, as WAI-ARIA 1.2 says, and a letter in upper case", () => {
    expect(aria(keyBinding(" "))).toBe("Space");
    expect(aria(keyBinding("z", "mod"))).toBe("Control+Z Meta+Z");
    expect(aria(keyBinding("a", "mod"))).toBe("Control+A Meta+A");
  });

  test("names both Control and Meta for `mod` and `mod+shift`, Control first", () => {
    expect(aria(keyBinding("ArrowUp", "mod+shift"))).toBe(
      "Control+Shift+ArrowUp Meta+Shift+ArrowUp",
    );
    expect(aria(keyBinding("Enter", "mod+shift"))).toBe("Control+Shift+Enter Meta+Shift+Enter");
  });

  test("writes a printed character as the character, `%` and `?` included", () => {
    expect(aria(keyBinding("%", "char"))).toBe("%");
    expect(aria(keyBinding("?", "char"))).toBe("?");
  });

  test("joins the bindings of an action with a space, in the table's order", () => {
    expect(aria(keyBinding("Home", "alt+shift"), keyBinding("ArrowUp", "mod+shift"))).toBe(
      "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
    );
    expect(aria(keyBinding("Enter"), keyBinding("F2"))).toBe("Enter F2");
  });

  test("gives nothing for a keyless entry", () => {
    expect(ariaKeyShortcuts([])).toBe("");
  });
});
