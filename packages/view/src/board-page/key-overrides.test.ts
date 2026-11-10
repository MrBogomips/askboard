// The user's keys the board page passes on to the view (keyboard-shortcuts-help, task 10.1; design
// decision 19; review 8.6): only the `value` of a row from the user file, never its `other`, and
// only when the contract's key-override check finds nothing, so the view applies all or none.

import { describe, expect, test } from "bun:test";
import type { SettingsMessage } from "@askboard/contract";
import {
  keyOverridesExample,
  settingsKeysIgnored,
  settingsKeysNotApplied,
  settingsWithEveryKey,
  settingsWithKeys,
} from "@askboard/contract/fixtures";
import { keysOf } from "./key-overrides.ts";

type Row = NonNullable<SettingsMessage["keys"]["keys"]>;

const withRow = (row: unknown): SettingsMessage =>
  ({
    ...settingsWithEveryKey,
    keys: { ...settingsWithEveryKey.keys, keys: row },
  }) as SettingsMessage;

describe("the keys the board page passes on", () => {
  test("a user row's value, the very object the row holds", () => {
    expect(keysOf(settingsWithKeys)).toBe(settingsWithKeys.keys.keys?.value);
    expect(keysOf(settingsWithKeys)).toEqual(keyOverridesExample);
  });

  test("none from a message with no keys row, from the default, or from one the check refused", () => {
    expect(keysOf(settingsWithEveryKey)).toBeUndefined();
    expect(keysOf(settingsKeysNotApplied)).toBeUndefined();
    expect(keysOf(settingsKeysIgnored)).toBeUndefined();
  });

  test("a row from the user whose value the check refuses passes none on (a message built past ask-core)", () => {
    // Alt+Shift+ArrowUp is Move up's key: a conflict, which ask-core's check refuses and a message
    // from anywhere else could still carry.
    const conflict: Row = {
      from: "user",
      writable: false,
      value: { "move.top": ["Alt+Shift+ArrowUp"] },
    };
    expect(keysOf(withRow(conflict))).toBeUndefined();
  });

  test("all or nothing: one refused action keeps back the admissible ones", () => {
    const row: Row = {
      from: "user",
      writable: false,
      value: { "move.top": ["Mod+Alt+ArrowUp"], "move.bottom": ["Alt+Shift+ArrowUp"] },
    };
    expect(keysOf(withRow(row))).toBeUndefined();
  });

  test("a name that is no action (__proto__) is refused, so the view never sees it", () => {
    const value = JSON.parse('{"__proto__": ["Mod+Alt+ArrowUp"]}');
    expect(keysOf(withRow({ from: "user", writable: false, value }))).toBeUndefined();
  });

  test("a row from the project passes none on, with a value that would pass the check", () => {
    const row = { from: "project", writable: false, value: keyOverridesExample };
    expect(keysOf(withRow(row))).toBeUndefined();
  });

  test("a row from the default never passes on a value, nor its other", () => {
    const row = { from: "default", writable: false, value: keyOverridesExample };
    expect(keysOf(withRow(row))).toBeUndefined();
    const other = {
      from: "default",
      writable: false,
      other: { file: "project", value: keyOverridesExample },
    };
    expect(keysOf(withRow(other))).toBeUndefined();
  });

  test("a user row's other is never read: the value alone is passed on", () => {
    const row = {
      from: "user",
      writable: false,
      value: { "move.top": ["Mod+Alt+ArrowUp"] },
      other: { file: "project", value: { "move.bottom": ["Mod+Alt+ArrowDown"] } },
    };
    expect(keysOf(withRow(row))).toEqual({ "move.top": ["Mod+Alt+ArrowUp"] });
  });

  test("a user row with no value passes none on", () => {
    expect(keysOf(withRow({ from: "user", writable: false }))).toBeUndefined();
  });

  test("an empty set of overrides is admissible and changes nothing", () => {
    expect(keysOf(withRow({ from: "user", writable: false, value: {} }))).toEqual({});
  });
});
