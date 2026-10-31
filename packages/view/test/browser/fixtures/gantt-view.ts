// What the Gantt's browser scenarios share (gantt-widget design decisions 9 and 12): board
// documents built from the fixture Gantt, DESIGN.md's colours as a computed style reads them, the
// day arithmetic the scenarios check the chart's geometry with, and where a scenario finds the
// Gantt's parts. Test code: it may use `Date`, which the Gantt itself never does.
//
// The Gantt's structural hooks, where no role fits: the item's frame carries
// `data-askboard-item`; each grid row `data-gantt-row="<task>"`, each of its cells
// `data-gantt-column="<column>"`; each bar `data-gantt-bar="<task>"` with `data-start`,
// `data-finish` and `data-critical`; each arrow `data-gantt-arrow` with `data-from` and `data-to`;
// each axis label `data-gantt-tick`; the change outline `data-gantt-change="<task>"`; the guide
// `data-gantt-guide`; a field error under a row `data-gantt-note="<task>"`.

import { join } from "node:path";
import type { GanttOwnTask } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import { questionsOf, type ViewDocument } from "../../../src/view-document.ts";
import type { Board } from "../harness/dom.ts";

const [schedule] = ganttBoardDocument.items;
const [release] = schedule.props.items;

/** The fixture Gantt's question and item IDs, and its tasks as sent. */
export const QUESTION_ID = schedule.id;
export const GANTT_ID = release.id;
export const RELEASE_TASKS = release.props.tasks as readonly GanttOwnTask[];

/** The fixture board document with other tasks in the Gantt. */
export const withTasks = (tasks: readonly GanttOwnTask[]): ViewDocument => ({
  ...ganttBoardDocument,
  items: [
    {
      ...schedule,
      props: { ...schedule.props, items: [{ ...release, props: { ...release.props, tasks } }] },
    },
  ],
});

/** The fixture board document with a second Gantt after the first, its tasks the same. */
export const withSecondGantt = (secondId: string): ViewDocument => ({
  ...ganttBoardDocument,
  items: [
    {
      ...schedule,
      props: { ...schedule.props, items: [release, { ...release, id: secondId }] },
    },
  ],
});

// DESIGN.md's colours, as `getComputedStyle` gives them.
const design = await Bun.file(
  join(import.meta.dir, "../../../../../docs/ux-askboard-2026-10-27/DESIGN.md"),
).text();
const colors = (
  Bun.YAML.parse(/^---\n([\s\S]*?)\n---$/m.exec(design)?.[1] ?? "") as {
    colors: Record<string, string>;
  }
).colors;
const rgb = (hex = "") =>
  `rgb(${(hex.slice(1).match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)).join(", ")})`;

/** A colour token in a scheme, as DESIGN.md's palette gives it (an alias resolved). */
export const colour = (name: string, scheme: "light" | "dark" = "light"): string =>
  rgb(colors[scheme === "dark" ? `${name}-dark` : name]);

const DAY_MS = 86_400_000;
const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Calendar days from one `full-date` to another. */
export const daysFrom = (from: string, to: string): number => (utc(to) - utc(from)) / DAY_MS;

/** The grid's form of a `full-date`, as in 12/9/2026. */
export const gridDay = (date: string): string => {
  const [year, month, day] = date.split("-").map(Number);
  return `${month}/${day}/${year}`;
};

/** Where a scenario finds the Gantt's parts, in the view of a board. */
export const ganttOf = (board: Board, itemId: string = GANTT_ID) => {
  const root = board.view.locator(`[data-askboard-item="${itemId}"]`);
  const row = (task: string): Locator => root.locator(`[data-gantt-row="${task}"]`);
  return {
    root,
    grid: root.getByRole("grid"),
    chart: root.getByRole("img", { name: "Gantt chart, week zoom" }),
    row,
    cell: (task: string, column: string): Locator =>
      row(task).locator(`[data-gantt-column="${column}"]`),
    bar: (task: string): Locator => root.locator(`[data-gantt-bar="${task}"]`),
    bars: root.locator("[data-gantt-bar]"),
    arrows: root.locator("[data-gantt-arrow]"),
    ticks: root.locator("[data-gantt-tick]"),
    note: (task: string): Locator => root.locator(`[data-gantt-note="${task}"]`),
  };
};

