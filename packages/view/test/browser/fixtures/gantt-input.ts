// The Gantt's browser scenarios' input helpers (gantt-widget design decisions 9 and 12): where the
// keyboard's focus is and how the keys reach a cell, the pointer's presses and drags on the
// chart, the lock a scenario posts as the board page's bridge would, and a drop's timer in the
// view. The Gantt's parts are found as `gantt-view.ts` finds them.

import { questionsOf, type ViewDocument } from "../../../src/view-document.ts";
import type { Board } from "../harness/dom.ts";
import { type GanttParts, RELEASE_TASKS } from "./gantt-view.ts";

/**
 * The task and column of the view's focused grid cell; undefined when focus is elsewhere, the
 * view's document included once it has lost the focus, where Firefox keeps its active element.
 */
export const focusedCell = async (board: Board) => {
  const view = await board.viewFrame();
  return view.evaluate(() => {
    if (!document.hasFocus()) return undefined;
    const active = document.activeElement;
    const cell = active?.closest("[data-gantt-column]");
    if (active === null || cell === null || cell === undefined || cell !== active) return undefined;
    const task = cell.closest("[data-gantt-row]")?.getAttribute("data-gantt-row") ?? "";
    return `${task}.${cell.getAttribute("data-gantt-column")}`;
  });
};

/** The item whose part holds the view's focus; undefined when focus is elsewhere. */
export const focusedItem = async (board: Board) => {
  const view = await board.viewFrame();
  return view.evaluate(() =>
    document.hasFocus()
      ? (document.activeElement
          ?.closest("[data-askboard-item]")
          ?.getAttribute("data-askboard-item") ?? undefined)
      : undefined,
  );
};

