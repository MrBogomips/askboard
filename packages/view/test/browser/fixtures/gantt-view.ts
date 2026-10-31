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
import type { ViewDocument } from "../../../src/view-document.ts";
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

/** Presses Tab until a grid cell of the Gantt holds the focus, at most ten times. */
export const tabIntoGrid = async (board: Board): Promise<string> => {
  for (let presses = 0; presses < 10; presses += 1) {
    await board.page.keyboard.press("Tab");
    const cell = await focusedCell(board);
    if (cell !== undefined) return cell;
  }
  throw new Error("ten presses of Tab never reached the Gantt's grid");
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
