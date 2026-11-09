// The Kanban's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, the arrows moving the current card with no modifier (`kanbanKeyOf`) and the toolbar's
// roving focus; "Move to…" is a menu with no key (decision 6: a table lists every tool and menu
// that acts on the content, keyless where no key takes it). When `kanban-order` merges, its
// in-column moves join as `tool` entries. `readOnly`: a read-only Kanban keeps its cursor and its
// toolbar's focus; "Move to…" does not act (`kanbanTools`: `!disabled`). Plain data, no DOM (AD-1).

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
  ownEntry("kanban.moveTo", TOOLBAR, [], "menu", { readOnly: false, label: "kanban.moveTo" }),
] as const;

/** The actions of the Kanban's table. */
export type KanbanKeyAction = (typeof KANBAN_KEYS)[number]["action"];
