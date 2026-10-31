// What the Tree's browser scenarios share (tree-widget design decisions 6 and 9): the fixture
// Tree's rows and the toolbar's tools as the spec lays them out, and the steps the scenarios take
// on the widget host and what they expect after each, as `tree-grid.ts` finds things in the Tree.

import { expect } from "bun:test";
import { plan } from "../fixtures/tree-documents.ts";
import { eventually, isFocused, LOAD_TIMEOUT_MS, QUIET_MS, STEP_TIMEOUT_MS } from "./board-test.ts";
import {
  type FocusAt,
  pressIn,
  pressTool,
  type TreeGrid,
  tabIntoTree,
  tabStops,
  toolStops,
} from "./tree-grid.ts";
import type { WidgetHostRun } from "./widget-host-test.ts";

// The fixture Tree's rows as the spec lays them out: level, place among siblings, and whether the
// row is an open parent.
export const FIXTURE_ROWS = [
  { id: "design", level: "1", posinset: "1", setsize: "2", expanded: "true" },
  { id: "ux", level: "2", posinset: "1", setsize: "3", expanded: null },
  { id: "architecture", level: "2", posinset: "2", setsize: "3", expanded: null },
  { id: "prototype", level: "2", posinset: "3", setsize: "3", expanded: null },
  { id: "build", level: "1", posinset: "2", setsize: "2", expanded: "true" },
  { id: "portal", level: "2", posinset: "1", setsize: "3", expanded: null },
  { id: "billing", level: "2", posinset: "2", setsize: "3", expanded: null },
  { id: "reporting", level: "2", posinset: "3", setsize: "3", expanded: null },
];

export const FIXTURE_IDS = FIXTURE_ROWS.map((row) => row.id);

/** DESIGN.md's focus ring: a 2px outline, offset by 1px. */
export const RING = { style: "solid", width: "2px", offset: "1px" };

/** The toolbar's tools in order, with their keys (design decision 6; proposal, open question 9). */
export const TOOLS = [
  ["Add node", null],
  ["Add child", null],
  ["Move up", "Alt+Shift+ArrowUp"],
  ["Move down", "Alt+Shift+ArrowDown"],
  ["Indent", "Alt+Shift+ArrowRight"],
  ["Outdent", "Alt+Shift+ArrowLeft"],
  ["Delete", "Delete Backspace"],
] as const;

export const TOOL_LABELS = TOOLS.map(([label]) => label);

/** Waits for the question's first view message, which must be its `ready`. */
export const readyIn = async (run: WidgetHostRun): Promise<void> => {
  await eventually(() => run.messages.length > 0, "the question's ready message", LOAD_TIMEOUT_MS);
  expect(run.messages[0]).toEqual({ type: "ready", itemId: plan.id });
};

/** Nothing has changed: "Answer" is disabled and no view message but `ready` left the view. */
export const expectUnchanged = async (run: WidgetHostRun): Promise<void> => {
  expect(await run.board.answer.isDisabled()).toBe(true);
  await Bun.sleep(QUIET_MS);
  expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
};

/** The IDs of the rows the Tree shows, in order. */
export const shownIds = (tree: TreeGrid): Promise<(string | null)[]> =>
  tree.rows.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-node-id")));

/** Presses each key in turn, expecting the focus where the step says, with one Tab stop. */
export const expectSteps = async (
  run: WidgetHostRun,
  tree: TreeGrid,
  steps: readonly (readonly [string, FocusAt])[],
): Promise<void> => {
  for (const [key, at] of steps) {
    expect({ key, at: await pressIn(run.board, key) }).toEqual({ key, at });
    expect(await tabStops(tree.grid)).toBe(1);
  }
};

/** Tabs into the fixture Tree and moves the focus down to `portal`, the first child of `build`. */
export const focusPortal = async (run: WidgetHostRun, tree: TreeGrid): Promise<void> => {
  expect(await tabIntoTree(run.board, plan.props.text)).toEqual({ nodeId: "design" });
  await expectSteps(
    run,
    tree,
    ["ux", "architecture", "prototype", "build", "portal"].map(
      (nodeId) => ["ArrowDown", { nodeId }] as const,
    ),
  );
};

/** Opens the editor with `key` and types `text` over the cell's text, which it selects. */
export const typeIn = async (run: WidgetHostRun, tree: TreeGrid, key: string, text: string) => {
  await run.board.page.keyboard.press(key);
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(await isFocused(tree.editor)).toBe(true);
  await run.board.page.keyboard.type(text);
};

/** Presses each key in turn in the toolbar, expecting the focus on the step's tool, with one Tab stop. */
export const expectToolSteps = async (
  run: WidgetHostRun,
  tree: TreeGrid,
  steps: readonly (readonly [string, string])[],
): Promise<void> => {
  for (const [key, tool] of steps) {
    expect({ key, tool: await pressTool(run.board, key) }).toEqual({ key, tool });
    expect(await toolStops(tree.toolbar)).toBe(1);
  }
};

/** A row's level, place among its siblings and set size, as its ARIA attributes say. */
export const placeOf = (tree: TreeGrid, nodeId: string): Promise<(string | null)[]> =>
  tree
    .row(nodeId)
    .evaluate((row) =>
      ["aria-level", "aria-posinset", "aria-setsize"].map((name) => row.getAttribute(name)),
    );

/** The new node's editor shows in the row `nodeId`, its name empty and focused. */
export const expectNewNode = async (tree: TreeGrid, nodeId: string): Promise<void> => {
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(await tree.cell(nodeId, 0).getByRole("textbox").count()).toBe(1);
  expect(await tree.editor.inputValue()).toBe("");
  expect(await isFocused(tree.editor)).toBe(true);
};

/** Every row's ID, level, place, set size and expansion, in order: what a move would change. */
export const allPlaces = (tree: TreeGrid): Promise<string[]> =>
  tree.rows.evaluateAll((rows) =>
    rows.map((row) =>
      ["data-node-id", "aria-level", "aria-posinset", "aria-setsize", "aria-expanded"]
        .map((name) => row.getAttribute(name))
        .join(" "),
    ),
  );

/** The host page's URL and history length, which no key of the Tree may change. */
export const pageOf = async (run: WidgetHostRun) => ({
  url: run.board.page.url(),
  history: await run.board.page.evaluate(() => window.history.length),
});
