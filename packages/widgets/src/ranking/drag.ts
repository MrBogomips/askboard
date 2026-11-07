// A row's drag and drop on Pragmatic drag and drop (design decision 8), as the Tree's (`tree/
// drag.ts`): the row is the draggable, held by its handle, and a drop target; native drag works in
// the view's sandboxed frame in Chromium and WebKit. Its data names the Ranking and the element,
// so that a drop from another Ranking, or from a Tree, is not taken. Where a drop lands is the
// pointer's place on the row, its fraction of the row's height. Escape cancels the browser's drag,
// which gives `end` and no `drop`. The library comes from the `dnd` chunk, which the build
// provides to the Tree's chunk and this one.

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { type RefObject, useEffect } from "react";

/** What a Ranking's drag tells the Ranking; every event carries the dragged element. */
export type RowDragEvents = {
  start(id: string): void;
  /** The pointer is over `targetId`, `fraction` of the way down its row. */
  over(id: string, targetId: string, fraction: number): void;
  /** The pointer left `targetId`'s row. */
  leave(targetId: string): void;
  /** The element was dropped on `targetId`, `fraction` of the way down its row. */
  drop(id: string, targetId: string, fraction: number): void;
  /** The drag ended, dropped or cancelled. */
  end(id: string): void;
};

/** What a row's drag data holds: the Ranking it belongs to, and the element. */
type RowData = { readonly rankingId: string; readonly itemId: string };

const isRowData = (data: Record<string | symbol, unknown>): data is RowData =>
  typeof data.rankingId === "string" && typeof data.itemId === "string";

// The pointer's place on the row, from 0 at its top to 1 at its bottom.
const fractionOf = (row: HTMLElement, clientY: number): number => {
  const box = row.getBoundingClientRect();
  return box.height === 0 ? 0.5 : Math.min(1, Math.max(0, (clientY - box.top) / box.height));
};

/**
 * Makes `row` draggable by `handle` and a drop target, while `enabled`, for the element `itemId`
 * of the Ranking `rankingId`. Drops from anything else are not taken. The events are read from a
 * ref, so that the effect that registers the row never re-runs for a new closure.
 */
export const useRowDrag = ({
  row,
  handle,
  rankingId,
  itemId,
  enabled,
  events,
}: {
  readonly row: RefObject<HTMLElement | null>;
  readonly handle: RefObject<HTMLElement | null>;
  readonly rankingId: string;
  readonly itemId: string;
  readonly enabled: boolean;
  readonly events: RefObject<RowDragEvents>;
}): void => {
  useEffect(() => {
    const element = row.current;
    const grip = handle.current;
    if (!enabled || element === null || grip === null) return undefined;
    const from = (source: { data: Record<string | symbol, unknown> }): RowData | undefined =>
      isRowData(source.data) && source.data.rankingId === rankingId ? source.data : undefined;
    return combine(
      draggable({
        element,
        dragHandle: grip,
        getInitialData: (): RowData => ({ rankingId, itemId }),
        onDragStart: () => events.current.start(itemId),
        onDrop: () => events.current.end(itemId),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => from(source) !== undefined,
        onDrag: ({ source, location }) => {
          const dragged = from(source);
          if (dragged === undefined) return;
          const fraction = fractionOf(element, location.current.input.clientY);
          events.current.over(dragged.itemId, itemId, fraction);
        },
        onDragLeave: () => events.current.leave(itemId),
        onDrop: ({ source, location }) => {
          const dragged = from(source);
          if (dragged === undefined) return;
          const fraction = fractionOf(element, location.current.input.clientY);
          events.current.drop(dragged.itemId, itemId, fraction);
        },
      }),
    );
  }, [row, handle, rankingId, itemId, enabled, events]);
};
