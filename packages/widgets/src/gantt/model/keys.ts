// The Gantt's keys (proposal, open question 18; EXPERIENCE Accessibility Floor): the grid is one
// Tab stop where the arrow keys, Home and End move between cells, Enter or F2 edits the focused
// start, duration or predecessors, and Delete or Backspace on a start clears the request; in edit
// mode, Enter commits and Escape cancels, and the field keeps every other key. A plan's toolbar is
// a second Tab stop with roving focus. Each key acts with no modifier held; with one it does
// nothing. A key with no action is left to the browser; one with an action prevents its default.

import type { GanttColumn } from "./tasks.ts";

/** What the model reads of a key event. */
export type KeyPress = {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
};

export type FocusMove = "up" | "down" | "left" | "right" | "home" | "end";

export type GridAction =
  | { readonly kind: "move"; readonly move: FocusMove }
  /** Edits the focused cell: its field, or the predecessors panel. */
  | { readonly kind: "edit" }
  /** Clears the focused start's request. */
  | { readonly kind: "clear" }
  | { readonly kind: "commit" }
  | { readonly kind: "cancel" };

export type GridKeyContext = {
  readonly mode: "navigate" | "edit";
  readonly column: GanttColumn;
  /** The focused cell is the user's to edit, and the Gantt takes edits. */
  readonly editable: boolean;
};

export type ToolMove = "next" | "previous" | "first" | "last";

const action = (value: GridAction): GridAction => Object.freeze(value);

const moveTo = (move: FocusMove): GridAction => action({ kind: "move", move });

const EDIT = action({ kind: "edit" });
const CLEAR = action({ kind: "clear" });

/** In navigation, with no modifier held: what each key does. Maps, so a key is never a prototype's. */
const NAVIGATION_KEYS: ReadonlyMap<string, GridAction> = new Map([
  ["ArrowUp", moveTo("up")],
  ["ArrowDown", moveTo("down")],
  ["ArrowLeft", moveTo("left")],
  ["ArrowRight", moveTo("right")],
  ["Home", moveTo("home")],
  ["End", moveTo("end")],
  ["Enter", EDIT],
  ["F2", EDIT],
  ["Delete", CLEAR],
  ["Backspace", CLEAR],
]);

/** In edit mode, with no modifier held. */
const EDIT_KEYS: ReadonlyMap<string, GridAction> = new Map([
  ["Enter", action({ kind: "commit" })],
  ["Escape", action({ kind: "cancel" })],
]);

const TOOLBAR_KEYS: ReadonlyMap<string, ToolMove> = new Map([
  ["ArrowRight", "next"],
  ["ArrowLeft", "previous"],
  ["Home", "first"],
  ["End", "last"],
]);

const modified = (press: KeyPress): boolean =>
  press.shiftKey || press.ctrlKey || press.altKey || press.metaKey;

/** What a key does in the grid, or undefined when it is not the grid's. */
export const gridKeyAction = (press: KeyPress, context: GridKeyContext): GridAction | undefined => {
  if (modified(press)) return undefined;
  if (context.mode === "edit") return EDIT_KEYS.get(press.key);
  const found = NAVIGATION_KEYS.get(press.key);
  if (found === EDIT) return context.editable ? EDIT : undefined;
  if (found === CLEAR) return context.editable && context.column === "start" ? CLEAR : undefined;
  return found;
};

/** Where a key moves the toolbar's focus, or undefined when it is not the toolbar's. */
export const toolbarKeyMove = (press: KeyPress): ToolMove | undefined =>
  modified(press) ? undefined : TOOLBAR_KEYS.get(press.key);
