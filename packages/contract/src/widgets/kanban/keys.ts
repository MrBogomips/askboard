// The Kanban's key table (keyboard-shortcuts-help, design decision 9; kanban-order, design decision
// 5): the keys its handlers take, the arrows making a card current with no modifier and the
// in-column moves of the vocabulary (`move.up`, `move.down`, `move.top`, `move.bottom`: Alt+Shift
// with the arrows, Home and End, and Ctrl or Cmd with Shift and Up and Down), both read by
// `kanbanPressOf`, and the toolbar's roving focus; "Move to…" is a menu with no key (decision 6: a
// table lists every tool and menu that acts on the content, keyless where no key takes it).
// `readOnly`: a read-only Kanban keeps its cursor; its tools, the four moves and "Move to…", are
// all off (`kanbanTools`: `!disabled`), so `toolbarStop` (`widgets/src/shared/toolbar-focus.ts:48`:
// no Tab stop when every tool is off) leaves the toolbar no focus and `toolbar.*` is `readOnly:
// false`; the moves are `readOnly: false` (the vocabulary's default for a move). A bound move is
// taken even where it cannot act (Alt+Shift+Up on the first card). Plain data, no DOM (AD-1).

import { ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const BOARD = "board";
const TOOLBAR = "toolbar";

export const KANBAN_KEYS = [
  vocabularyEntry("cursor.up", BOARD, "navigation"),
  vocabularyEntry("cursor.down", BOARD, "navigation"),
  vocabularyEntry("cursor.left", BOARD, "navigation"),
  vocabularyEntry("cursor.right", BOARD, "navigation"),
  vocabularyEntry("move.up", BOARD, "tool", { label: "kanban.moveUp" }),
  vocabularyEntry("move.down", BOARD, "tool", { label: "kanban.moveDown" }),
  vocabularyEntry("move.top", BOARD, "tool", { label: "kanban.toTop" }),
  vocabularyEntry("move.bottom", BOARD, "tool", { label: "kanban.toBottom" }),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation", { readOnly: false }),
  ownEntry("kanban.moveTo", TOOLBAR, [], "menu", { readOnly: false, label: "kanban.moveTo" }),
] as const;

/** The actions of the Kanban's table. */
export type KanbanKeyAction = (typeof KANBAN_KEYS)[number]["action"];
