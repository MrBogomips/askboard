// The Tree's key table (keyboard-shortcuts-help, design decisions 6 and 9): the keys its handlers
// take today, as `widgets/src/tree/model/keys.ts` binds them (`keyAction`, `toolbarKey`) and as the
// editor and the two questions take Escape, built from the vocabulary. A table binds only keys that
// act, and lists every tool of the toolbar that acts on the content or the selection, keyless where
// no key takes it: "Add node", "Add child", "Select all", "Select none" and "Adjust by %…" are
// entries of the type's own with no keys, which the lists retrofit replaces with the vocabulary's
// entries and the approved keys (add after, add a child, select all, select none, adjust by a
// percentage, Alt+Shift+Delete, `?`). A parity test in `packages/widgets` fails when the table and
// the handler differ.
//
// `readOnly`: a read-only Tree keeps its cursor and its toolbar's roving focus. It drops the
// selection (`tree/widget.tsx`: `if (disabled && picked.size > 0) setPicked(NO_SELECTION)`), takes
// no edit, undo, move or delete (`perform`, `liveSlot`, `editableCells`), and opens neither its
// editor nor its two questions (`asking`). Plain data, no DOM (AD-1).

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
  ownEntry("tree.addAfter", TOOLBAR, [], "tool", {
    readOnly: false,
    label: "tree.tool.addAfter",
  }),
  ownEntry("tree.addChild", TOOLBAR, [], "tool", {
    readOnly: false,
    label: "tree.tool.addChild",
  }),
  ownEntry("tree.selectAll", TOOLBAR, [], "tool", { readOnly: false, label: "tree.select.all" }),
  ownEntry("tree.selectNone", TOOLBAR, [], "tool", { readOnly: false, label: "tree.select.none" }),
  ownEntry("tree.adjust", TOOLBAR, [], "tool", { readOnly: false, label: "tree.tool.adjust" }),
  ownEntry("tree.cancelDelete", "delete-question", [keyBinding("Escape")], "navigation", {
    readOnly: false,
    label: "tree.delete.cancel",
  }),
  ownEntry("tree.cancelGroup", "group-question", [keyBinding("Escape")], "navigation", {
    readOnly: false,
    label: "tree.group.cancel",
  }),
] as const;

/** The actions of the Tree's table. */
export type TreeKeyAction = (typeof TREE_KEYS)[number]["action"];
