// What the Approval's end-to-end tests share (approval-scale-ranking, tasks 6.1 and 6.7): the
// decisions, the open prompt and the Tree's cells of a question on the board page, as a user finds
// them. Not a test file.

import { expect } from "bun:test";
import { SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import type { Locator } from "playwright";
import { STEP_TIMEOUT_MS } from "./board-test.ts";
import type { Board } from "./dom.ts";
import { card } from "./lifecycle-test.ts";
import { pressIn, treeGridOf } from "./tree-grid.ts";

export const OPEN_NOTE = "Note for the agent (optional)";
export const REASON = "Reason for the changes (required)";
export const REASON_MISSING = "Add the reason for your changes.";

/** A decision of a question's Approval, by its name. */
export const decisionOf = (board: Board, questionId: string, name: string): Locator =>
  card(board, questionId).getByRole("radio", { name, exact: true });

/** A question's open prompt, by its label. */
export const promptOf = (board: Board, questionId: string, label: string): Locator =>
  card(board, questionId).getByRole("textbox", { name: label, exact: true });

/** Whether a decision shows pressed. */
export const isPressed = async (locator: Locator): Promise<boolean> =>
  (await locator.getAttribute("aria-checked")) === "true";

/** Renames a Tree node by its name cell: a click, F2, the new name over the old, Enter. */
export const renameNode = async (board: Board, nodeId: string, name: string): Promise<void> => {
  const tree = treeGridOf(board);
  await tree.cell(nodeId, 0).click({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.press("F2");
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(name);
  await pressIn(board, "Enter");
};

type Event = Readonly<Record<string, unknown>>;

/** What a result's problems are: none when it passes its schema, else the schema's report. */
const problemsOf = (id: string, json: unknown): readonly unknown[] => {
  const checked = validateAgainst(id, json);
  return checked.ok ? [] : checked.problems;
};

/**
 * The events of the ask's entry in a `collect` result, once the whole result has passed the
 * collect result's schema (the output format validates `results`).
 */
export const checkedEvents = (json: unknown): readonly Event[] => {
  expect(problemsOf(SCHEMA_IDS.collectResult, json)).toEqual([]);
  const [entry] = (json as { asks: { events: Event[] }[] }).asks;
  return entry?.events ?? [];
};

/** The `item` of a `fetch` result, once the whole result has passed the fetch result's schema. */
export const checkedFetchItem = (json: unknown): Event => {
  expect(problemsOf(SCHEMA_IDS.fetchResult, json)).toEqual([]);
  return (json as { item: Event }).item;
};
