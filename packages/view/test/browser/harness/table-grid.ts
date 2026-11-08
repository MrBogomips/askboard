// Where the Table's browser scenarios find things in the Table (table-widget, group 6): its frame,
// its cells by row and field, the toolbar's tools and counter, the editor, and the steps that open
// a cell's editor and type into it. Not a test file.

import type { Locator } from "playwright";
import { eventually, STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board } from "./dom.ts";

export type TableGrid = {
  readonly frame: Locator;
  readonly grid: Locator;
  readonly rows: Locator;
  readonly tools: Locator;
  readonly counter: Locator;
};

/** The Table `id` on the board. */
export const tableGridOf = (board: Board, id = "costs"): TableGrid => {
  const frame = board.view.locator(`[data-askboard-item="${id}"]`);
  return {
    frame,
    grid: frame.getByRole("grid"),
    rows: frame.locator("tbody > tr[data-row-id]"),
    tools: frame.locator("[data-table-tools]"),
    counter: frame.locator("[data-counter]"),
  };
};

/** The cell of the row `rowId` under the column `field`. */
export const cellOf = (table: TableGrid, rowId: string, field: string): Locator =>
  table.frame.locator(`td[data-table-cell][data-row="${rowId}"][data-field="${field}"]`);

/** The text a cell shows, trimmed. */
export const cellText = async (table: TableGrid, rowId: string, field: string): Promise<string> =>
  ((await cellOf(table, rowId, field).textContent()) ?? "").trim();

/** The text of the Total row's cell under `field`. */
export const totalText = async (table: TableGrid, field: string): Promise<string> =>
  ((await table.frame.locator(`td[data-total="${field}"]`).textContent()) ?? "").trim();

/** The counter's text. */
export const counterText = async (table: TableGrid): Promise<string> =>
  ((await table.counter.textContent()) ?? "").trim();

/** The editor open on a cell, named by its column and row's place. */
export const editorOf = (table: TableGrid, name: string): Locator =>
  table.frame.getByRole("textbox", { name, exact: true });

/** The tool `name` of the toolbar. */
export const toolOf = (table: TableGrid, name: string): Locator =>
  table.frame.getByRole("button", { name, exact: true });

/** The text the editor of a cell echoes. */
export const echoOf = (table: TableGrid): Locator => table.frame.locator("[data-echo]");

/** Focuses the cell, opens its editor with Enter and returns the editor. */
export const openEditor = async (
  board: Board,
  table: TableGrid,
  rowId: string,
  field: string,
  name: string,
): Promise<Locator> => {
  await cellOf(table, rowId, field).click({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.press("Enter");
  const editor = editorOf(table, name);
  await editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await eventually(
    async () => await editor.evaluate((el) => el === el.ownerDocument.activeElement),
    "the editor to take the focus",
  );
  return editor;
};

/** Opens the cell's editor, replaces its text with `text` and presses Enter. */
export const typeInCell = async (
  board: Board,
  table: TableGrid,
  rowId: string,
  field: string,
  name: string,
  text: string,
): Promise<void> => {
  const editor = await openEditor(board, table, rowId, field, name);
  await editor.fill(text);
  await board.page.keyboard.press("Enter");
};

/** The number of tab stops (tabindex 0) the grid holds. */
export const gridStops = (table: TableGrid): Promise<number> =>
  table.grid.locator("[tabindex='0']").count();
