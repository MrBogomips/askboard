import { describe, expect, test } from "bun:test";
import {
  type FocusMove,
  type GridAction,
  type GridKeyContext,
  gridKeyAction,
  isGridKey,
  type KeyPress,
  toolbarKeyMove,
} from "./keys.ts";

const press = (key: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...modifiers,
});

const NAVIGATE_START: GridKeyContext = { mode: "navigate", column: "start", editable: true };
const NAVIGATE_DURATION: GridKeyContext = { mode: "navigate", column: "duration", editable: true };
const NAVIGATE_PREDECESSORS: GridKeyContext = {
  mode: "navigate",
  column: "dependencies",
  editable: true,
};
const NAVIGATE_REQUESTED: GridKeyContext = {
  mode: "navigate",
  column: "duration",
  editable: true,
  clearable: true,
};
const READ_ONLY_REQUESTED: GridKeyContext = { ...NAVIGATE_REQUESTED, editable: false };
const NAVIGATE_TASK: GridKeyContext = { mode: "navigate", column: "task", editable: false };
const READ_ONLY_START: GridKeyContext = { mode: "navigate", column: "start", editable: false };
const EDIT_START: GridKeyContext = { mode: "edit", column: "start", editable: true };

const move = (to: FocusMove): GridAction => ({ kind: "move", move: to });
const EDIT: GridAction = { kind: "edit" };
const CLEAR: GridAction = { kind: "clear" };
const COMMIT: GridAction = { kind: "commit" };
const CANCEL: GridAction = { kind: "cancel" };

describe("the grid's keys", () => {
  test.each<[string, GridKeyContext, GridAction | undefined]>([
    // Navigation: arrows, Home and End move between cells, wherever the focus is.
    ["ArrowUp", NAVIGATE_START, move("up")],
    ["ArrowDown", NAVIGATE_START, move("down")],
    ["ArrowLeft", NAVIGATE_START, move("left")],
    ["ArrowRight", NAVIGATE_START, move("right")],
    ["Home", NAVIGATE_START, move("home")],
    ["End", NAVIGATE_START, move("end")],
    ["ArrowDown", NAVIGATE_TASK, move("down")],
    ["End", READ_ONLY_START, move("end")],
    // Enter or F2 edits the focused start, duration or predecessors.
    ["Enter", NAVIGATE_START, EDIT],
    ["F2", NAVIGATE_START, EDIT],
    ["Enter", NAVIGATE_DURATION, EDIT],
    ["F2", NAVIGATE_PREDECESSORS, EDIT],
    ["Enter", NAVIGATE_TASK, undefined],
    ["F2", NAVIGATE_TASK, undefined],
    ["Enter", READ_ONLY_START, undefined],
    // Delete or Backspace on a start clears the request; on any other cell they do nothing.
    ["Delete", NAVIGATE_START, CLEAR],
    ["Backspace", NAVIGATE_START, CLEAR],
    ["Delete", NAVIGATE_DURATION, undefined],
    // A plan's requested duration is cleared the same way, where the Gantt takes edits.
    ["Delete", NAVIGATE_REQUESTED, CLEAR],
    ["Backspace", NAVIGATE_REQUESTED, CLEAR],
    ["Delete", READ_ONLY_REQUESTED, undefined],
    ["Backspace", NAVIGATE_PREDECESSORS, undefined],
    ["Delete", READ_ONLY_START, undefined],
    // Other keys are not the grid's.
    ["Escape", NAVIGATE_START, undefined],
    ["Tab", NAVIGATE_START, undefined],
    [" ", NAVIGATE_START, undefined],
    ["a", NAVIGATE_START, undefined],
    ["constructor", NAVIGATE_START, undefined],
    ["__proto__", NAVIGATE_START, undefined],
    // In edit mode Enter commits and Escape cancels; the field keeps every other key.
    ["Enter", EDIT_START, COMMIT],
    ["Escape", EDIT_START, CANCEL],
    ["Enter", { mode: "edit", column: "dependencies", editable: true }, COMMIT],
    ["ArrowLeft", EDIT_START, undefined],
    ["Home", EDIT_START, undefined],
    ["Delete", EDIT_START, undefined],
    ["Backspace", EDIT_START, undefined],
    ["F2", EDIT_START, undefined],
    ["Tab", EDIT_START, undefined],
  ])("%j in %j gives %j", (key, context, action) => {
    expect(gridKeyAction(press(key), context)).toEqual(action);
  });

  const KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
    "F2",
    "Delete",
    "Backspace",
    "Escape",
  ];
  const MODIFIERS = ["shiftKey", "ctrlKey", "altKey", "metaKey"] as const;

  test.each(MODIFIERS)("do nothing with %s held, in either mode", (modifier) => {
    for (const key of KEYS) {
      for (const context of [NAVIGATE_START, EDIT_START]) {
        expect({
          key,
          context,
          action: gridKeyAction(press(key, { [modifier]: true }), context),
        }).toEqual({ key, context, action: undefined });
      }
    }
  });

  test("give frozen actions", () => {
    expect(Object.isFrozen(gridKeyAction(press("ArrowUp"), NAVIGATE_START))).toBe(true);
    expect(Object.isFrozen(gridKeyAction(press("Enter"), EDIT_START))).toBe(true);
  });
});

describe("a key of the grid's", () => {
  test.each([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
    "F2",
    "Delete",
    "Backspace",
  ])("is %s, with no modifier, whatever it does there", (key) => {
    expect(isGridKey(press(key))).toBe(true);
  });

  test.each([
    ["Tab", {}],
    ["Escape", {}],
    ["a", {}],
    ["PageDown", {}],
    ["Backspace", { metaKey: true }],
    ["ArrowLeft", { altKey: true }],
    ["Home", { ctrlKey: true }],
    ["End", { shiftKey: true }],
  ] as const)("is not %s with %p", (key, modifiers) => {
    expect(isGridKey(press(key, modifiers))).toBe(false);
  });
});

describe("the toolbar's keys", () => {
  test.each([
    ["ArrowRight", {}, "next"],
    ["ArrowLeft", {}, "previous"],
    ["Home", {}, "first"],
    ["End", {}, "last"],
    ["ArrowDown", {}, undefined],
    ["Enter", {}, undefined],
    ["toString", {}, undefined],
    ["ArrowRight", { shiftKey: true }, undefined],
    ["ArrowLeft", { ctrlKey: true }, undefined],
    ["Home", { altKey: true }, undefined],
    ["End", { metaKey: true }, undefined],
  ] as const)("%j with %j moves the focus to the %s tool", (key, modifiers, to) => {
    expect(toolbarKeyMove(press(key, modifiers))).toBe(to);
  });
});
