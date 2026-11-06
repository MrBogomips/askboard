// Where the Tree's browser tests find things in it (tree-widget design decision 6), as `dom.ts`
// does for the board: by role and name where a role fits, and these structural hooks:
//
// - the treegrid is labelled by its question's text; its header row holds `columnheader`s;
// - each node's row carries `data-node-id`, the node's ID, since the spec names nodes by ID;
// - each cell of a row, a `gridcell` in a treegrid, carries `data-cell`: 0 the name, then one
//   per column;
// - the chevron has no role, the row's `aria-expanded` saying what it shows, and is found by
//   `data-chevron`;
// - the cell editor is the one `textbox` in the Tree;
// - the toolbar above the grid is the view's one `toolbar`, its tools `button`s named by their
//   labels;
// - the question before deleting a node with children replaces the tools in the toolbar row: a
//   `group` named by its message, which ends "will be deleted.";
// - the counter at the toolbar row's right is found by its text, "No changes" or "Your changes: N"
//   (in Italian "Nessuna modifica" or "Le tue modifiche: N");
// - each change mark carries `data-change`: `renamed` on a renamed name's text, `field` on a
//   changed field's cell, `added` on an added node's row and `moved` on the mark after a moved
//   node's name.

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
  readonly toolbar: Locator;
  /** The toolbar's tools, in order. */
  readonly tools: Locator;
  tool(label: string): Locator;
  /** The counter of the user's changes, at the toolbar row's right. */
  readonly counter: Locator;
  /** The treegrid's change marks of one kind, or of every kind, in document order. */
  marks(kind?: "renamed" | "field" | "added" | "moved"): Locator;
};

const COUNTER = /^(Your changes: \d+|No changes|Le tue modifiche: \d+|Nessuna modifica)$/;

export const treeGridOf = (board: Board): TreeGrid => {
  const grid = board.view.getByRole("treegrid");
  const row = (nodeId: string) => grid.locator(`[data-node-id="${nodeId}"]`);
  const toolbar = board.view.getByRole("toolbar");
  return {
    grid,
    headers: grid.getByRole("columnheader"),
    rows: grid.locator("[data-node-id]"),
    row,
    cell: (nodeId, cell) => row(nodeId).locator(`[data-cell="${cell}"]`),
    chevron: (nodeId) => row(nodeId).locator("[data-chevron]"),
    editor: grid.getByRole("textbox"),
    toolbar,
    tools: toolbar.getByRole("button"),
    tool: (label) => toolbar.getByRole("button", { name: label, exact: true }),
    counter: board.view.locator("p").filter({ hasText: COUNTER }),
    marks: (kind) => grid.locator(kind === undefined ? "[data-change]" : `[data-change="${kind}"]`),
  };
};

/** The computed paint of an element: its fill, its text, its border and its shadows. */
export const paintOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      border: style.borderTopColor,
      shadow: style.boxShadow,
    };
  });

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

/**
 * Tabs into the Tree from its question's text, as a keyboard user does: a click on the text sets
 * where Tab starts, then Tab is pressed until the focus is in the treegrid, at most five times.
 */
export const tabIntoTree = async (board: Board, questionText: string): Promise<FocusAt> => {
  await board.view.getByRole("heading", { name: questionText }).click();
  for (let presses = 0; presses < 5; presses += 1) {
    await board.page.keyboard.press("Tab");
    const at = await treeFocus(board);
    if (at !== undefined) return at;
  }
  throw new Error("five presses of Tab never reached the Tree");
};

/** Presses `key` and returns where the focus is in the Tree then. */
export const pressIn = async (board: Board, key: string): Promise<FocusAt> => {
  await board.page.keyboard.press(key);
  return treeFocus(board);
};

/** The treegrid's Tab stop, which keeps the tree's focus while the DOM focus is elsewhere. */
export const treeStop = (tree: TreeGrid): Promise<FocusAt> =>
  tree.grid.locator('[tabindex="0"]').evaluate((stop) => {
    const nodeId = stop.closest("[data-node-id]")?.getAttribute("data-node-id") ?? "";
    const cell = stop.getAttribute("data-cell");
    return cell === null ? { nodeId } : { nodeId, cell: Number(cell) };
  });

type KeyRecord = { askboardKeys?: string[] };

/**
 * Records each key press the view's window receives once its handlers ran, as "Alt+Shift+ArrowUp
 * prevented": whether the Tree kept the browser from acting on it, which a headless page cannot
 * show by navigating.
 */
export const recordKeys = async (board: Board): Promise<void> =>
  (await board.viewFrame()).evaluate(() => {
    const keys: string[] = [];
    (window as KeyRecord).askboardKeys = keys;
    window.addEventListener("keydown", (event) => {
      const held = `${event.altKey ? "Alt+" : ""}${event.shiftKey ? "Shift+" : ""}`;
      keys.push(`${held}${event.key}${event.defaultPrevented ? " prevented" : ""}`);
    });
  });

/** The key presses `recordKeys` recorded, in order. */
export const recordedKeys = async (board: Board): Promise<string[]> =>
  (await board.viewFrame()).evaluate(() => [...((window as KeyRecord).askboardKeys ?? [])]);

/** The question asked before deleting a node with children: `message`, or any such question. */
export const deleteQuestion = (board: Board, message?: string | RegExp): Locator =>
  board.view.getByRole("group", { name: message ?? /will be deleted\.$/, exact: true });

/** The name of the toolbar's focused tool; `undefined` when no tool has the view's focus. */
export const toolFocus = async (board: Board): Promise<string | undefined> =>
  (await board.viewFrame()).evaluate(
    () => document.activeElement?.closest('[role="toolbar"] button')?.textContent ?? undefined,
  );

/** Tabs into the Tree's toolbar from its question's text, as `tabIntoTree` does into the tree. */
export const tabIntoToolbar = async (board: Board, questionText: string): Promise<string> => {
  await board.view.getByRole("heading", { name: questionText }).click();
  for (let presses = 0; presses < 5; presses += 1) {
    await board.page.keyboard.press("Tab");
    const tool = await toolFocus(board);
    if (tool !== undefined) return tool;
  }
  throw new Error("five presses of Tab never reached the Tree's toolbar");
};

/** Presses `key` and returns the toolbar's focused tool then. */
export const pressTool = async (board: Board, key: string): Promise<string | undefined> => {
  await board.page.keyboard.press(key);
  return toolFocus(board);
};

/** How many of the toolbar's tools are in the Tab order: its one Tab stop. */
export const toolStops = (toolbar: Locator): Promise<number> =>
  toolbar.locator('button:not([tabindex="-1"])').count();

/** The names of the toolbar's enabled tools, in order. */
export const enabledTools = async (tools: Locator): Promise<string[]> => {
  const enabled: string[] = [];
  for (const tool of await tools.all()) {
    if (await tool.isEnabled()) enabled.push((await tool.textContent()) ?? "");
  }
  return enabled;
};

/** How many elements of the treegrid are in the Tab order: its one Tab stop. */
export const tabStops = (grid: Locator): Promise<number> =>
  grid.locator('[tabindex]:not([tabindex="-1"])').count();

/** The outline of the view's focused element, as computed: the focus ring. */
export const focusRing = async (board: Board) =>
  (await board.viewFrame()).evaluate(() => {
    const style = getComputedStyle(document.activeElement ?? document.body);
    return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset };
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
