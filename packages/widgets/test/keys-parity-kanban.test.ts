import { describe, expect, test } from "bun:test";
import { KANBAN_KEYS } from "@askboard/contract";
import { kanbanPressOf } from "../src/kanban/keys.ts";
import { toolbarPressMove } from "../src/shared/toolbar-focus.ts";
import { expectedActions, parityMismatches, reachedActions, type Taken } from "./key-presses.ts";

// The Kanban's key table against its handlers (keyboard-shortcuts-help, design decision 9; spec:
// Key tables match the handlers, Today's keys of the Kanban): the board's arrows through
// `kanbanPressOf`, which gives the cursor keys and kanban-order's in-column moves, and the toolbar's
// roving focus through `toolbarPressMove`, which `MoveToolbar` calls, each key under each of the 16
// sets of modifiers. "Move to…" is a menu with no key.

const PARTS: readonly (readonly [string, Taken])[] = [
  [
    "board",
    (_key, _flags, press) => {
      const taken = kanbanPressOf(press);
      if (taken === undefined) return undefined;
      return taken.kind === "cursor" ? `cursor.${taken.key}` : `move.${taken.move}`;
    },
  ],
  [
    "toolbar",
    (_key, _flags, press) => {
      const move = toolbarPressMove(press);
      return move === undefined ? undefined : `toolbar.${move}`;
    },
  ],
];

describe("the Kanban's table matches its handlers", () => {
  test.each(PARTS)(
    "%s: every key under every hold gives the table's action or nothing",
    (part, taken) => {
      expect(parityMismatches(KANBAN_KEYS, part, taken)).toEqual([]);
    },
  );

  test.each(PARTS)("%s: every entry with keys is reached by one of its bindings", (part, taken) => {
    expect(reachedActions(KANBAN_KEYS, part, taken)).toEqual(expectedActions(KANBAN_KEYS, part));
  });

  test("the entry without keys is the toolbar's menu", () => {
    expect(KANBAN_KEYS.filter((entry) => entry.keys.length === 0).map((e) => e.action)).toEqual([
      "kanban.moveTo",
    ]);
  });
});