export type GanttParts = ReturnType<typeof ganttOf>;

/** What a scenario reads of a bar: its task, its dates, its flag and its geometry. */
export type BarFacts = {
  readonly task: string;
  readonly start: string;
  readonly finish: string;
  readonly critical: boolean;
  readonly x: number;
  readonly width: number;
  readonly fill: string;
};

/** Every bar's facts, in the chart's order. */
export const barFacts = (gantt: GanttParts): Promise<BarFacts[]> =>
  gantt.bars.evaluateAll((bars) =>
    bars.map((bar) => ({
      task: bar.getAttribute("data-gantt-bar") ?? "",
      start: bar.getAttribute("data-start") ?? "",
      finish: bar.getAttribute("data-finish") ?? "",
      critical: bar.getAttribute("data-critical") === "true",
      x: Number(bar.getAttribute("x")),
      width: Number(bar.getAttribute("width")),
      fill: getComputedStyle(bar).fill,
    })),
  );

/** Every arrow's ends, stroke and width, in the chart's order. */
export const arrowFacts = (gantt: GanttParts) =>
  gantt.arrows.evaluateAll((arrows) =>
    arrows.map((arrow) => ({
      link: `${arrow.getAttribute("data-from")}>${arrow.getAttribute("data-to")}`,
      critical: arrow.getAttribute("data-critical") === "true",
      stroke: getComputedStyle(arrow).stroke,
      width: getComputedStyle(arrow).strokeWidth,
      marker: arrow.getAttribute("marker-end") ?? "",
    })),
  );

/** Each body row's cells' texts, by task, in the grid's order. */
export const rowTexts = (gantt: GanttParts) =>
  gantt.grid
    .locator("[data-gantt-row]")
    .evaluateAll((rows) =>
      rows.map((row) => [
        row.getAttribute("data-gantt-row") ?? "",
        ...[...row.querySelectorAll("[data-gantt-column]")].map((cell) =>
          (cell.textContent ?? "").trim(),
        ),
      ]),
    );

/** The chart's top and each grid row's top and height, in pixels from the grid's top. */
export const rowLines = (gantt: GanttParts) =>
  gantt.root.evaluate((root) => {
    const grid = root.querySelector('[role="grid"]');
    const chart = root.querySelector("svg");
    if (grid === null || chart === null) return undefined;
    const top = grid.getBoundingClientRect().top;
    return {
      chart: Math.round(chart.getBoundingClientRect().top - top),
      rows: [...grid.querySelectorAll("[data-gantt-row]")].map((row) => {
        const box = row.getBoundingClientRect();
        return [Math.round(box.top - top), Math.round(box.height)];
      }),
    };
  });

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

/** The tasks whose bars are drawn on the critical path, in the chart's order. */
export const criticalTasks = async (gantt: GanttParts): Promise<string[]> =>
  (await barFacts(gantt)).filter((bar) => bar.critical).map((bar) => bar.task);

/** Each bar's start and finish, by task. */
export const barDates = async (gantt: GanttParts): Promise<Record<string, string>> =>
  Object.fromEntries(
    (await barFacts(gantt)).map((bar) => [bar.task, `${bar.start}..${bar.finish}`]),
  );

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

/**
 * Each grid row's top under the grid's header and its bar's top in the chart, less the 11px a bar
 * sits below its row's top: equal for every row that has a bar, so the two stay lined up.
 */
