// The board's own key table (board-keys, design decision D1; contract spec: The board's key table):
// the actions, parts, keys and labels of the table, the list of every table the user's keys apply
// to, `Mod+Enter` in a table, and the rule that no widget type is named `board`.

import { describe, expect, test } from "bun:test";
import {
  ALL_KEY_TABLES,
  BOARD_KEY_TABLE,
  BOARD_KEY_TYPE,
  BOARD_KEYS,
  BOARD_PART,
  type KeyTable,
  keyBinding,
  keyTableProblems,
  ownEntry,
  REGISTERED_KEY_TABLES,
  WIDGET_TYPES,
} from "../src/index.ts";

const typesNamedBoard = (types: readonly { readonly type: string }[]): readonly string[] =>
  types.filter((entry) => entry.type === BOARD_KEY_TYPE).map((entry) => entry.type);

const problems = (table: KeyTable): readonly string[] =>
  keyTableProblems("probe", table).map((problem) => problem.message);

describe("the board's table", () => {
  test("names and passes the table check", () => {
    expect(BOARD_KEY_TYPE).toBe("board");
    expect(BOARD_PART).toBe("board");
    expect(keyTableProblems(BOARD_KEY_TYPE, BOARD_KEYS)).toEqual([]);
  });

  test("holds the entries of D1's table", () => {
    const rows = BOARD_KEYS.map((entry) => ({
      action: entry.action,
      part: entry.part,
      keys: entry.keys.map(({ key, hold }) => `${hold}:${key}`),
      shows: entry.shows,
      readOnly: entry.readOnly,
      label: entry.label,
    }));
    expect(rows).toEqual([
      {
        action: "board.nextOpen",
        part: "board",
        keys: ["none:n"],
        shows: "tool",
        readOnly: true,
        label: "header.nextOpen",
      },
      {
        action: "board.previousOpen",
        part: "board",
        keys: ["shift:n"],
        shows: "navigation",
        readOnly: true,
        label: "keys.action.board.previousOpen",
      },
      {
        action: "board.answer",
        part: "board",
        keys: ["mod:Enter"],
        shows: "tool",
        readOnly: false,
        label: "keys.action.board.answer",
      },
      {
        action: "keys.open",
        part: "board",
        keys: ["char:?"],
        shows: "panel",
        readOnly: true,
        label: "keys.action.keys.open",
      },
      {
        action: "board.sendFollowUp",
        part: "editor",
        keys: ["mod:Enter"],
        shows: "tool",
        readOnly: false,
        label: "keys.action.board.sendFollowUp",
      },
    ]);
  });

  test("is the table of the type `board`", () => {
    expect(BOARD_KEY_TABLE).toEqual({ type: BOARD_KEY_TYPE, keys: BOARD_KEYS });
  });
});

describe("ALL_KEY_TABLES", () => {
  test("is the board's table, then the registered ones in order, frozen", () => {
    expect(Object.isFrozen(ALL_KEY_TABLES)).toBe(true);
    expect(ALL_KEY_TABLES).toHaveLength(REGISTERED_KEY_TABLES.length + 1);
    expect(ALL_KEY_TABLES[0]).toBe(BOARD_KEY_TABLE);
    expect(ALL_KEY_TABLES.slice(1)).toEqual([...REGISTERED_KEY_TABLES]);
  });
});

describe("Cmd or Ctrl with Enter in a table", () => {
  test("passes; W does not; Mod+Shift+Enter still passes", () => {
    const entry = (action: string, key: string, hold: "mod" | "mod+shift") =>
      ownEntry(`probe.${action}`, "list", [keyBinding(key, hold)], "tool", { readOnly: false });
    expect(problems([entry("send", "Enter", "mod")])).toEqual([]);
    const refused = problems([entry("close", "w", "mod")]);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain("probe");
    expect(refused[0]).toContain("Ctrl/Cmd+w");
    expect(problems([entry("child", "Enter", "mod+shift")])).toEqual([]);
  });
});

describe("no widget type is named board", () => {
  test("the registry has none", () => {
    expect(typesNamedBoard(WIDGET_TYPES)).toEqual([]);
  });

  test("a probe registry that holds one is named by the helper", () => {
    expect(typesNamedBoard([...WIDGET_TYPES, { type: "board" }])).toEqual(["board"]);
  });
});
