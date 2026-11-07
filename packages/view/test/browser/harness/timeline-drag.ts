// A real pointer drag of a Timeline entry (latex-kanban-timeline, task 5.3): the mouse goes down on
// the entry's shape, moves by a travel in pixels, and is released by the scenario, so that it can
// look at the preview in between. The entries take no drag library: it is the pointer events of
// the page, which Playwright's mouse makes as a user's.

import type { Locator } from "playwright";
import type { Board } from "./dom.ts";

/** Pixels per day at each zoom: the Gantt's scale, which the Timeline shares. */
export const PER_DAY = { day: 32, week: 15, month: 4 } as const;

/** The entry of the Timeline, and its shape. */
export const entryOf = (board: Board, id: string): Locator =>
  board.view.locator(`[data-timeline-entry="${id}"]`);
export const shapeOf = (board: Board, id: string): Locator =>
  entryOf(board, id).locator("[data-timeline-shape]");

/** The chart's zoom: day, week or month. */
export const zoomOf = async (board: Board): Promise<keyof typeof PER_DAY> =>
  (await board.view.locator("[data-timeline-chart]").getAttribute("data-zoom")) as never;

export const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return box;
};

/**
 * The vertical middle of a lane's band, in page pixels, from its label in the fixed column. The
 * label is measured in its own frame and placed by its frame's box: WebKit gives the box of an SVG
 * text holding a title the same place for every label.
 */
export const laneMiddle = async (board: Board, lane: string): Promise<number> => {
  const frame = await board.viewFrame();
  const outer = await (await frame.frameElement()).boundingBox();
  if (outer === null) throw new Error("the view's frame has no box");
  const inner = await board.view
    .locator(`[data-timeline-lane-label="${lane}"]`)
    .evaluate((node) => {
      const { y, height } = node.getBoundingClientRect();
      return { y, height };
    });
  return outer.y + inner.y + inner.height / 2;
};

/** Takes the entry's shape with the mouse and moves it by `dx` pixels, and to `y` when given. */
export const dragEntry = async (
  board: Board,
  id: string,
  travel: { readonly dx: number; readonly y?: number },
): Promise<void> => {
  const box = await boxOf(shapeOf(board, id));
  const { mouse } = board.page;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await mouse.move(from.x, from.y);
  await mouse.down();
  await mouse.move(from.x + travel.dx, travel.y ?? from.y, { steps: 8 });
};

/** Releases the mouse: the drop, wherever the pointer is. */
export const release = (board: Board): Promise<void> => board.page.mouse.up();
