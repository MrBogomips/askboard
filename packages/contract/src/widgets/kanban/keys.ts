// The Kanban's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, the arrows moving the current card with no modifier (`kanbanKeyOf`) and the toolbar's
// roving focus; "Move to…" is a menu with no key (decision 6: a table lists every tool and menu
// that acts on the content, keyless where no key takes it). When `kanban-order` merges, its
// in-column moves join as `tool` entries. `readOnly`: a read-only Kanban keeps its cursor; its
// one tool, "Move to…", is off (`kanbanTools`: `!disabled`), so `toolbarStop`
// (`widgets/src/shared/toolbar-focus.ts:48`: no Tab stop when every tool is off) leaves the toolbar
// no focus and `toolbar.*` is `readOnly: false`. Plain data, no DOM (AD-1).

import { ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const BOARD = "board";
const TOOLBAR = "toolbar";

export const KANBAN_KEYS = [
  vocabularyEntry("cursor.up", BOARD, "navigation"),
  vocabularyEntry("cursor.down", BOARD, "navigation"),
  vocabularyEntry("cursor.left", BOARD, "navigation"),
  vocabularyEntry("cursor.right", BOARD, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation", { readOnly: false }),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation", { readOnly: false }),
  ownEntry("kanban.moveTo", TOOLBAR, [], "menu", { readOnly: false, label: "kanban.moveTo" }),
] as const;

/** The actions of the Kanban's table. */
export type KanbanKeyAction = (typeof KANBAN_KEYS)[number]["action"];
