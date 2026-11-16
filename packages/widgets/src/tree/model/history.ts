// The Tree's edit history (tree-edit-undo design decisions 1 and 2; spec, "Tree undo" and "Tree
// undo history"): each write the Tree makes to the draft record keeps, per item it wrote, the entry
// it replaced and the one it put. Undo writes the entries back, so a fully undone Tree has no
// draft entry. View state: never in a draft or an answer. Plain ECMAScript (AD-1); the hook that
// holds the list is `history.ts` in `tree/`.

import { sameJson } from "./marks.ts";

/** How many edits the history keeps; the oldest goes past it. */
export const TREE_HISTORY_DEPTH = 50;

/** One item's draft entry before an edit and after it; `undefined` is no entry. */
export type Written = { readonly before: unknown; readonly after: unknown };

/** One edit: what it wrote by item ID, and the node it acted on, for the focus after an undo. */
export type HistoryEntry = {
  readonly written: Readonly<Record<string, Written>>;
  readonly nodeId: string | undefined;
};

/** Reads an item's draft entry, `undefined` for none. */
export type DraftOf = (itemId: string) => unknown;

/** The entry of writing `values` over what `draftOf` holds; none when nothing would change. */
export const entryOf = (
  draftOf: DraftOf,
  values: Readonly<Record<string, unknown>>,
  nodeId?: string,
): HistoryEntry | undefined => {
  const written: Record<string, Written> = {};
  let changes = false;
  for (const [id, after] of Object.entries(values)) {
    const before = draftOf(id);
    written[id] = { before, after };
    if (!sameJson(before, after)) changes = true;
  }
  return changes ? { written, nodeId } : undefined;
};

/** `history` with `entry` on top, the oldest dropped past `TREE_HISTORY_DEPTH`. */
export const pushed = (
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
): readonly HistoryEntry[] => [...history, entry].slice(-TREE_HISTORY_DEPTH);

/** `history` without its latest entry. */
export const popped = (history: readonly HistoryEntry[]): readonly HistoryEntry[] =>
  history.slice(0, -1);

/** The top entry while every item it wrote still holds what it put; `undefined` otherwise. */
export const liveTop = (
  history: readonly HistoryEntry[],
  draftOf: DraftOf,
): HistoryEntry | undefined => {
  const top = history.at(-1);
  if (top === undefined) return undefined;
  const live = Object.entries(top.written).every(([id, { after }]) => sameJson(draftOf(id), after));
  return live ? top : undefined;
};

/** What undoing `entry` writes: each item's entry before the edit. */
export const undoValues = (entry: HistoryEntry): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(entry.written).map(([id, { before }]) => [id, before]));

/** Why a history is emptied: the Tree is disabled, or the agent sent a new value. */
export type Emptying = { readonly disabled: boolean; readonly sentChanged: boolean };

/** `history`, or an empty list when it must go: see `Emptying`, or its top entry is stale. */
export const kept = (
  history: readonly HistoryEntry[],
  draftOf: DraftOf,
  { disabled, sentChanged }: Emptying,
): readonly HistoryEntry[] => {
  if (history.length === 0) return history;
  if (disabled || sentChanged) return [];
  return liveTop(history, draftOf) === undefined ? [] : history;
};
