// The callbacks each item gets through the port, which `RenderItem` builds (AD-9; molecules,
// design decision 11): `onValueChange` puts the item's own value into the draft record, and
// `onValuesChange` the values of several items of its question in one draft update, as a linked
// edit does; each first runs the shell's step before a change, such as the start of a revision
// (ask-lifecycle, task 6.7), once. An update naming an item outside the question changes nothing
// and goes to the item's error path, as a thrown render error does. `onResultChange` puts the
// item's result into the results store beside the draft record, none (`undefined`) removing it, after
// the same step (widget-registry, design decision 9), and refuses one that is not JSON. `onEntryChange`
// puts the text a field cannot read into the entries store, cut at the limit, none removing it, and
// clears the item's result, as a result clears its entry: an item holds one or the other, never both
// (atoms, design decision 3). `onCellEntriesChange` replaces a Table's whole map of cell entries in the
// cell entries store, the same way (table-widget, design decision 8). An item in `readOnlyItems`, which
// the card cannot show the revision of its work for, writes no value through `onValueChange` and none
// through `onValuesChange`, which refuses the whole update naming it: the console names the item,
// nothing is failed and no step runs (keep-mine-shown-revision, design decision 3). Also the value and
// the result an item shows.
// Plain functions, tested without a DOM.

import { JSON_MAX_DEPTH, resultHoldsNothing } from "@askboard/contract";
import type { BoardContent } from "../catalog/port.ts";
import { isJsonValue } from "../view-protocol.ts";
import { cutCellEntries, sameCellEntries } from "./cell-entries.ts";
import type { DraftStore } from "./draft-store.ts";
import { cutEntry } from "./entries.ts";

export type ItemCallbackInputs = {
  readonly draft: DraftStore;
  /** The results store beside the draft record; without one, a reported result is not held. */
  readonly results?: DraftStore | undefined;
  /** The entries store beside the draft record; without one, a reported entry is not held. */
  readonly entries?: DraftStore | undefined;
  /** The item's type holds an entry (`isEntryType`); an item that reports one without it fails. */
  readonly entryAllowed?: boolean | undefined;
  /** The cell entries store beside the draft record; without one, a reported entry is not held. */
  readonly cellEntries?: DraftStore | undefined;
  /** The item is a Table, which holds cell entries; any other item that reports one fails. */
  readonly cellEntriesAllowed?: boolean | undefined;
  readonly itemId: string;
  /** The question the item sits in. */
  readonly questionId: string;
  /** The items the question's draft values may name (`itemIdsOf`): the only ones it may write. */
  readonly itemIds: readonly string[];
  /** The items that take no edit, by ID (`readOnlyItemsOf`); none: every item takes edits. */
  readonly readOnlyItems?: ReadonlySet<string> | undefined;
  /** Runs before each change the component puts back, such as the start of a revision. */
  readonly onBeforeChange?: (() => void) | undefined;
  /** The item's error path. */
  readonly onError: (error: unknown) => void;
};

export type ItemCallbacks = {
  readonly onValueChange: (value: unknown) => void;
  readonly onValuesChange: (values: Readonly<Record<string, unknown>>) => void;
  readonly onResultChange: (result: unknown) => void;
  readonly onEntryChange: (entry: string | undefined) => void;
  readonly onCellEntriesChange: (entries: ReadonlyMap<string, string>) => void;
};

