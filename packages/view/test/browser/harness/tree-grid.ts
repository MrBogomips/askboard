// Where the Tree's browser tests find things in it (tree-widget design decision 6), as `dom.ts`
// does for the board: by role and name where a role fits, and these structural hooks:
//
// - the treegrid is labelled by its question's text; its header row holds `columnheader`s;
// - each node's row carries `data-node-id`, the node's ID, since the spec names nodes by ID;
// - each cell of a row, a `gridcell` in a treegrid, carries `data-cell`: 0 the name, then one per column;
// - the chevron has no role, the row's `aria-expanded` saying what it shows, and is found by
//   `data-chevron`;
// - the cell editor is the one `textbox` in the Tree.

import type { Locator } from "playwright";
import type { Board } from "./dom.ts";

export type TreeGrid = {
  readonly grid: Locator;
  readonly headers: Locator;
  /** The node rows, without the header row. */
  readonly rows: Locator;
  row(nodeId: string): Locator;
  cell(nodeId: string, cell: number): Locator;
  chevron(nodeId: string): Locator;
  readonly editor: Locator;
};

export const treeGridOf = (board: Board): TreeGrid => {
  const grid = board.view.getByRole("treegrid");
  const row = (nodeId: string) => grid.locator(`[data-node-id="${nodeId}"]`);
  return {
    grid,
    headers: grid.getByRole("columnheader"),
    rows: grid.locator("[data-node-id]"),
    row,
    cell: (nodeId, cell) => row(nodeId).locator(`[data-cell="${cell}"]`),
    chevron: (nodeId) => row(nodeId).locator("[data-chevron]"),
    editor: grid.getByRole("textbox"),
  };
};

/** Where the view's focus is in the Tree: a row, or a cell of it; `undefined` outside the Tree. */
export type FocusAt = { readonly nodeId: string; readonly cell?: number } | undefined;

export const treeFocus = async (board: Board): Promise<FocusAt> =>
  (await board.viewFrame()).evaluate(() => {
    const active = document.activeElement;
    const row = active?.closest('[role="treegrid"] [data-node-id]');
    const nodeId = row?.getAttribute("data-node-id");
    if (active === null || nodeId === null || nodeId === undefined) return undefined;
    const cell = active.closest("[data-cell]")?.getAttribute("data-cell");
    return cell === null || cell === undefined ? { nodeId } : { nodeId, cell: Number(cell) };
  });

/** The chevron's rotation in degrees, by `rotate` and `transform`: 0 points right, 90 down. */
export const chevronAngle = (chevron: Locator): Promise<number> =>
  chevron.evaluate((element) => {
    const style = getComputedStyle(element);
    const rotate = style.rotate === "none" ? 0 : Number.parseFloat(style.rotate);
    if (style.transform === "none") return Math.round(rotate);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return Math.round(rotate + (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
  });

/** The left edge, in pixels, of the first text in each row's name cell, by node ID. */
export const nameLefts = async (board: Board): Promise<Record<string, number>> =>
  (await board.viewFrame()).evaluate(() => {
    const lefts: Record<string, number> = {};
    for (const row of document.querySelectorAll('[role="treegrid"] [data-node-id]')) {
      const cell = row.querySelector('[data-cell="0"]');
      const walker = document.createTreeWalker(cell ?? row, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      if (text === null) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      lefts[row.getAttribute("data-node-id") ?? ""] = range.getBoundingClientRect().left;
    }
    return lefts;
  });

/**
 * For each cell holding text, the gap in pixels between the text's right edge and the cell's
 * content box: 0 for right-aligned text.
 */
export const rightGaps = (cells: Locator): Promise<number[]> =>
  cells.evaluateAll((elements) =>
    elements.flatMap((cell) => {
      const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      if (text === null) return [];
      const range = cell.ownerDocument.createRange();
      range.selectNodeContents(text);
      const box = cell.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(cell).paddingRight);
      return [Math.round(box.right - padding - range.getBoundingClientRect().right)];
    }),
  );
