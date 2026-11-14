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
//
// The other parts' keys are functions of the press too, so that the key table's parity test reaches
// them (keyboard-shortcuts-help, decisions 7 and 9): `switchKeyMove` for the "Critical path"
// switch (ArrowLeft and Home, no modifier) and `panelKeyAction` for the predecessors panel; the
// Task column's edge is `edgeKeyAction` in `column-width.ts`.

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

/**
 * Where a press moves the focus from the "Critical path" switch: back to the zoom's last option on
 * ArrowLeft or Home, held with no modifier (keyboard-shortcuts-help, design decision 7). Shift with
 * either keeps its default; Space is Radix's.
 */
export const switchKeyMove = (press: KeyPress): ToolMove | undefined => {
  if (modified(press)) return undefined;
  if (press.key === "ArrowLeft") return "previous";
  return press.key === "Home" ? "first" : undefined;
};

/** What a press does in the predecessors panel. */
export type PanelAction =
  | { readonly kind: "done" }
  | { readonly kind: "cancel" }
  | { readonly kind: "move"; readonly step: 1 | -1 }
  /** Taken, with its default prevented, and changes nothing: Delete and Backspace. */
  | { readonly kind: "swallow" };

const panelAction = (value: PanelAction): PanelAction => Object.freeze(value);

const PANEL_DONE = panelAction({ kind: "done" });
const PANEL_CANCEL = panelAction({ kind: "cancel" });
const PANEL_DOWN = panelAction({ kind: "move", step: 1 });
const PANEL_UP = panelAction({ kind: "move", step: -1 });
const PANEL_SWALLOW = panelAction({ kind: "swallow" });

const PANEL_KEYS: ReadonlyMap<string, PanelAction> = new Map([
  ["Enter", PANEL_DONE],
  ["Escape", PANEL_CANCEL],
  ["ArrowDown", PANEL_DOWN],
  ["ArrowUp", PANEL_UP],
  ["Backspace", PANEL_SWALLOW],
  ["Delete", PANEL_SWALLOW],
]);

/** What a key does in the predecessors panel, or undefined: with any modifier, or not the panel's. */
export const panelKeyAction = (press: KeyPress): PanelAction | undefined =>
  modified(press) ? undefined : PANEL_KEYS.get(press.key);