const quoted = (ids: readonly string[]): string => {
  const names = ids.map((id) => `"${id}"`);
  return names.length === 1
    ? `${names[0]}, an item`
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}, items`;
};

// A disabled component that still writes is a component defect, not a reason to block the question:
// the write is dropped and said on the console, naming the item.
const refuseWrite = (itemId: string, named: readonly string[]): void => {
  console.error(
    `askboard: the item${named.length === 1 ? "" : "s"} ${named.map((id) => `"${id}"`).join(", ")} takes no edit on a revision the board cannot show, so the change of the item "${itemId}" was not taken`,
  );
};

export const itemCallbacks = ({
  draft,
  results,
  entries,
  entryAllowed = false,
  cellEntries,
  cellEntriesAllowed = false,
  itemId,
  questionId,
  itemIds,
  readOnlyItems,
  onBeforeChange,
  onError,
}: ItemCallbackInputs): ItemCallbacks => ({
  onValueChange: (value) => {
    if (readOnlyItems?.has(itemId) === true) {
      refuseWrite(itemId, [itemId]);
      return;
    }
    onBeforeChange?.();
    draft.set(itemId, value);
  },
  onResultChange: (result) => {
    if (results === undefined) return;
    // `undefined` is the component's report of no result (the port's "`undefined` for none"): it
    // clears the item's result after the step before a change and is no error.
    if (result === undefined) {
      onBeforeChange?.();
      results.set(itemId, undefined);
      return;
    }
    // A result that is not JSON, one that holds itself included, is held nowhere and fails the
    // item, so that the rest of the board still answers (approval-scale-ranking, decision 4). It
    // is no change the user made, so it starts no revision.
    if (!isJsonValue(result, JSON_MAX_DEPTH)) {
      results.set(itemId, undefined);
      onError(
        new Error(
          `the item "${itemId}" reported a result that is not JSON nested at most ${JSON_MAX_DEPTH} levels`,
        ),
      );
      return;
    }
    onBeforeChange?.();
    // A result that holds nothing is no result: it clears the item's, as none does. A result
    // takes the item's entry out: the text was read.
    const held = resultHoldsNothing(result) ? undefined : result;
    results.set(itemId, held);
    if (held !== undefined) entries?.set(itemId, undefined);
  },
  onEntryChange: (entry) => {
    if (entries === undefined) return;
    if (entry === undefined || entry === "") {
      onBeforeChange?.();
      entries.set(itemId, undefined);
      return;
    }
    if (!entryAllowed || typeof entry !== "string") {
      onError(
        new Error(
          entryAllowed
            ? `the item "${itemId}" reported an entry that is no text`
            : `the item "${itemId}" reported an entry, which its type does not hold`,
        ),
      );
      return;
    }
    onBeforeChange?.();
    entries.set(itemId, cutEntry(entry));
    results?.set(itemId, undefined);
  },
  onCellEntriesChange: (entries) => {
    if (cellEntries === undefined) return;
    if (!(entries instanceof Map) || !cellEntriesAllowed) {
      onError(
        new Error(
          cellEntriesAllowed
            ? `the item "${itemId}" reported cell entries that are no map`
            : `the item "${itemId}" reported cell entries, which its type does not hold`,
        ),
      );
      return;
    }
    // The whole map replaces the item's: each text cut at the limit, empty ones dropped. The same
    // cells again change nothing, so the step before a change and the mirror do not run.
    const cut = cutCellEntries(entries);
    if (sameCellEntries(cellEntries.valueOf(itemId), cut)) return;
    onBeforeChange?.();
    cellEntries.set(itemId, cut);
  },
  onValuesChange: (values) => {
    const outside = Object.keys(values).filter((id) => !itemIds.includes(id));
    if (outside.length > 0) {
      onError(
        new Error(
          `the item "${itemId}" may not change ${quoted(outside)} its question "${questionId}" does not hold`,
        ),
      );
      return;
    }
    const held = Object.keys(values).filter((id) => readOnlyItems?.has(id) === true);
    if (held.length > 0) {
      refuseWrite(itemId, held);
      return;
    }
    onBeforeChange?.();
    draft.update(values);
  },
});

/**
 * The value an item shows: what the card shows in place of the draft, such as the answer being
 * sent or the latest answer while no revision is under way, else the board's shown value, its
 * draft value or its question's latest answer's, so that an item of a question being revised
 * shows its answer's value until the user changes it.
 */
export const itemValueOf = (cardShown: unknown, board: BoardContent, itemId: string): unknown =>
  cardShown ?? board.shown.get(itemId);

/**
 * The result an item shows: what the card shows in place of the draft, such as the answer being
 * sent or the logged one, else the result the user holds, else its question's latest answer's,
 * which stays while the question is revised; none when it has none.
 */
export const itemResultOf = (cardShown: unknown, held: unknown, answered: unknown): unknown =>
  cardShown ?? held ?? answered;
