import { describe, expect, test } from "bun:test";
import { type KeyAction, keyAction, TREE_TOOLS, type TreeKey, toolbarKey } from "./keys.ts";

// The Tree's keys (design decision 5; proposal, open question 9): WAI-ARIA treegrid navigation,
// Enter or F2 to edit, Enter to commit and Escape to cancel, Alt+Shift with the arrows to move,
// Delete or Backspace to delete; the same keys with other modifiers do nothing, so that the
// browser keeps them (Alt+Arrow navigates history in Firefox and Chromium on Linux).
const MODIFIERS = ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const;
type Modifier = (typeof MODIFIERS)[number];

const press = (key: string, ...held: Modifier[]): TreeKey => ({
  key,
  altKey: held.includes("altKey"),
  ctrlKey: held.includes("ctrlKey"),
  metaKey: held.includes("metaKey"),
  shiftKey: held.includes("shiftKey"),
});

// Every set of modifiers: the 16 subsets of the four.
const EVERY_HOLD: Modifier[][] = Array.from({ length: 16 }, (_, bits) =>
  MODIFIERS.filter((_, at) => (bits >> at) & 1),
);

const sameHold = (a: readonly Modifier[], b: readonly Modifier[]) =>
  a.length === b.length && a.every((modifier) => b.includes(modifier));

const NAVIGATION: [string, Modifier[], KeyAction][] = [
  ["ArrowUp", [], { kind: "focus", move: "up" }],
  ["ArrowDown", [], { kind: "focus", move: "down" }],
  ["ArrowLeft", [], { kind: "focus", move: "left" }],
  ["ArrowRight", [], { kind: "focus", move: "right" }],
  ["Home", [], { kind: "focus", move: "home" }],
  ["End", [], { kind: "focus", move: "end" }],
  ["Enter", [], { kind: "startEdit" }],
  ["F2", [], { kind: "startEdit" }],
  ["ArrowUp", ["altKey", "shiftKey"], { kind: "edit", edit: "moveUp" }],
  ["ArrowDown", ["altKey", "shiftKey"], { kind: "edit", edit: "moveDown" }],
  ["ArrowRight", ["altKey", "shiftKey"], { kind: "edit", edit: "indent" }],
  ["ArrowLeft", ["altKey", "shiftKey"], { kind: "edit", edit: "outdent" }],
  ["Delete", [], { kind: "edit", edit: "remove" }],
  ["Backspace", [], { kind: "edit", edit: "remove" }],
];

const EDITING: [string, Modifier[], KeyAction][] = [
  ["Enter", [], { kind: "commit" }],
  ["Escape", [], { kind: "cancel" }],
];

describe("the keys in navigation", () => {
  test.each(NAVIGATION)("%s with %p", (key, held, action) => {
    expect(keyAction(press(key, ...held), "navigation")).toEqual(action);
  });

  test("are those keys only with exactly those modifiers", () => {
    for (const [key, held] of NAVIGATION) {
      const bound = NAVIGATION.filter(([other]) => other === key);
      for (const hold of EVERY_HOLD) {
        const action = bound.find(([, other]) => sameHold(other, hold))?.[2];
        expect({ key, hold, action: keyAction(press(key, ...hold), "navigation") }).toEqual({
          key,
          hold,
          action,
        });
      }
      expect(held.every((modifier) => MODIFIERS.includes(modifier))).toBe(true);
    }
  });

  test.each(["Escape", "Tab", " ", "a", "PageDown", "Insert", "F3"])(
    "leave %p to the browser",
    (key) => {
      expect(keyAction(press(key), "navigation")).toBeUndefined();
    },
  );
});

describe("the keys in edit mode", () => {
  test.each(EDITING)("%s with %p", (key, held, action) => {
    expect(keyAction(press(key, ...held), "edit")).toEqual(action);
  });

  test("are Enter and Escape alone, with no modifier", () => {
    for (const [key] of EDITING) {
      for (const hold of EVERY_HOLD.filter((one) => one.length > 0)) {
        expect({ key, hold, action: keyAction(press(key, ...hold), "edit") }).toEqual({
          key,
          hold,
          action: undefined,
        });
      }
    }
  });

  test("leave every navigation key to the text input", () => {
    for (const [key, held] of NAVIGATION.filter(([key]) => key !== "Enter")) {
      expect({ key, held, action: keyAction(press(key, ...held), "edit") }).toEqual({
        key,
        held,
        action: undefined,
      });
    }
  });
});

describe("a key pressed while an input method composes", () => {
  test("does nothing, in either mode", () => {
    const composing = { ...press("Enter"), isComposing: true };
    expect(keyAction(composing, "edit")).toBeUndefined();
    expect(keyAction(composing, "navigation")).toBeUndefined();
    expect(keyAction({ ...press("Escape"), isComposing: true }, "edit")).toBeUndefined();
    expect(keyAction({ ...press("Enter"), isComposing: false }, "edit")).toEqual({
      kind: "commit",
    });
  });
});

describe("the toolbar's tools", () => {
  test("come in the design's order, with their names", () => {
    expect(TREE_TOOLS.map(({ edit, label }) => [edit, label])).toEqual([
      ["addAfter", "tree.tool.addAfter"],
      ["addChild", "tree.tool.addChild"],
      ["moveUp", "tree.tool.moveUp"],
      ["moveDown", "tree.tool.moveDown"],
      ["indent", "tree.tool.indent"],
      ["outdent", "tree.tool.outdent"],
      ["remove", "tree.tool.remove"],
    ]);
  });

  test("give each tool with a key its aria-keyshortcuts, which press that tool's edit", () => {
    expect(TREE_TOOLS.map(({ shortcut }) => shortcut)).toEqual([
      undefined,
      undefined,
      "Alt+Shift+ArrowUp",
      "Alt+Shift+ArrowDown",
      "Alt+Shift+ArrowRight",
      "Alt+Shift+ArrowLeft",
      "Delete Backspace",
    ]);
    for (const { edit, shortcut } of TREE_TOOLS) {
      for (const one of shortcut?.split(" ") ?? []) {
        const parts = one.split("+");
        const held = parts.slice(0, -1).map((name) => `${name.toLowerCase()}Key` as Modifier);
        const action = keyAction(press(parts.at(-1) ?? "", ...held), "navigation");
        expect<unknown>({ one, action }).toEqual({ one, action: { kind: "edit", edit } });
      }
    }
  });

  test("are frozen", () => {
    expect(Object.isFrozen(TREE_TOOLS)).toBe(true);
    expect(TREE_TOOLS.every((tool) => Object.isFrozen(tool))).toBe(true);
  });
});

describe("the toolbar's keys", () => {
  test.each<[string, ReturnType<typeof toolbarKey>]>([
    ["ArrowLeft", "previous"],
    ["ArrowRight", "next"],
    ["Home", "first"],
    ["End", "last"],
    ["ArrowUp", undefined],
    ["ArrowDown", undefined],
    ["Tab", undefined],
    ["Enter", undefined],
  ])("%s gives %p", (key, move) => {
    expect(toolbarKey(press(key))).toBe(move);
  });

  test("do nothing with a modifier, or while an input method composes", () => {
    for (const hold of EVERY_HOLD.filter((one) => one.length > 0)) {
      expect(toolbarKey(press("ArrowRight", ...hold))).toBeUndefined();
    }
    expect(toolbarKey({ ...press("ArrowRight"), isComposing: true })).toBeUndefined();
  });
});
