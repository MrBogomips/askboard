// The Tree's keys (design decision 5; proposal, open question 9): what each key does in the
// treegrid, in navigation and in edit mode, and in the toolbar. WAI-ARIA treegrid navigation;
// Enter or F2 edits the focused name or field, Enter commits and Escape cancels; Alt+Shift with
// the arrows moves a node; Delete or Backspace deletes. A key with other modifiers is not the
// Tree's: Alt+ArrowLeft and Alt+ArrowRight navigate history in Firefox and Chromium on Linux, and
// in an input Alt+Shift with an arrow selects by word. The component prevents the default of
// every key that has an action, possible or not, and leaves every other key to the browser.

import type { TreeEdit } from "./edits.ts";

/** A key press: the fields of a DOM or React keyboard event the Tree reads. */
export type TreeKey = {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** An input method is composing: the key is the composition's, never the Tree's. */
  readonly isComposing?: boolean;
};

/** Navigation, or editing a name or a field in place. */
export type KeyMode = "navigation" | "edit";

/** A focus move in the treegrid; Right and Left also expand and collapse. */
export type FocusMove = "up" | "down" | "left" | "right" | "home" | "end";

/** The edits a key makes: the moves and the delete. */
export type KeyEdit = Extract<TreeEdit, "moveUp" | "moveDown" | "indent" | "outdent" | "remove">;

/**
 * What a key does: a focus move, which a read-only Tree keeps; starting to edit the focused cell
 * (a row's name when the row has the focus); an edit, to check with `can`; committing or
 * cancelling the cell being edited.
 */
export type KeyAction =
  | { readonly kind: "focus"; readonly move: FocusMove }
  | { readonly kind: "startEdit" }
  | { readonly kind: "edit"; readonly edit: KeyEdit }
  | { readonly kind: "commit" }
  | { readonly kind: "cancel" };

/** No modifier, or exactly Alt and Shift. */
type Hold = "none" | "alt+shift";

type Binding = { readonly key: string; readonly hold: Hold; readonly action: KeyAction };

const binding = (key: string, hold: Hold, action: KeyAction): Binding =>
  Object.freeze({ key, hold, action: Object.freeze(action) });

const focus = (key: string, move: FocusMove) => binding(key, "none", { kind: "focus", move });
const editKey = (key: string, hold: Hold, edit: KeyEdit) =>
  binding(key, hold, { kind: "edit", edit });

const BINDINGS: Readonly<Record<KeyMode, readonly Binding[]>> = Object.freeze({
  navigation: Object.freeze([
    focus("ArrowUp", "up"),
    focus("ArrowDown", "down"),
    focus("ArrowLeft", "left"),
    focus("ArrowRight", "right"),
    focus("Home", "home"),
    focus("End", "end"),
    binding("Enter", "none", { kind: "startEdit" }),
    binding("F2", "none", { kind: "startEdit" }),
    editKey("ArrowUp", "alt+shift", "moveUp"),
    editKey("ArrowDown", "alt+shift", "moveDown"),
    editKey("ArrowRight", "alt+shift", "indent"),
    editKey("ArrowLeft", "alt+shift", "outdent"),
    editKey("Delete", "none", "remove"),
    editKey("Backspace", "none", "remove"),
  ]),
  edit: Object.freeze([
    binding("Enter", "none", { kind: "commit" }),
    binding("Escape", "none", { kind: "cancel" }),
  ]),
});

const holdOf = ({ altKey, ctrlKey, metaKey, shiftKey }: TreeKey): Hold | undefined => {
  if (ctrlKey || metaKey) return undefined;
  if (!altKey && !shiftKey) return "none";
  return altKey && shiftKey ? "alt+shift" : undefined;
};

/** What `key` does in `mode`, or `undefined` when it is not the Tree's and the browser keeps it. */
export const keyAction = (key: TreeKey, mode: KeyMode): KeyAction | undefined => {
  if (key.isComposing === true) return undefined;
  const hold = holdOf(key);
  return BINDINGS[mode].find((one) => one.key === key.key && one.hold === hold)?.action;
};

/** A tool of the toolbar: its edit, its name and, for a tool with keys, its aria-keyshortcuts. */
export type TreeTool = {
  readonly edit: TreeEdit;
  readonly label: string;
  readonly shortcut?: string;
};

// A tool's keys in aria-keyshortcuts' form, from the bindings, so that the two always agree.
const shortcutOf = (edit: TreeEdit): string | undefined => {
  const keys = BINDINGS.navigation
    .filter(({ action }) => action.kind === "edit" && action.edit === edit)
    .map(({ key, hold }) => (hold === "alt+shift" ? `Alt+Shift+${key}` : key));
  return keys.length === 0 ? undefined : keys.join(" ");
};

const tool = (edit: TreeEdit, label: string): TreeTool => {
  const shortcut = shortcutOf(edit);
  return Object.freeze(shortcut === undefined ? { edit, label } : { edit, label, shortcut });
};

/** The toolbar's tools in order (design decision 6). */
export const TREE_TOOLS: readonly TreeTool[] = Object.freeze([
  tool("addAfter", "Add node"),
  tool("addChild", "Add child"),
  tool("moveUp", "Move up"),
  tool("moveDown", "Move down"),
  tool("indent", "Indent"),
  tool("outdent", "Outdent"),
  tool("remove", "Delete"),
]);

/** A focus move among the toolbar's tools. */
export type ToolbarMove = "previous" | "next" | "first" | "last";

const TOOLBAR_KEYS: ReadonlyMap<string, ToolbarMove> = new Map([
  ["ArrowLeft", "previous"],
  ["ArrowRight", "next"],
  ["Home", "first"],
  ["End", "last"],
]);

/** The toolbar's move for `key`, with no modifier, or `undefined` (open question 10). */
export const toolbarKey = (key: TreeKey): ToolbarMove | undefined =>
  holdOf(key) === "none" && key.isComposing !== true ? TOOLBAR_KEYS.get(key.key) : undefined;
