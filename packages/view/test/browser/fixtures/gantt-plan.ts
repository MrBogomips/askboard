// What the Gantt plan's browser scenarios share (gantt-widget design decisions 9 and 12): the
// fixture plan's question `plan`, holding the Tree `wbs` and the plan `schedule` over it; its tasks,
// the Tree's leaves in the Tree's order, and its rows as the grid shows them; each zoom's day
// width; and where a scenario finds the plan's own parts: the zoom's options, the chart by its
// zoom, each baseline, the rows of the packages added in the Tree, and its grid from the Tree
// before it. The plan's structural hooks, beside those of `gantt-view.ts`: each baseline carries
// `data-gantt-baseline="<task>"` with `data-start` and `data-finish`, and the grid row of a package
// the user added in the Tree `data-gantt-added`.

import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { Board } from "../harness/dom.ts";
import { UJ2 } from "./gantt-documents.ts";
import { focusedCell } from "./gantt-input.ts";
import type { GanttParts } from "./gantt-view.ts";

/** The fixture plan's question `plan`, its Tree `wbs` and the plan `schedule`. */
export const [planQuestion] = ganttPlanBoardDocument.items;
export const [planTree, planGantt] = planQuestion.props.items;

/** The plan's tasks: the Tree's six leaves, in the Tree's order, as `keysTo` takes them. */
export const PLAN_TASKS = UJ2.map(([id]) => ({ id }));

/** A grid row's task and its cells' texts: name, start, duration and predecessors. */
export type RowText = [task: string, name: string, start: string, duration: string, after: string];

/** The fixture plan's rows: the Tree's leaves in its order, each duration its PERT estimate. */
export const PLAN_ROWS: RowText[] = [
  ["ux", "UX design", "11/2/2026", "6", ""],
  ["architecture", "Architecture", "11/2/2026", "4", ""],
  ["prototype", "Clickable prototype", "11/10/2026", "5", "UX design"],
  ["portal", "Customer portal", "11/17/2026", "13", "Architecture, Clickable prototype"],
  ["billing", "Billing integration", "11/6/2026", "9", "Architecture"],
  ["reporting", "Reporting", "12/4/2026", "6", "Customer portal"],
];

/**
 * Presses Tab until a cell of the plan's grid holds the focus, at most ten times: from the Tree,
 * on to the plan's zoom, then to its grid.
 */
export const tabIntoPlanGrid = async (board: Board): Promise<string> => {
  for (let presses = 0; presses < 10; presses += 1) {
    await board.page.keyboard.press("Tab");
    const cell = await focusedCell(board);
    if (cell !== undefined) return cell;
  }
  throw new Error("ten presses of Tab never reached the plan's grid");
};

/** The tasks whose grid rows carry the added mark, in the grid's order. */
export const addedRows = (gantt: GanttParts): Promise<string[]> =>
  gantt.grid
    .locator("[data-gantt-added]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-gantt-row") ?? ""));

/** A calendar day's width in pixels, by zoom (DESIGN.md's mock: 15 at the week scale). */
export const DAY_PX = { day: 32, week: 15, month: 4 } as const;

export type ZoomName = keyof typeof DAY_PX;

/** The zoom's options, by their labels, in order. */
export const ZOOM_LABELS = ["Day", "Week", "Month"] as const;

/** The chart, found by the zoom its label names. */
export const chartAt = (gantt: GanttParts, zoom: ZoomName): Locator =>
  gantt.root.getByRole("img", { name: `Gantt chart, ${zoom} zoom` });

/** A zoom option, by its label. */
export const zoomOption = (gantt: GanttParts, label: string): Locator =>
  gantt.root.getByRole("radiogroup", { name: "Zoom" }).getByRole("radio", { name: label });

/** The labels of the zoom's options that read as checked. */
export const checkedZoom = (gantt: GanttParts): Promise<string[]> =>
  gantt.root
    .getByRole("radio")
    .evaluateAll((options) =>
      options
        .filter((option) => option.getAttribute("aria-checked") === "true")
        .map((option) => (option.textContent ?? "").trim()),
    );

/** The label of the view's focused zoom option; undefined when the focus is elsewhere. */
export const focusedZoom = async (board: Board): Promise<string | undefined> => {
  const view = await board.viewFrame();
  return view.evaluate(() => {
    const active = document.activeElement;
    if (!document.hasFocus() || active?.getAttribute("role") !== "radio") return undefined;
    return (active.textContent ?? "").trim();
  });
};

/** How a zoom option is drawn: its fill, its text's colour and weight, and its underline. */
export const optionLook = (option: Locator) =>
  option.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      weight: style.fontWeight,
      underline: `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`,
    };
  });

/**
 * Every baseline's task, dates, geometry and fill, in the chart's order, with the gap from the
 * bottom of its task's bar to its top: a baseline lies under its bar.
 */
export const baselineFacts = (gantt: GanttParts) =>
  gantt.root.locator("[data-gantt-baseline]").evaluateAll((baselines) =>
    baselines.map((baseline) => {
      const task = baseline.getAttribute("data-gantt-baseline") ?? "";
      const bar = baseline.ownerDocument.querySelector(`[data-gantt-bar="${task}"]`);
      const barBottom =
        bar === null
          ? Number.NaN
          : Number(bar.getAttribute("y")) + Number(bar.getAttribute("height"));
      return {
        task,
        start: baseline.getAttribute("data-start") ?? "",
        finish: baseline.getAttribute("data-finish") ?? "",
        x: Number(baseline.getAttribute("x")),
        width: Number(baseline.getAttribute("width")),
        height: Number(baseline.getAttribute("height")),
        gap: Number(baseline.getAttribute("y")) - barBottom,
        fill: getComputedStyle(baseline).fill,
      };
    }),
  );

/** Each axis label, in order. */
export const tickLabels = async (gantt: GanttParts): Promise<string[]> =>
  (await gantt.ticks.allTextContents()).map((label) => label.trim());
