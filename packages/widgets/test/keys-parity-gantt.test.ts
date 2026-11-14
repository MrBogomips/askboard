import { describe, expect, test } from "bun:test";
import { GANTT_KEYS } from "@askboard/contract";
import { edgeKeyAction } from "../src/gantt/model/column-width.ts";
import {
  type FocusMove,
  type GridAction,
  gridKeyAction,
  type KeyPress,
  type PanelAction,
  panelKeyAction,
  switchKeyMove,
  toolbarKeyMove,
} from "../src/gantt/model/keys.ts";
import {
  expectedActions,
  FLAG_SETS,
  keysOfPart,
  NO_MODIFIER,
  parityMismatches,
  reachedActions,
  type Taken,
} from "./key-presses.ts";

// The Gantt's key table against its handlers (keyboard-shortcuts-help, design decision 9; spec:
// Key tables match the handlers, Keys taken only to stop a browser action): for each part, every
// key its table binds and each of the arrows, Home, End, Enter, Space, Delete, Backspace, Escape
// and F2 under each of the 16 sets of modifiers goes to the function its component calls, and the
// action it gives, through a map to the table's IDs, is the table's or nothing. A `native` entry
// (the panel's and the switch's Space, which Radix takes) is taken by no AskBoard function, so
// the part's function gives nothing for its key.
const MOVES: Readonly<Record<FocusMove, string>> = {
  up: "cursor.up",
  down: "cursor.down",
  left: "cursor.left",
  right: "cursor.right",
  home: "cursor.first",
  end: "cursor.last",
};

const press = (key: string, flags: object): KeyPress => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...flags,
});

const gridId = (action: GridAction | undefined): string | undefined => {
  if (action === undefined) return undefined;
  switch (action.kind) {
    case "move":
      return MOVES[action.move];
    case "edit":
      return "edit.start";
    case "clear":
      return "gantt.clear";
    case "commit":
      return "edit.commit";
    case "cancel":
      return "edit.cancel";
  }
};

// A start cell the user can edit, whose request Delete clears.
const NAVIGATING = { mode: "navigate", column: "start", editable: true, clearable: true } as const;
const EDITING = { ...NAVIGATING, mode: "edit" } as const;

// `swallow` is no table action and not "nothing": the panel prevents the key and runs no action.
const SWALLOW = "swallow";
const PANEL_IDS = { done: "edit.commit", cancel: "edit.cancel" } as const;
const panelId = (action: PanelAction | undefined): string | undefined => {
  if (action === undefined) return undefined;
  if (action.kind === "swallow") return SWALLOW;
  if (action.kind === "move") return action.step === 1 ? "cursor.down" : "cursor.up";
  return PANEL_IDS[action.kind];
};

// The edge's actions, told apart by the width they ask for from 300 px in a 1,000 px widget.
const WIDTH = 300;
const WIDGET = 1000;
const EDGE_WIDTHS: Readonly<Record<number, string>> = {
  284: "gantt.narrower",
  316: "gantt.wider",
  236: "gantt.narrowerMore",
  364: "gantt.widerMore",
  120: "gantt.narrowest",
  600: "gantt.widest",
};

const PARTS: readonly (readonly [string, Taken])[] = [
  ["grid", (key, flags) => gridId(gridKeyAction(press(key, flags), NAVIGATING))],
  ["editor", (key, flags) => gridId(gridKeyAction(press(key, flags), EDITING))],
  [
    "zoom",
    (key, flags) => {
      const move = toolbarKeyMove(press(key, flags));
      return move === undefined ? undefined : `toolbar.${move}`;
    },
  ],
  [
    "edge",
    (key, flags) => {
      const action = edgeKeyAction(press(key, flags), WIDTH, WIDGET);
      if (action === undefined) return undefined;
      return action.kind === "fit" ? "gantt.fit" : EDGE_WIDTHS[action.width];
    },
  ],
  [
    "panel",
    (key, flags) => {
      const id = panelId(panelKeyAction(press(key, flags)));
      return id === SWALLOW ? undefined : id; // the table's view: a swallowed key is no action
    },
  ],
  [
    "switch",
    (key, flags) => {
      const move = switchKeyMove(press(key, flags));
      return move === undefined ? undefined : `toolbar.${move}`;
    },
  ],
];

describe("the Gantt's table matches its handlers", () => {
  test.each(PARTS)(
    "%s: every key under every hold gives the table's action or nothing",
    (part, taken) => {
      expect(parityMismatches(GANTT_KEYS, part, taken)).toEqual([]);
    },
  );

  test.each(PARTS)(
    "%s: every entry with keys that AskBoard takes is reached by a binding",
    (part, taken) => {
      expect(reachedActions(GANTT_KEYS, part, taken)).toEqual(expectedActions(GANTT_KEYS, part));
    },
  );

  test("the two native entries are the panel's and the switch's Space, taken by no function", () => {
    const native = GANTT_KEYS.filter((entry) => entry.shows === "native");
    expect(native.map((entry) => [entry.part, entry.action])).toEqual([
      ["panel", "gantt.togglePredecessor"],
      ["switch", "gantt.criticalPath"],
    ]);
    for (const [part, taken] of PARTS.filter(([name]) => name === "panel" || name === "switch")) {
      for (const flags of [NO_MODIFIER, { ...NO_MODIFIER, shiftKey: true }]) {
        expect({ part, flags, id: taken(" ", flags, undefined as never) }).toEqual({
          part,
          flags,
          id: undefined,
        });
      }
    }
  });

  test("Delete and Backspace in the predecessors panel give `swallow`, which the panel prevents; the table lists neither", () => {
    for (const key of ["Delete", "Backspace"]) {
      // `panel.tsx` prevents the default of every action it gets, `swallow` included, and runs none.
      expect(panelKeyAction(press(key, {}))).toEqual({ kind: "swallow" });
      expect(panelId(panelKeyAction(press(key, {})))).toBe(SWALLOW);
      expect(panelKeyAction(press(key, { shiftKey: true }))).toBeUndefined();
      expect(panelKeyAction(press(key, { altKey: true, shiftKey: true }))).toBeUndefined();
    }
    expect(
      GANTT_KEYS.filter((entry) => entry.part === "panel").flatMap((e) => e.keys.map((k) => k.key)),
    ).not.toContain("Delete");
    expect(
      GANTT_KEYS.filter((entry) => entry.part === "panel").flatMap((e) => e.keys.map((k) => k.key)),
    ).not.toContain("Backspace");
  });

  test("the presses that give `swallow` are exactly Delete and Backspace with no modifier", () => {
    const swallowed: string[] = [];
    for (const key of [...keysOfPart(GANTT_KEYS, "panel"), "Tab", "a", "PageDown"]) {
      for (const flags of FLAG_SETS) {
        if (panelId(panelKeyAction(press(key, flags))) === SWALLOW) {
          swallowed.push(`${key} ${JSON.stringify(flags)}`);
        }
      }
    }
    expect(swallowed.sort()).toEqual(
      ["Backspace", "Delete"].map((key) => `${key} ${JSON.stringify(NO_MODIFIER)}`),
    );
  });
});