export const alignment = (gantt: GanttParts) =>
  gantt.root.evaluate((root) => {
    const grid = root.querySelector('[role="grid"]');
    const chart = root.querySelector("svg");
    if (grid === null || chart === null) return [];
    const gridTop = grid.getBoundingClientRect().top;
    const chartTop = chart.getBoundingClientRect().top;
    return [...grid.querySelectorAll("[data-gantt-row]")].map((row) => {
      const task = row.getAttribute("data-gantt-row") ?? "";
      const bar = chart.querySelector(`[data-gantt-bar="${task}"]`);
      const barTop = bar === null ? undefined : bar.getBoundingClientRect().top - chartTop - 11;
      const rowTop = row.getBoundingClientRect().top - gridTop;
      return {
        task,
        row: Math.round(rowTop),
        bar: barTop === undefined ? undefined : Math.round(barTop),
      };
    });
  });

/** A task's predecessors panel. */
export const panelOf = (gantt: GanttParts, task: string): Locator =>
  gantt.root.locator(`[data-gantt-panel="${task}"]`);

/** Each box of a predecessors panel: its task's name, whether it is checked or disabled, and why. */
export const panelFacts = (panel: Locator) =>
  panel.getByRole("checkbox").evaluateAll((boxes) =>
    boxes.map((box) => {
      const label = box.ownerDocument.querySelector(`label[for="${CSS.escape(box.id)}"]`);
      const reasonId = box.getAttribute("aria-describedby");
      const reason = reasonId === null ? null : box.ownerDocument.getElementById(reasonId);
      return {
        task: (label?.textContent ?? "").trim(),
        checked: box.getAttribute("aria-checked") === "true",
        disabled: (box as HTMLButtonElement).disabled,
        reason: (reason?.textContent ?? "").trim(),
      };
    }),
  );

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

/**
 * A Gantt at both predecessor limits: fifty tasks depend on Source, so Source has fifty
 * dependents, and Hub depends on those fifty; X depends on nothing.
 */
export const LIMITS_TASKS: readonly GanttOwnTask[] = [
  { id: "src", label: "Source", duration: 1 },
  ...Array.from({ length: 50 }, (_, index) => ({
    id: `p${index + 1}`,
    label: `P ${index + 1}`,
    duration: 1,
    dependencies: ["src"],
  })),
  {
    id: "hub",
    label: "Hub",
    duration: 1,
    dependencies: Array.from({ length: 50 }, (_, index) => `p${index + 1}`),
  },
  { id: "x", label: "X", duration: 1 },
];

/** A point on the page, as Playwright's mouse takes it. */
type Point = { readonly x: number; readonly y: number };

/** Where the pointer grabs a bar to move it: 4px in from its start, at its middle. */
export const grabPoint = async (gantt: GanttParts, task: string): Promise<Point> => {
  const box = await gantt.bar(task).boundingBox();
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

/** The toolbar's counter of the user's changes. */
export const counterText = async (gantt: GanttParts): Promise<string> =>
  ((await gantt.root.locator("[data-gantt-counter]").textContent()) ?? "").trim();

/** Each change outline's task, stroke and width, in the chart's order. */
export const changeOutlines = (gantt: GanttParts) =>
  gantt.root.locator("[data-gantt-change]").evaluateAll((outlines) =>
    outlines.map((outline) => ({
      task: outline.getAttribute("data-gantt-change") ?? "",
      stroke: getComputedStyle(outline).stroke,
      width: getComputedStyle(outline).strokeWidth,
    })),
  );

/** The body cells drawn in a background colour, as `task.column`, with their text's colour. */
export const filledCells = (gantt: GanttParts, background: string) =>
  gantt.grid.locator("[data-gantt-column]").evaluateAll(
    (cells, fill) =>
      cells
        .filter((cell) => getComputedStyle(cell).backgroundColor === fill)
        .map((cell) => ({
          cell: `${cell.parentElement?.getAttribute("data-gantt-row")}.${cell.getAttribute("data-gantt-column")}`,
          color: getComputedStyle(cell).color,
        })),
    background,
  );

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