/** The focused element's outline, as the focus ring draws it. */
export const focusRing = async (board: Board) => {
  const view = await board.viewFrame();
  return view.evaluate(() => {
    const style = getComputedStyle(document.activeElement ?? document.body);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
};

/** How many elements of the Gantt the Tab key can reach. */
export const tabStops = (gantt: GanttParts): Promise<number> =>
  gantt.root.evaluate(
    (root) =>
      [...root.querySelectorAll<HTMLElement>("*")].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !(element as HTMLButtonElement).disabled &&
          (element.matches("a[href],button,input,select,textarea,[tabindex]") ||
            element.isContentEditable),
      ).length,
  );

/**
 * Presses Tab until a grid cell of the Gantt holds the focus, at most ten times; or Shift+Tab when
 * the view already holds the focus, after the grid, as the chart's region after a drag or "Answer"
 * after a click: WebKit loses the focus for good once Tab leaves the view's last stop.
 */
export const tabIntoGrid = async (board: Board): Promise<string> => {
  const view = await board.viewFrame();
  const key = (await view.evaluate(() => document.hasFocus())) ? "Shift+Tab" : "Tab";
  for (let presses = 0; presses < 10; presses += 1) {
    await board.page.keyboard.press(key);
    const cell = await focusedCell(board);
    if (cell !== undefined) return cell;
  }
  throw new Error(`ten presses of ${key} never reached the Gantt's grid`);
};

/** The page's and the view's URL, history length and scroll, which the grid's keys never move. */
export const pageState = async (board: Board) => {
  const view = await board.viewFrame();
  const page = await board.page.evaluate(() => ({
    url: location.href,
    history: history.length,
    scroll: [scrollX, scrollY],
  }));
  const inView = await view.evaluate(() => ({
    url: location.href,
    history: history.length,
    scroll: [scrollX, scrollY],
  }));
  return { page, view: inView };
};

const COLUMNS = ["task", "start", "duration", "dependencies"];

/**
 * Moves the grid's focus to a cell with the keyboard only: into the grid with Tab if the focus is
 * elsewhere, to the first cell with Home and the up arrow, then down and right to the cell.
 */
export const keysTo = async (
  board: Board,
  task: string,
  column: string,
  tasks: readonly { readonly id: string }[] = RELEASE_TASKS,
): Promise<void> => {
  const row = tasks.findIndex((candidate) => candidate.id === task);
  const right = COLUMNS.indexOf(column);
  if (row < 0 || right < 0) throw new Error(`no cell ${task}.${column} in the scenario's Gantt`);
  if ((await focusedCell(board)) === undefined) await tabIntoGrid(board);
  const presses = [
    "Home",
    ...Array.from({ length: tasks.length }, () => "ArrowUp"),
    ...Array.from({ length: row }, () => "ArrowDown"),
    ...Array.from({ length: right }, () => "ArrowRight"),
  ];
  for (const key of presses) await board.page.keyboard.press(key);
  const reached = await focusedCell(board);
  if (reached !== `${task}.${column}`)
    throw new Error(`the keys reached ${reached}, not ${task}.${column}`);
};

/** Whether the view's focused element is the editor in a cell. */
export const editorFocused = async (board: Board, task: string, column: string) => {
  const view = await board.viewFrame();
  return view.evaluate(
    ([taskId, columnName]) => {
      const active = document.activeElement;
      return (
        document.hasFocus() &&
        active?.tagName === "INPUT" &&
        active.closest(`[data-gantt-row="${taskId}"] > [data-gantt-column="${columnName}"]`) !==
          null
      );
    },
    [task, column] as const,
  );
};

/** The name of the view's focused checkbox, by its label; undefined for anything else. */
export const focusedBox = async (board: Board) => {
  const view = await board.viewFrame();
  return view.evaluate(() => {
    const active = document.activeElement;
    if (!document.hasFocus() || active?.getAttribute("role") !== "checkbox") return undefined;
    const label = document.querySelector(`label[for="${CSS.escape(active.id)}"]`);
    return (label?.textContent ?? "").trim();
  });
};

/** A point on the page, as Playwright's mouse takes it. */
type Point = { readonly x: number; readonly y: number };

/**
 * Where the pointer grabs a bar to move it: 4px in from its start, at its middle. The bar is
 * scrolled to the middle of the view first: on a short window the sticky bottom bar, which a
 * single-question board now shows for "Snapshot", covers the lowest bars.
 */
export const grabPoint = async (gantt: GanttParts, task: string): Promise<Point> => {
  const bar = gantt.bar(task);
  await bar.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  const box = await bar.boundingBox();
  if (box === null) throw new Error(`the bar of ${task} is not shown`);
  return { x: box.x + 4, y: box.y + box.height / 2 };
};

/** Where the pointer grabs a bar's end to resize it: the middle of its resize handle. */
export const endPoint = async (gantt: GanttParts, task: string): Promise<Point> => {
  const box = await gantt.root.locator(`[data-gantt-handle="${task}"]`).boundingBox();
  if (box === null) throw new Error(`the bar of ${task} has no resize handle`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Presses the mouse at a point and moves it sideways by `dx` pixels, in steps, still pressed. */
export const pressAndMove = async (board: Board, from: Point, dx: number): Promise<void> => {
  await board.page.mouse.move(from.x, from.y);
  await board.page.mouse.down();
  await board.page.mouse.move(from.x + dx, from.y, { steps: 6 });
};

/** A whole drag: press, move sideways by `dx` pixels, release. */
export const dragBy = async (board: Board, from: Point, dx: number): Promise<void> => {
  await pressAndMove(board, from, dx);
  await board.page.mouse.up();
};

/** The guide's day and x while a bar is dragged; undefined while none shows. */
export const guideFacts = async (gantt: GanttParts) => {
  const guide = gantt.root.locator("[data-gantt-guide]");
  if ((await guide.count()) === 0) return undefined;
  return {
    date: await guide.getAttribute("data-date"),
    x: Math.floor(Number(await guide.getAttribute("x1"))),
    stroke: await guide.evaluate((line) => getComputedStyle(line).stroke),
  };
};

/**
 * The host page tells the view the board is locked, as the board page does when the board moved
 * (AD-21): the widget host sends one open state, so the scenario posts the next update itself, as
 * the board page's bridge would, from the view's parent window.
 */
export const sendLock = async (board: Board, document: ViewDocument): Promise<void> => {
  const [question] = questionsOf(document);
  if (question === undefined) throw new Error("the document holds no question");
  const state = {
    ask: "waiting",
    questions: [{ itemId: question.id, rev: question.rev, state: "open" }],
  };
  await board.page.evaluate(
    (update) => {
      const frame = window.document.querySelector("iframe");
      frame?.contentWindow?.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { content: [], structuredContent: update },
        },
        "*",
      );
    },
    { type: "state", state, lock: "moved" },
  );
};

/**
 * Times, in the view, a drop from the pointer coming up to a task's bar changing its start or its
 * finish: what the commit, the graph's rebuild and the render take together. Arm it before the
 * drop; it resolves once the bar changed.
 */
export const armDropTimer = async (board: Board, task: string): Promise<() => Promise<number>> => {
  const view = await board.viewFrame();
  // Kept on the view's window: Playwright would wait on a promise the evaluation returned.
  type Timed = { ganttDropTimer?: Promise<number> };
  await view.evaluate((watched) => {
    let from = 0;
    document.addEventListener(
      "pointerup",
      () => {
        from = performance.now();
      },
      { capture: true, once: true },
    );
    const bar = document.querySelector(`[data-gantt-bar="${watched}"]`);
    if (bar === null) throw new Error(`no bar of ${watched}`);
    (globalThis as Timed).ganttDropTimer = new Promise<number>((resolve) => {
      new MutationObserver((_, observer) => {
        observer.disconnect();
        resolve(performance.now() - from);
      }).observe(bar, { attributes: true, attributeFilter: ["data-start", "data-finish"] });
    });
  }, task);
  return () => view.evaluate(() => (globalThis as Timed).ganttDropTimer ?? Promise.resolve(-1));
};
