// The keyboard steps of the UJ-2 end-to-end scenario (widget-answers, task 6.2): the Tree's focus,
// its cell editor and the toolbar, found as the view's browser tests find them (by role, with
// `data-node-id` and `data-cell` for the rows and cells) and driven by key presses only.

import { expect } from "bun:test";
import type { RealBoard } from "./real-board.ts";

/** Where the focus is in the Tree: a row, or a cell of it; `undefined` outside the Tree. */
export type FocusAt = { readonly nodeId: string; readonly cell?: number } | undefined;

const FOCUS_TIMEOUT_MS = 5_000;
const MAX_TABS = 40; // the board page has its own stops (header, cards) before the Tree

/** The Tree's focus, read in the view's frame. */
export const treeFocus = (board: RealBoard): Promise<FocusAt> =>
  board.view.locator("body").evaluate(() => {
    const active = document.activeElement;
    const nodeId = active
      ?.closest('[role="treegrid"] [data-node-id]')
      ?.getAttribute("data-node-id");
    if (active === null || nodeId === null || nodeId === undefined) return undefined;
    const cell = active.closest("[data-cell]")?.getAttribute("data-cell");
    return cell === null || cell === undefined ? { nodeId } : { nodeId, cell: Number(cell) };
  });

/** The name of the toolbar's focused tool; `undefined` when no tool has the focus. */
const toolFocus = (board: RealBoard): Promise<string | undefined> =>
  board.view
    .locator("body")
    .evaluate(
      () => document.activeElement?.closest('[role="toolbar"] button')?.textContent ?? undefined,
    );

/** Presses `key` and expects the Tree's focus where the step says. */
export const pressAt = async (board: RealBoard, key: string, at: FocusAt): Promise<void> => {
  await board.page.keyboard.press(key);
  expect({ key, at: await treeFocus(board) }).toEqual({ key, at });
};

/** Presses `key` and expects the toolbar's focus on the named tool. */
export const pressTool = async (board: RealBoard, key: string, tool: string): Promise<void> => {
  await board.page.keyboard.press(key);
  expect({ key, tool: await toolFocus(board) }).toEqual({ key, tool });
};

/** Presses Tab until `reached` holds, at most `MAX_TABS` times, with no click. */
export const tabUntil = async (
  board: RealBoard,
  reached: () => Promise<boolean>,
  what: string,
): Promise<void> => {
  for (let presses = 0; !(await reached()); presses += 1) {
    if (presses === MAX_TABS) throw new Error(`${MAX_TABS} presses of Tab never reached ${what}`);
    await board.page.keyboard.press("Tab");
  }
};

const editorOf = (board: RealBoard) => board.view.getByRole("treegrid").getByRole("textbox");

/** Opens the editor with `key` and types `text` over the cell's text, which it selects. */
export const typeIn = async (board: RealBoard, key: string, text: string): Promise<void> => {
  await board.page.keyboard.press(key);
  await editorOf(board).waitFor({ timeout: FOCUS_TIMEOUT_MS });
  await board.page.keyboard.type(text);
};

/** Edits the Tree's focused field: F2, the text over the field's, then Enter, the focus kept. */
export const enterField = async (board: RealBoard, text: string, at: FocusAt): Promise<void> => {
  await typeIn(board, "F2", text);
  await pressAt(board, "Enter", at);
  expect(await editorOf(board).count()).toBe(0);
};

/** Waits for the new node's empty editor, which the toolbar's "Add node" opens. */
export const expectNewNode = async (board: RealBoard, nodeId: string): Promise<void> => {
  const editor = editorOf(board);
  await editor.waitFor({ timeout: FOCUS_TIMEOUT_MS });
  await board.view
    .getByRole("treegrid")
    .locator(`[data-node-id="${nodeId}"] [data-cell="0"]`)
    .getByRole("textbox")
    .waitFor({ timeout: FOCUS_TIMEOUT_MS });
  expect(await editor.inputValue()).toBe("");
};
