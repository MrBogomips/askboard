import { describe, expect, test } from "bun:test";
import { KANBAN_FIXTURE_ITEM, KANBAN_ORDER_ITEM } from "@askboard/contract/fixtures";
import { FLAG_SETS, pressOf, pressWith } from "../../test/key-presses.ts";
import { kanbanPressOf, kanbanTools, otherColumns } from "./keys.ts";
import { columnsOf } from "./model.ts";

// The Kanban at the keyboard (view-and-widgets spec: Kanban at the keyboard; kanban-order, design
// decision 5; keyboard-shortcuts-help, decisions 7 and 9): the arrow keys with no modifier make a
// card current, Alt+Shift with the arrow keys, Home and End and Ctrl or Cmd with Shift and the arrow
// keys move it, and nothing else acts; each tool acts only where the current card of a Kanban that
// can change can make its move.
const COLUMNS = columnsOf(KANBAN_FIXTURE_ITEM.props);

const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"] as const;

type Taken = ReturnType<typeof kanbanPressOf>;

// What the table of design decision 5 gives, key by key, under each hold that gives anything; the
// holds are the port's (`pressHold`): Ctrl or Cmd alone are both `mod`.
const TABLE: Partial<Record<string, Partial<Record<(typeof KEYS)[number], Taken>>>> = {
  none: {
    ArrowUp: { kind: "cursor", key: "up" },
    ArrowDown: { kind: "cursor", key: "down" },
    ArrowLeft: { kind: "cursor", key: "left" },
    ArrowRight: { kind: "cursor", key: "right" },
  },
  "alt+shift": {
    ArrowUp: { kind: "move", move: "up" },
    ArrowDown: { kind: "move", move: "down" },
    Home: { kind: "move", move: "top" },
    End: { kind: "move", move: "bottom" },
  },
  "mod+shift": {
    ArrowUp: { kind: "move", move: "top" },
    ArrowDown: { kind: "move", move: "bottom" },
  },
};

describe("kanbanPressOf", () => {
  test("only the table's presses act: every key under each of the 16 sets of modifiers gives what the table says and no more", () => {
    for (const flags of FLAG_SETS) {
      for (const key of KEYS) {
        const press = pressOf(key, flags);
        expect({ flags, key, taken: kanbanPressOf(press) }).toEqual({
          flags,
          key,
          taken: TABLE[press.hold]?.[key],
        });
      }
    }
  });

  test("Ctrl and Cmd together never act, nor does Alt with either, nor Alt or Shift alone", () => {
    for (const hold of ["other", "mod+alt", "shift"] as const) {
      for (const key of KEYS) expect(kanbanPressOf(pressWith(key, hold))).toBeUndefined();
    }
  });

  test("a press while an input method composes does nothing, whatever the key and hold", () => {
    for (const hold of ["none", "alt+shift", "mod+shift"] as const) {
      for (const key of KEYS) {
        expect(kanbanPressOf({ ...pressWith(key, hold), composing: true })).toBeUndefined();
      }
    }
  });

  test("any other key does nothing, under any hold", () => {
    for (const key of ["Enter", " ", "Escape", "Tab", "a", "PageUp", "toString", "__proto__"]) {
      for (const flags of FLAG_SETS) expect(kanbanPressOf(pressOf(key, flags))).toBeUndefined();
    }
  });
});

describe("kanbanTools", () => {
  const ALL = { moveTo: true, up: true, down: true, top: true, bottom: true };
  const NONE = { moveTo: false, up: false, down: false, top: false, bottom: false };
  const ORDER = columnsOf(KANBAN_ORDER_ITEM.props);

  test("each tool is on for a current card in the middle of its column of a Kanban that can change", () => {
    expect(kanbanTools("add-sso", false, ORDER)).toEqual(ALL);
  });

  test("Move up and To top are off for the first card, Move down and To bottom for the last", () => {
    expect(kanbanTools("fix-login", false, ORDER)).toEqual({
      ...ALL,
      up: false,
      top: false,
    });
    expect(kanbanTools("audit", false, ORDER)).toEqual({ ...ALL, down: false, bottom: false });
  });

  test("a column's only card can only Move to…", () => {
    expect(kanbanTools("release-notes", false, ORDER)).toEqual({ ...NONE, moveTo: true });
  });

  test("every tool is off with no current card, with a card the columns do not hold, and read-only", () => {
    expect(kanbanTools(undefined, false, ORDER)).toEqual(NONE);
    expect(kanbanTools("zz", false, ORDER)).toEqual(NONE);
    expect(kanbanTools("add-sso", true, ORDER)).toEqual(NONE);
  });
});

describe("otherColumns", () => {
  test("are the columns but the current card's, in the agent's order, by ID and label", () => {
    expect(otherColumns(COLUMNS, "fix-login")).toEqual([
      { id: "doing", label: "Doing" },
      { id: "done", label: "Done" },
    ]);
    expect(otherColumns(COLUMNS, "release-notes").map(({ id }) => id)).toEqual(["todo", "doing"]);
  });

  test("are none for no current card or one the columns do not hold", () => {
    expect(otherColumns(COLUMNS, undefined)).toEqual([]);
    expect(otherColumns(COLUMNS, "zz")).toEqual([]);
  });
});
