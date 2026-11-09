import { describe, expect, test } from "bun:test";
import { TREE_KEYS } from "@askboard/contract";
import type { KeyboardEvent } from "react";
import { questionKeyDown } from "../src/tree/group-question.tsx";
import { treeKeyOf } from "../src/tree/key-event.ts";
import { type KeyAction, keyAction, toolbarKey } from "../src/tree/model/keys.ts";
import { expectedActions, parityMismatches, reachedActions, type Taken } from "./key-presses.ts";

// The Tree's key table against its handlers (keyboard-shortcuts-help, design decision 9; spec: Key
// tables match the handlers): for each part, every key its table binds and each of the arrows,
// Home, End, Enter, Space, Delete, Backspace, Escape and F2 under each of the 16 sets of modifiers
// goes to the function the component calls, and the action it gives, through a map to the table's
// IDs, is the table's or nothing. A tool without keys has no binding to check.
const FOCUS = {
  up: "cursor.up",
  down: "cursor.down",
  left: "cursor.left",
  right: "cursor.right",
  home: "cursor.first",
  end: "cursor.last",
} as const;
const EDIT = {
  moveUp: "move.up",
  moveDown: "move.down",
  indent: "move.right",
  outdent: "move.left",
  remove: "delete",
} as const;

const idOf = (action: KeyAction | undefined): string | undefined => {
  if (action === undefined) return undefined;
  switch (action.kind) {
    case "focus":
      return FOCUS[action.move];
    case "select":
      return "select.toggle";
    case "extend":
      return action.move === "up" ? "select.extendUp" : "select.extendDown";
    case "undo":
      return "undo";
    case "startEdit":
      return "edit.start";
    case "edit":
      return EDIT[action.edit as keyof typeof EDIT];
    case "commit":
      return "edit.commit";
    case "cancel":
      return "edit.cancel";
  }
};

// The delete question's own handler is inline in the component (`delete-question.tsx`): Escape,
// read as the editor reads it, is "Cancel".
const deleteQuestion: Taken = (key, flags) =>
  keyAction(treeKeyOf({ key, ...flags, keyCode: 0, nativeEvent: { isComposing: false } }), "edit")
    ?.kind === "cancel"
    ? "tree.cancelDelete"
    : undefined;

// The group question's handler is exported: it prevents the default and cancels on Escape.
const groupQuestion: Taken = (key, flags) => {
  let cancelled = false;
  questionKeyDown(() => {
    cancelled = true;
  })({
    key,
    ...flags,
    keyCode: 0,
    nativeEvent: { isComposing: false },
    preventDefault: () => {},
  } as unknown as KeyboardEvent<HTMLFieldSetElement>);
  return cancelled ? "tree.cancelGroup" : undefined;
};

const read = (key: string, flags: object) =>
  treeKeyOf({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...flags,
    keyCode: 0,
    nativeEvent: { isComposing: false },
  });

const PARTS: readonly (readonly [string, Taken])[] = [
  ["grid", (key, flags) => idOf(keyAction(read(key, flags), "navigation"))],
  ["editor", (key, flags) => idOf(keyAction(read(key, flags), "edit"))],
  [
    "toolbar",
    (key, flags) => {
      const move = toolbarKey(read(key, flags));
      return move === undefined ? undefined : `toolbar.${move}`;
    },
  ],
  ["delete-question", deleteQuestion],
  ["group-question", groupQuestion],
];

describe("the Tree's table matches its handlers", () => {
  test.each(PARTS)(
    "%s: every key under every hold gives the table's action or nothing",
    (part, taken) => {
      expect(parityMismatches(TREE_KEYS, part, taken)).toEqual([]);
    },
  );

  test.each(PARTS)("%s: every entry with keys is reached by one of its bindings", (part, taken) => {
    expect(reachedActions(TREE_KEYS, part, taken)).toEqual(expectedActions(TREE_KEYS, part));
  });

  test("the entries without keys are the toolbar's tools, and have no binding to check", () => {
    const keyless = TREE_KEYS.filter((entry) => entry.keys.length === 0).map((e) => e.action);
    expect(keyless).toEqual([
      "tree.addAfter",
      "tree.addChild",
      "tree.selectAll",
      "tree.selectNone",
      "tree.adjust",
    ]);
  });

  test("the Tree has no native entry: every key of its table is taken by an AskBoard function", () => {
    expect(TREE_KEYS.filter((entry) => entry.shows === "native")).toEqual([]);
  });
});
