// The Gantt's keys (proposal, open question 18; EXPERIENCE Accessibility Floor): the grid is one
// Tab stop where the arrow keys, Home and End move between cells, Enter or F2 edits the focused
// start, duration or predecessors, and Delete or Backspace on a start, or on a plan's pinned
// duration, clears the request; in edit
// mode, Enter commits and Escape cancels, and the field keeps every other key. A plan's toolbar is
// a second Tab stop with roving focus. Each key acts with no modifier held; with one it does
// nothing. A key with an action prevents its default; so does each of the grid's own keys where it
// has none, such as Backspace on a name or in a read-only Gantt, which WebKit would take for "go
// back" (view spec, "Gantt keyboard": these keys trigger no browser action); any other key is left
// to the browser.

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
  /** The focused cell holds a plan task's requested duration, which Delete clears. */
  readonly clearable?: boolean;
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

/** Whether a key is one of the grid's own, with no modifier held, whatever it does where it is. */
export const isGridKey = (press: KeyPress): boolean =>
  !modified(press) && NAVIGATION_KEYS.has(press.key);

/** What a key does in the grid, or undefined when it is not the grid's. */
export const gridKeyAction = (press: KeyPress, context: GridKeyContext): GridAction | undefined => {
  if (modified(press)) return undefined;
  if (context.mode === "edit") return EDIT_KEYS.get(press.key);
  const found = NAVIGATION_KEYS.get(press.key);
  if (found === EDIT) return context.editable ? EDIT : undefined;
  if (found === CLEAR) return context.editable && clears(context) ? CLEAR : undefined;
  return found;
};

/** Whether Delete clears the focused cell: a start's request, or a plan task's requested duration. */
const clears = (context: GridKeyContext): boolean =>
  context.column === "start" || (context.column === "duration" && context.clearable === true);

/** Where a key moves the toolbar's focus, or undefined when it is not the toolbar's. */
export const toolbarKeyMove = (press: KeyPress): ToolMove | undefined =>
  modified(press) ? undefined : TOOLBAR_KEYS.get(press.key);
