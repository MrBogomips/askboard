// The board's own key table (board-keys, design decision D1; contract spec: The board's key table):
// the keys that act across the board and not inside one widget: next and previous open question,
// answer the question in focus, the keys panel, and the follow-up composer's send. It is checked by
// `keyTableProblems` under the name `board`, so `ask-core` and the board page run the override
// check on it with the registered tables (`ALL_KEY_TABLES`). It is not a widget type, and it is
// not in `KEY_TABLES_ON_BOARD`, which names the types whose chunk registers a table. Plain data,
// no DOM (AD-1).

import type { RegisteredKeyTable } from "./tables.ts";
import { keyBinding, ownEntry, vocabularyEntry } from "./vocabulary.ts";

/** The name the board's table is checked under; no widget type may be named so (`board.<name>`). */
export const BOARD_KEY_TYPE = "board";

/** The part where the board's keys act across the board's controls (buttons, options, links). */
export const BOARD_PART = "board";

const EDITOR = "editor";

export const BOARD_KEYS = [
  ownEntry("board.nextOpen", BOARD_PART, [keyBinding("n")], "tool", {
    readOnly: true,
    label: "header.nextOpen",
  }),
  ownEntry("board.previousOpen", BOARD_PART, [keyBinding("n", "shift")], "navigation", {
    readOnly: true,
  }),
  ownEntry("board.answer", BOARD_PART, [keyBinding("Enter", "mod")], "tool", {
    readOnly: false,
  }),
  vocabularyEntry("keys.open", BOARD_PART, "panel"),
  ownEntry("board.sendFollowUp", EDITOR, [keyBinding("Enter", "mod")], "tool", {
    readOnly: false,
  }),
] as const;

/** The actions of the board's table: a handler maps each through a typed record. */
export type BoardKeyAction = (typeof BOARD_KEYS)[number]["action"];

/** The board's table as the override check reads a registered type's. */
export const BOARD_KEY_TABLE: RegisteredKeyTable = Object.freeze({
  type: BOARD_KEY_TYPE,
  keys: BOARD_KEYS,
});
