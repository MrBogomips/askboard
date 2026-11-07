// A real pointer drag of a Ranking row's handle (approval-scale-ranking, task 5.3), as the Tree's
// scenarios make it (`tree-drag.ts`): the mouse goes down on the handle, moves over the target row
// to a fraction of its height, and is released by the scenario, so that it can look at the
// indicator in between. The native drag of the sandboxed frame is the one the library uses.

import type { Locator } from "playwright";
import { eventually, STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board } from "./dom.ts";

/** The row of an element. */
export const rowOf = (board: Board, id: string): Locator =>
  board.view.locator(`[data-ranking-row="${id}"]`);

/** The IDs of the rows, in the order the list shows them. */
export const orderShown = (board: Board): Promise<(string | null)[]> =>
  board.view
    .locator("[data-ranking-row]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ranking-row")));

/** The row's drag handle, whose accessible name is "Drag <label>". */
export const handleOf = (board: Board, id: string): Locator =>
  rowOf(board, id).locator("[data-drag-handle]");

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return box;
};

/** Takes the handle with the mouse and starts the drag. */
export const beginDrag = async (board: Board, handle: Locator): Promise<void> => {
  const box = await boxOf(handle);
  const { mouse } = board.page;
  await mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mouse.down();
  await mouse.move(box.x + box.width / 2 + 12, box.y - 4, { steps: 4 });
};

/** Moves the dragged row over `target`, `fraction` of the way down it. */
export const dragOver = async (board: Board, target: Locator, fraction: number): Promise<void> => {
  const box = await boxOf(target);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * fraction;
  await board.page.mouse.move(x, y, { steps: 10 });
  // The move that enters a row fires only its `dragenter`; one more move within it stands for the
  // `dragover` a real browser keeps firing while the pointer rests.
  await board.page.mouse.move(x + 1, y);
};

/** Releases the mouse: the drop, wherever the pointer is. */
export const release = (board: Board): Promise<void> => board.page.mouse.up();

/** Waits for the row's drop line to read `drop`: WebKit tells the page of the pointer a moment late. */
export const expectDrop = (board: Board, id: string, drop: string | null): Promise<void> =>
  eventually(
    async () => (await rowOf(board, id).getAttribute("data-drop")) === drop,
    `${id}'s drop line to read ${drop}`,
    STEP_TIMEOUT_MS,
  );

/** The pointer's places on a row: its top half, and its bottom half. */
export const HALF = { top: 0.2, bottom: 0.8 } as const;
