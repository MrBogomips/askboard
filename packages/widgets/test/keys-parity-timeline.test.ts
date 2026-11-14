import { describe, expect, test } from "bun:test";
import { TIMELINE_KEYS } from "@askboard/contract";
import { toolbarPressMove } from "../src/shared/toolbar-focus.ts";
import { timelineKeyOf } from "../src/timeline/keys.ts";
import { expectedActions, parityMismatches, reachedActions, type Taken } from "./key-presses.ts";

// The Timeline's key table against its handlers (keyboard-shortcuts-help, design decision 9; spec:
// Key tables match the handlers): the entries' keys through `timelineKeyOf` and the toolbar's
// roving focus through `toolbarPressMove`, which `MoveToolbar` calls, each key under each of the
// 16 sets of modifiers. Its three tools have no key.
const ENTRIES = {
  up: "cursor.up",
  down: "cursor.down",
  home: "cursor.first",
  end: "cursor.last",
} as const;

const PARTS: readonly (readonly [string, Taken])[] = [
  [
    "entries",
    (_key, _flags, press) => {
      const entry = timelineKeyOf(press);
      return entry === undefined ? undefined : ENTRIES[entry];
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

describe("the Timeline's table matches its handlers", () => {
  test.each(PARTS)(
    "%s: every key under every hold gives the table's action or nothing",
    (part, taken) => {
      expect(parityMismatches(TIMELINE_KEYS, part, taken)).toEqual([]);
    },
  );

  test.each(PARTS)("%s: every entry with keys is reached by one of its bindings", (part, taken) => {
    expect(reachedActions(TIMELINE_KEYS, part, taken)).toEqual(
      expectedActions(TIMELINE_KEYS, part),
    );
  });

  test("the entries without keys are the toolbar's three tools", () => {
    expect(TIMELINE_KEYS.filter((entry) => entry.keys.length === 0).map((e) => e.action)).toEqual([
      "timeline.moveEarlier",
      "timeline.moveLater",
      "timeline.moveToLane",
    ]);
  });
});
