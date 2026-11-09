// The Ranking's list and toolbar keys through the key table (view-and-widgets spec: Ranking at the
// keyboard, Ranking row selection, The user's keys on the board; design decisions 3, 8 and 19): a
// press is matched against the keys in effect, by `keyActionOf`, and the entry's action goes through
// a typed record, so that an action of the table without a handler fails the type check. A key the
// table does not bind, and `select.none` with nothing selected, is the browser's: no change at all.
// A key it does bind is taken even where it cannot act (Alt+Shift+ArrowUp on the first row), as the
// Tree's are, except the panel's own key, which the item frame acts on when nothing took it. Pure.

import {
  type KeyEntry,
  type KeyPress,
  keyActionOf,
  type RankingKeyAction,
} from "@askboard/contract";
import type { ToolbarMove } from "../shared/toolbar-focus.ts";
import { type CursorMove, currentAfter } from "./keys.ts";
import { actingRows, type MoveKind, moveRows } from "./moves.ts";
import { clear, extend, type RowSelection, toggle } from "./selection.ts";

/** What a list key sees: the order shown, the current row, the selection and whether the item takes edits. */
export type ListContext = {
  readonly order: readonly string[];
  readonly current: string;
  readonly selection: RowSelection;
  /** The Ranking is read-only: only the entries marked `readOnly` act. */
  readonly disabled: boolean;
};

/**
 * What a taken key changes; a field left out changes nothing. `taken` says whether the key's default
 * is prevented. `order` is the next order to report: a move that moved something, or "Keep this
 * order", which reports the order as it stands.
 */
export type ListChange = {
  readonly taken: boolean;
  readonly current?: string;
  readonly selection?: RowSelection;
  readonly order?: readonly string[];
};

/** The actions of the table's `list` part. */
export type ListAction = Exclude<RankingKeyAction, `toolbar.${string}`>;

/** The order after a move of the rows that act (the selection, else the current row), or none when nothing moves. */
export const moveOrder = (context: ListContext, kind: MoveKind): readonly string[] | undefined => {
  const rows = new Set(actingRows(context.order, context.selection.ids, context.current));
  const next = moveRows(context.order, rows, kind);
  return next === context.order ? undefined : next;
};

const cursor =
  (move: CursorMove) =>
  (context: ListContext): ListChange => ({
    taken: true,
    current: currentAfter(context.order, context.current, move),
  });

const extension =
  (move: "up" | "down") =>
  (context: ListContext): ListChange => {
    const target = currentAfter(context.order, context.current, move);
    return target === undefined
      ? { taken: true }
      : {
          taken: true,
          current: target,
          selection: extend(context.selection, context.order, target, context.current),
        };
  };

const moving =
  (kind: MoveKind) =>
  (context: ListContext): ListChange => {
    const order = moveOrder(context, kind);
    return order === undefined ? { taken: true } : { taken: true, order };
  };

/** Each action of the list, to what it does. */
export const LIST_HANDLERS: Readonly<Record<ListAction, (context: ListContext) => ListChange>> = {
  "cursor.up": cursor("up"),
  "cursor.down": cursor("down"),
  "cursor.first": cursor("first"),
  "cursor.last": cursor("last"),
  "select.toggle": (context) => ({
    taken: true,
    selection: toggle(context.selection, context.order, context.current),
  }),
  "select.extendUp": extension("up"),
  "select.extendDown": extension("down"),
  "move.up": moving("up"),
  "move.down": moving("down"),
  "move.top": moving("top"),
  "move.bottom": moving("bottom"),
  "ranking.keep": (context) => ({ taken: true, order: context.order }),
  "select.none": () => ({ taken: true, selection: clear() }),
  // The item frame opens the panel on a key nothing took.
  "keys.open": () => ({ taken: false }),
};

/**
 * What a press does in the list: the change of the entry it triggers in `table`, the keys in effect,
 * or none when the key is the browser's. A read-only Ranking acts only on the entries marked
 * `readOnly` and takes the rest without change.
 */
export const listKeyChange = (
  table: readonly KeyEntry[],
  press: KeyPress,
  context: ListContext,
): ListChange | undefined => {
  const entry = keyActionOf(table, "list", press, context.selection.ids.size > 0);
  if (entry === undefined) return undefined;
  if (context.disabled && !entry.readOnly) return { taken: true };
  return LIST_HANDLERS[entry.action as ListAction](context);
};

const TOOLBAR_MOVES: Readonly<Record<string, ToolbarMove>> = {
  "toolbar.previous": "previous",
  "toolbar.next": "next",
  "toolbar.first": "first",
  "toolbar.last": "last",
};

/** The move among the toolbar's tools a press makes, by the keys in effect, or none. */
export const toolbarMoveOfPress = (
  table: readonly KeyEntry[],
  press: KeyPress,
): ToolbarMove | undefined => {
  const entry = keyActionOf(table, "toolbar", press, false);
  return entry === undefined ? undefined : TOOLBAR_MOVES[entry.action];
};
