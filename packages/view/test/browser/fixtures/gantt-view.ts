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
import { release, schedule } from "./gantt-documents.ts";

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

/** The tasks whose bars are drawn on the critical path, in the chart's order. */
export const criticalTasks = async (gantt: GanttParts): Promise<string[]> =>
  (await barFacts(gantt)).filter((bar) => bar.critical).map((bar) => bar.task);

/** Each bar's start and finish, by task. */
export const barDates = async (gantt: GanttParts): Promise<Record<string, string>> =>
  Object.fromEntries(
    (await barFacts(gantt)).map((bar) => [bar.task, `${bar.start}..${bar.finish}`]),
  );

/**
 * Each grid row's top under the grid's header and its bar's top in the chart, less what a bar sits
 * below its row's top (the row's height less the bar's 14px, halved): equal for every row that has
 * a bar, so the two stay lined up.
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
      const lift = (row.getBoundingClientRect().height - 14) / 2;
      const barTop = bar === null ? undefined : bar.getBoundingClientRect().top - chartTop - lift;
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

/** The tasks whose bar carries the derived mark, the dotted outline, in the chart's order. */
export const derivedOutlines = (gantt: GanttParts) =>
  gantt.root
    .locator("[data-gantt-derived]:not(td)")
    .evaluateAll((outlines) =>
      outlines.map((outline) => outline.getAttribute("data-gantt-derived") ?? ""),
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
 * A Gantt at the task limit: 500 tasks in 20 chains of 25, each task after the one before it in
 * its chain, each chain's first after the first of the chain before, durations of 1 to 5 days.
 */
export const LIMIT_TASKS: readonly GanttOwnTask[] = Array.from({ length: 500 }, (_, index) => {
  const chain = Math.floor(index / 25);
  const before = index % 25 === 0 ? (chain === 0 ? undefined : index - 25) : index - 1;
  return {
    id: `t${index + 1}`,
    label: `Task ${index + 1}`,
    duration: (index % 5) + 1,
    ...(before === undefined ? {} : { dependencies: [`t${before + 1}`] }),
  };
});
