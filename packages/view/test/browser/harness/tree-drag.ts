// A real pointer drag of a Tree row's handle, as the Tree's drag scenarios make it (widget-editing-
// plus, task 5.3): the mouse goes down on the handle, moves over the target row to a fraction of its
// height, and is released by the scenario, so that it can look at the indicator in between. The
// native drag of the sandboxed frame is the one the library uses (spike, task 5.1); the same drag
// works in Chromium and WebKit.

import type { Locator } from "playwright";
import { eventually, STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board } from "./dom.ts";
import type { TreeGrid } from "./tree-grid.ts";

/** The handle of a row, whose accessible name is "Drag <name>". */
export const handleOf = (tree: TreeGrid, nodeId: string): Locator =>
  tree.row(nodeId).locator("[data-drag-handle]");

/** The tip under the grid while a drop is refused. */
export const dragTip = (board: Board): Locator => board.view.locator("[data-drag-tip]");

const centreOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return box;
};

/** Takes the handle of `nodeId` with the mouse and starts the drag. */
export const beginDrag = async (board: Board, tree: TreeGrid, nodeId: string): Promise<void> => {
  const handle = await centreOf(handleOf(tree, nodeId));
  const { mouse } = board.page;
  await mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await mouse.down();
  await mouse.move(handle.x + handle.width / 2 + 12, handle.y - 4, { steps: 4 });
};

/** Moves the dragged row over `targetId`, `fraction` of the way down its row. */
export const dragOver = async (
  board: Board,
  tree: TreeGrid,
  targetId: string,
  fraction: number,
): Promise<void> => {
  const row = await centreOf(tree.row(targetId));
  const x = row.x + row.width / 2;
  const y = row.y + row.height * fraction;
  await board.page.mouse.move(x, y, { steps: 10 });
  // The move that enters a row fires only its `dragenter`; a real browser goes on firing
  // `dragover` while the pointer rests, so one more move within the row stands for that.
  await board.page.mouse.move(x + 1, y);
};

/** Releases the mouse: the drop, wherever the pointer is. */
export const release = (board: Board): Promise<void> => board.page.mouse.up();

/** Drags `nodeId` onto `targetId` at `fraction` of its height and drops it there. */
export const dragDrop = async (
  board: Board,
  tree: TreeGrid,
  nodeId: string,
  targetId: string,
  fraction: number,
): Promise<void> => {
  await beginDrag(board, tree, nodeId);
  await dragOver(board, tree, targetId, fraction);
  await release(board);
};

/** The three zones' pointer places, as fractions of a row's height. */
export const ZONE = { before: 0.1, into: 0.5, after: 0.9 } as const;

/** Waits for the row's drop indicator to read `drop`: WebKit tells the page of the pointer a moment late. */
export const expectDrop = (tree: TreeGrid, nodeId: string, drop: string | null): Promise<void> =>
  eventually(
    async () => (await tree.row(nodeId).getAttribute("data-drop")) === drop,
    `${nodeId}'s drop indicator to read ${drop}`,
    STEP_TIMEOUT_MS,
  );
