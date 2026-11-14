// A real pointer drag of a Kanban card (latex-kanban-timeline, task 5.2), as the Ranking's
// scenarios make it (`ranking-drag.ts`): the mouse goes down on the card, moves over the target
// column, and is released by the scenario, so that it can look at the indicator in between. The
// native drag of the sandboxed frame is the one the library uses.

import type { Locator } from "playwright";
import { eventually, STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board } from "./dom.ts";

/** The card of the Kanban. */
export const cardOf = (board: Board, id: string): Locator =>
  board.view.locator(`[data-kanban-card="${id}"]`);

/** The column of the Kanban. */
export const columnOf = (board: Board, id: string): Locator =>
  board.view.locator(`[data-kanban-column="${id}"]`);

/** The IDs of the cards in a column, in the order it shows them. */
export const cardsIn = (board: Board, column: string): Promise<(string | null)[]> =>
  columnOf(board, column)
    .locator("[data-kanban-card]")
    .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-kanban-card")));

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return box;
};

/** Takes the card with the mouse and starts the drag. */
export const beginDrag = async (board: Board, card: Locator): Promise<void> => {
  const box = await boxOf(card);
  const { mouse } = board.page;
  await mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mouse.down();
  await mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 - 4, { steps: 4 });
};

/** Moves the dragged card over the middle of `column`. */
export const dragOver = async (board: Board, column: Locator): Promise<void> => {
  const box = await boxOf(column);
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 12;
  await board.page.mouse.move(x, y, { steps: 10 });
  // The move that enters a target fires only its `dragenter`; one more move within it stands for
  // the `dragover` a real browser keeps firing while the pointer rests.
  await board.page.mouse.move(x + 1, y);
};

/** Releases the mouse: the drop, wherever the pointer is. */
export const release = (board: Board): Promise<void> => board.page.mouse.up();

/** Waits for the column's drop indicator to read `drop`: WebKit tells the page of the pointer late. */
export const expectDrop = (board: Board, id: string, drop: string | null): Promise<void> =>
  eventually(
    async () => (await columnOf(board, id).getAttribute("data-drop")) === drop,
    `${id}'s drop indicator to read ${drop}`,
    STEP_TIMEOUT_MS,
  );

/**
 * Moves the dragged card over the upper or the lower part of `card`, a quarter of its height from
 * its top or its bottom: the place before it or after it (kanban-order), whose middle is the
 * boundary.
 */
export const dragOverCard = async (
  board: Board,
  card: Locator,
  part: "upper" | "lower",
): Promise<void> => {
  const box = await boxOf(card);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * (part === "upper" ? 0.25 : 0.75);
  await board.page.mouse.move(x, y, { steps: 10 });
  await board.page.mouse.move(x + 1, y);
};

/** Waits for the card's drop line to read `side` (before, after, or none). */
export const expectLine = (board: Board, id: string, side: string | null): Promise<void> =>
  eventually(
    async () => (await cardOf(board, id).getAttribute("data-drop-line")) === side,
    `${id}'s drop line to read ${side}`,
    STEP_TIMEOUT_MS,
  );

/** How many cards of the Kanban show a drop line. */
export const lineCount = (board: Board): Promise<number> =>
  board.view.locator("[data-drop-line]").count();
