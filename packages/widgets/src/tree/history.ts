// The Tree's history hook (tree-edit-undo design decisions 1 and 2): every write the Tree makes to
// the draft record goes through `record`, which keeps what it replaced; `undo` writes the latest
// edit's entries back in one update. The list is view state held in memory, emptied while the Tree
// is read-only, when the agent sends a new value, and when anything but the Tree changed what the
// latest edit wrote (`model/history.ts`). Never in a draft or an answer.

import type { BoardContent } from "@askboard/view/catalog";
import { useCallback, useRef, useState } from "react";
import {
  type DraftOf,
  entryOf,
  type HistoryEntry,
  kept,
  liveTop,
  popped,
  pushed,
  undoValues,
} from "./model/history.ts";
import { sameJson } from "./model/marks.ts";

/** Writes several items of the question into the draft record in one update, `undefined` for none. */
type WriteValues = (values: Readonly<Record<string, unknown>>) => void;

/** What the Tree's boundary takes of its history. */
export type TreeHistory = {
  /** Writes `values` and remembers what they replaced; `nodeId` is the node the edit acted on. */
  readonly record: (values: Readonly<Record<string, unknown>>, nodeId?: string) => void;
  /** Writes back the latest live edit's entries; its `nodeId` when there was one to undo. */
  readonly undo: () => { readonly nodeId: string | undefined } | undefined;
  readonly canUndo: boolean;
};

export const useTreeHistory = ({
  board,
  sent,
  disabled,
  onValuesChange,
}: {
  readonly board: BoardContent;
  /** The agent's props: a new value empties the history. */
  readonly sent: unknown;
  readonly disabled: boolean;
  readonly onValuesChange: WriteValues;
}): TreeHistory => {
  const [stored, setStored] = useState<readonly HistoryEntry[]>([]);
  const [sentThen, setSentThen] = useState(sent);
  const draftOf: DraftOf = useCallback((id) => board.draft.get(id), [board]);
  // The agent's props are the same value while they are the same by structure, whatever the object.
  const sentChanged = sentThen !== sent && !sameJson(sentThen, sent);
  const history = kept(stored, draftOf, { disabled, sentChanged });
  if (sentThen !== sent) setSentThen(sent);
  if (history !== stored) setStored(history);
  // The latest edit's own write is in `board.draft` only once the shell re-renders the Tree, so the
  // list is read through a ref for the callbacks, which run between renders.
  const latest = useRef({ history, draftOf, disabled });
  latest.current = { history, draftOf, disabled };

  const record = useCallback(
    (values: Readonly<Record<string, unknown>>, nodeId?: string) => {
      const entry = entryOf(latest.current.draftOf, values, nodeId);
      onValuesChange(values);
      if (entry === undefined) return;
      // The draft the edit replaced is the one the list's top was live against: a stale top goes.
      const { history: held, draftOf: read } = latest.current;
      const base = liveTop(held, read) === undefined ? [] : held;
      const next = pushed(base, entry);
      latest.current = { ...latest.current, history: next };
      setStored(next);
    },
    [onValuesChange],
  );

  const undo = useCallback(() => {
    const { history: held, draftOf: read, disabled: locked } = latest.current;
    const top = locked ? undefined : liveTop(held, read);
    if (top === undefined) return undefined;
    onValuesChange(undoValues(top));
    const next = popped(held);
    latest.current = { ...latest.current, history: next };
    setStored(next);
    return { nodeId: top.nodeId };
  }, [onValuesChange]);

  return { record, undo, canUndo: !disabled && history.length > 0 };
};
