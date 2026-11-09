// The Tree's key table (keyboard-shortcuts-help, design decision 9): the keys its handlers take
// today, as `widgets/src/tree/model/keys.ts` binds them (`keyAction`, `toolbarKey`) and as the
// editor and the two questions take Escape, built from the vocabulary. The keys the lists retrofit
// adds (add after, add a child, select all, select none, adjust by a percentage, Alt+Shift+Delete,
// `?`) are not here: a table lists only the keys that act. A parity test in `packages/widgets`
// fails when the table and the handler differ. Plain data, no DOM (AD-1).

import { keyBinding, ownEntry, vocabularyEntry } from "../../keys/vocabulary.ts";

const GRID = "grid";
const EDITOR = "editor";
const TOOLBAR = "toolbar";

// Delete and Backspace alone: the Alt+Shift pair is the lists retrofit's.
const PLAIN_DELETE = [keyBinding("Delete"), keyBinding("Backspace")];

export const TREE_KEYS = [
  vocabularyEntry("cursor.up", GRID, "navigation"),
  vocabularyEntry("cursor.down", GRID, "navigation"),
  vocabularyEntry("cursor.left", GRID, "navigation"),
  vocabularyEntry("cursor.right", GRID, "navigation"),
  vocabularyEntry("cursor.first", GRID, "navigation"),
  vocabularyEntry("cursor.last", GRID, "navigation"),
  vocabularyEntry("edit.start", GRID, "pointer"),
  vocabularyEntry("select.toggle", GRID, "pointer"),
  vocabularyEntry("select.extendUp", GRID, "pointer"),
  vocabularyEntry("select.extendDown", GRID, "pointer"),
  vocabularyEntry("undo", GRID, "tool", { label: "tree.tool.undoAdjust" }),
  vocabularyEntry("move.up", GRID, "tool", { label: "tree.tool.moveUp" }),
  vocabularyEntry("move.down", GRID, "tool", { label: "tree.tool.moveDown" }),
  vocabularyEntry("move.right", GRID, "tool", { label: "tree.tool.indent" }),
  vocabularyEntry("move.left", GRID, "tool", { label: "tree.tool.outdent" }),
  vocabularyEntry("delete", GRID, "tool", { label: "tree.tool.remove", keys: PLAIN_DELETE }),
  vocabularyEntry("edit.commit", EDITOR, "navigation"),
  vocabularyEntry("edit.cancel", EDITOR, "navigation"),
  vocabularyEntry("toolbar.previous", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.next", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.first", TOOLBAR, "navigation"),
  vocabularyEntry("toolbar.last", TOOLBAR, "navigation"),
  ownEntry(
    "tree.cancelDelete",
    "delete-question",
    [keyBinding("Escape")],
    "navigation",
    "tree.delete.cancel",
  ),
  ownEntry(
    "tree.cancelGroup",
    "group-question",
    [keyBinding("Escape")],
    "navigation",
    "tree.group.cancel",
  ),
] as const;

/** The actions of the Tree's table. */
export type TreeKeyAction = (typeof TREE_KEYS)[number]["action"];
