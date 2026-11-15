import { describe, expect, test } from "bun:test";
import { BOARD_KEYS, type KeyPress } from "@askboard/contract";
import { keyTableOf } from "../catalog/keys/effective.ts";
import type { BoardKeyScope } from "./board-key-scope.ts";
import { type BoardKeyAvailable, boardKeyActOf } from "./use-board-keys.ts";

// The board's key table against its handler (board-keys, design decision 3; spec: The board's key
// table matches its handlers). Pure: the listener only reads the event and calls this.

const TABLE = keyTableOf(BOARD_KEYS, undefined);
const ALL: BoardKeyAvailable = { nextOpen: true, previousOpen: true, keysOpen: true };
const press = (key: string, hold: KeyPress["hold"] = "none", over: Partial<KeyPress> = {}) =>
  ({ key, hold, composing: false, inText: false, ...over }) as KeyPress;
const act = (
  p: KeyPress,
  scope: BoardKeyScope,
  available: BoardKeyAvailable = ALL,
  prevented = false,
  repeat = false,
  table = TABLE,
) => boardKeyActOf(table, p, scope, available, prevented, repeat);

const SCOPES: readonly BoardKeyScope[] = ["board", { card: "q1" }];

describe("each binding of the board's table, with each scope", () => {
  test.each(SCOPES.map((scope) => [JSON.stringify(scope), scope] as const))(
    "in %s: N, Shift+N and ? act",
    (_name, scope) => {
      expect(act(press("n"), scope)).toBe("board.nextOpen");
      expect(act(press("N", "shift"), scope)).toBe("board.previousOpen");
      expect(act(press("?"), scope)).toBe("keys.open");
      expect(act(press("?", "shift"), scope)).toBe("keys.open");
    },
  );

  test("in none: nothing acts", () => {
    expect(act(press("n"), "none")).toBeUndefined();
    expect(act(press("N", "shift"), "none")).toBeUndefined();
    expect(act(press("?"), "none")).toBeUndefined();
  });

  test.each(SCOPES.map((scope) => [JSON.stringify(scope), scope] as const))(
    "in %s: the answer key is the card's, never the listener's",
    (_name, scope) => {
      expect(act(press("Enter", "mod"), scope)).toBeUndefined();
    },
  );

  test("the composer's send is in the editor part, not the listener's", () => {
    expect(act(press("Enter", "mod", { inText: true }), "none")).toBeUndefined();
  });
});

describe("with a modifier added", () => {
  test.each([
    ["Alt", "other"],
    ["Ctrl", "mod"],
    ["Cmd", "mod"],
    ["Ctrl+Shift", "mod+shift"],
    ["Alt+Shift", "alt+shift"],
  ] as const)("%s+N is the browser's", (_name, hold) => {
    expect(act(press("n", hold), "board")).toBeUndefined();
    expect(act(press("N", hold), "board")).toBeUndefined();
  });

  test("Ctrl+? is the browser's", () => {
    expect(act(press("?", "mod"), "board")).toBeUndefined();
  });
});

describe("a key that is left alone", () => {
  test("a prevented key", () => {
    expect(act(press("n"), "board", ALL, true)).toBeUndefined();
  });

  test("a repeat", () => {
    expect(act(press("n"), "board", ALL, false, true)).toBeUndefined();
  });

  test("a press while an input method composes", () => {
    expect(act(press("n", "none", { composing: true }), "board")).toBeUndefined();
  });

  test("a press on a text field", () => {
    expect(act(press("n", "none", { inText: true }), "board")).toBeUndefined();
  });

  test("an unavailable twin: no next open, no target, no Keys button", () => {
    expect(act(press("n"), "board", { ...ALL, nextOpen: false })).toBeUndefined();
    expect(act(press("N", "shift"), "board", { ...ALL, previousOpen: false })).toBeUndefined();
    expect(act(press("?"), "board", { ...ALL, keysOpen: false })).toBeUndefined();
    expect(act(press("n"), "board", { ...ALL, previousOpen: false })).toBe("board.nextOpen");
  });

  test("another key", () => {
    expect(act(press("m"), "board")).toBeUndefined();
  });
});

describe("the user's keys", () => {
  const remapped = keyTableOf(BOARD_KEYS, { "board.nextOpen": ["j"] });

  test("the new key acts and the default does not", () => {
    expect(act(press("j"), "board", ALL, false, false, remapped)).toBe("board.nextOpen");
    expect(act(press("n"), "board", ALL, false, false, remapped)).toBeUndefined();
  });

  test("an action with no key acts on nothing", () => {
    const none = keyTableOf(BOARD_KEYS, { "board.nextOpen": [] });
    expect(act(press("n"), "board", ALL, false, false, none)).toBeUndefined();
  });
});
