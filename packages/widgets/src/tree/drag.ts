// A row's drag and drop on Pragmatic drag and drop (design decision 5; spike, task 5.1): the row is
// the draggable, held by its handle, and a drop target; native drag works in the view's sandboxed
// frame in Chromium and WebKit. The row reports what happens to the Tree through events it holds
// in a ref, so that the effect that registers it never re-runs for a new closure. Where a drop
// lands is the pointer's place on the row: its fraction of the row's height. Escape cancels the
// browser's drag, which gives `end` and no `drop`.

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { type RefObject, useEffect } from "react";

/** What a Tree's drag tells the Tree; every event carries the dragged node. */
export type RowDragEvents = {
  start(nodeId: string): void;
  /** The pointer is over `targetId`, `fraction` of the way down its row. */
  over(nodeId: string, targetId: string, fraction: number): void;
  /** The pointer left `targetId`'s row. */
  leave(targetId: string): void;
  /** The node was dropped on `targetId`, `fraction` of the way down its row. */
  drop(nodeId: string, targetId: string, fraction: number): void;
  /** The drag ended, dropped or cancelled. */
  end(nodeId: string): void;
};

/** An inert set of events, for a row that cannot drag. */
export const NO_ROW_EVENTS: RefObject<RowDragEvents> = {
  current: { start() {}, over() {}, leave() {}, drop() {}, end() {} },
};

/** A Tree's drag, shared by its rows: the Tree's ID, which tells its drops from another's, and its events. */
export type TreeDrag = {
  readonly treeId: string;
  readonly events: RefObject<RowDragEvents>;
};

/** What a row's drag data holds: the Tree it belongs to, and the node. */
type RowData = { readonly treeId: string; readonly nodeId: string };

const isRowData = (data: Record<string | symbol, unknown>): data is RowData =>
  typeof data.treeId === "string" && typeof data.nodeId === "string";

// The pointer's place on the row, from 0 at its top to 1 at its bottom.
const fractionOf = (row: HTMLElement, clientY: number): number => {
  const box = row.getBoundingClientRect();
  return box.height === 0 ? 0.5 : Math.min(1, Math.max(0, (clientY - box.top) / box.height));
};

/**
 * Makes `row` draggable by `handle` and a drop target, while `enabled`, for the node `nodeId` of
 * the Tree `treeId`. Drops from another Tree are not taken.
 */
export const useRowDrag = ({
  row,
  handle,
  treeId,
  nodeId,
  enabled,
  events,
}: {
  readonly row: RefObject<HTMLElement | null>;
  readonly handle: RefObject<HTMLElement | null>;
  readonly treeId: string;
  readonly nodeId: string;
  readonly enabled: boolean;
  readonly events: RefObject<RowDragEvents>;
}): void => {
  useEffect(() => {
    const element = row.current;
    const grip = handle.current;
    if (!enabled || element === null || grip === null) return undefined;
    const from = (source: { data: Record<string | symbol, unknown> }): RowData | undefined =>
      isRowData(source.data) && source.data.treeId === treeId ? source.data : undefined;
    return combine(
      draggable({
        element,
        dragHandle: grip,
        getInitialData: (): RowData => ({ treeId, nodeId }),
        onDragStart: () => events.current.start(nodeId),
        onDrop: () => events.current.end(nodeId),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => from(source) !== undefined,
        onDrag: ({ source, location }) => {
          const dragged = from(source);
          if (dragged === undefined) return;
          const fraction = fractionOf(element, location.current.input.clientY);
          events.current.over(dragged.nodeId, nodeId, fraction);
        },
        onDragLeave: () => events.current.leave(nodeId),
        onDrop: ({ source, location }) => {
          const dragged = from(source);
          if (dragged === undefined) return;
          const fraction = fractionOf(element, location.current.input.clientY);
          events.current.drop(dragged.nodeId, nodeId, fraction);
        },
      }),
    );
  }, [row, handle, treeId, nodeId, enabled, events]);
};
