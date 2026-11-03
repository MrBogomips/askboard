// The callbacks each item gets through the port, which `RenderItem` builds (AD-9; molecules,
// design decision 11): `onValueChange` puts the item's own value into the draft record, and
// `onValuesChange` the values of several items of its question in one draft update, as a linked
// edit does; each first runs the shell's step before a change, such as the start of a revision
// (ask-lifecycle, task 6.7), once. An update naming an item outside the question changes nothing
// and goes to the item's error path, as a thrown render error does. Also the value an item shows.
// Plain functions, tested without a DOM.

import type { BoardContent } from "../catalog/port.ts";
import type { DraftStore } from "./draft-store.ts";

export type ItemCallbackInputs = {
  readonly draft: DraftStore;
  readonly itemId: string;
  /** The question the item sits in. */
  readonly questionId: string;
  /** The items the question's draft values may name (`itemIdsOf`): the only ones it may write. */
  readonly itemIds: readonly string[];
  /** Runs before each change the component puts back, such as the start of a revision. */
  readonly onBeforeChange?: (() => void) | undefined;
  /** The item's error path. */
  readonly onError: (error: unknown) => void;
};

export type ItemCallbacks = {
  readonly onValueChange: (value: unknown) => void;
  readonly onValuesChange: (values: Readonly<Record<string, unknown>>) => void;
};

const quoted = (ids: readonly string[]): string => {
  const names = ids.map((id) => `"${id}"`);
  return names.length === 1
    ? `${names[0]}, an item`
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}, items`;
};

export const itemCallbacks = ({
  draft,
  itemId,
  questionId,
  itemIds,
  onBeforeChange,
  onError,
}: ItemCallbackInputs): ItemCallbacks => ({
  onValueChange: (value) => {
    onBeforeChange?.();
    draft.set(itemId, value);
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
