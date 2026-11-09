// The Kanban's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, the arrows moving the current card with no modifier (`kanbanKeyOf`) and the toolbar's
// roving focus; "Move to…" is a menu with no key. When `kanban-order` merges, its in-column moves
// join as `tool` entries. Plain data, no DOM (AD-1).

import { ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const BOARD = "board";
const TOOLBAR = "toolbar";

export const KANBAN_KEYS = [
  vocabularyEntry("cursor.up", BOARD, "navigation"),
  vocabularyEntry("cursor.down", BOARD, "navigation"),
  vocabularyEntry("cursor.left", BOARD, "navigation"),
  vocabularyEntry("cursor.right", BOARD, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation"),
  ownEntry("kanban.moveTo", TOOLBAR, [], "menu", "kanban.moveTo"),
] as const;

/** The actions of the Kanban's table. */
export type KanbanKeyAction = (typeof KANBAN_KEYS)[number]["action"];
