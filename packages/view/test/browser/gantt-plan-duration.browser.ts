// A Gantt plan's requested duration, in each engine, on the widget host (widget-editing-plus design
// decision 2; view spec, "Gantt plan duration resize", "Duration resize feedback", "A requested
// duration is cleared by returning to the estimate", "A requested duration is a change" and
// "Read-only Gantt"), on the fixture plan, whose portal's estimates give 13 working days:
// lengthening the portal's bar by three working days requests 16, with a pin, its dependants and
// the plan's end following; the end of a bar never goes under one day; typing a duration, and the
// refusal of 2.5; the request cleared by dragging back to the estimate, by Delete and by "Use
// estimate"; the answer's one `set`; and a read-only plan with no handle and no clear.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE } from "@askboard/contract";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { validateGanttProps } from "@askboard/contract/validate";
import { WEEK_PX } from "./fixtures/gantt-documents.ts";
import { dragBy, endPoint, focusedCell, keysTo, pressAndMove } from "./fixtures/gantt-input.ts";
import { chooseWeek, PLAN_TASKS, planGantt, planQuestion } from "./fixtures/gantt-plan.ts";
import {
  barDates,
  changeOutlines,
  counterText,
  derivedOutlines,
  type GanttParts,
  ganttOf,
  rowTexts,
} from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// The portal's bar ends on Thursday 12/3; three working days later is Tuesday 12/8, five calendar days.
const THREE_WORKING_DAYS = 5 * WEEK_PX;

/** A task's duration cell text. */
const durationOf = async (gantt: GanttParts, task: string) =>
  ((await gantt.cell(task, "duration").textContent()) ?? "").trim();

const pinOf = (gantt: GanttParts, task: string) =>
  gantt.cell(task, "duration").locator("[data-gantt-pin]");

/** The right end of the portal's bar, where a handle would be, in a read-only plan. */
const barEnd = async (gantt: GanttParts) => {
  const box = await gantt.bar("portal").boundingBox();
  if (box === null) throw new Error("the portal has no bar");
  return { x: box.x + box.width - 3, y: box.y + box.height / 2 };
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Gantt plan's requested duration`, () => {
    const { host } = useWidgetHost(engine);

    const opened = async (): Promise<{ run: WidgetHostRun; gantt: GanttParts }> => {
      const run = await host(dist, ganttPlanBoardDocument);
      await eventually(() => run.messages.length > 0, "the plan's ready message", LOAD_TIMEOUT_MS);
      const gantt = ganttOf(run.board, planGantt.id);
      await chooseWeek(gantt);
      return { run, gantt };
    };

    test(
      "lengthening the portal's bar by three working days requests 16 with a pin, and its dependants and the plan's end follow",
      async () => {
        const { run, gantt } = await opened();
        await dragBy(run.board, await endPoint(gantt, "portal"), THREE_WORKING_DAYS);
        await eventually(async () => (await durationOf(gantt, "portal")).includes("16 d"), "16 d");
        expect(await pinOf(gantt, "portal").count()).toBe(1);
        expect(await pinOf(gantt, "ux").count()).toBe(0);
        expect(await gantt.cell("portal", "duration").getAttribute("title")).toBe(
          "Requested 16 days; the estimates give 13",
        );
        const dates = await barDates(gantt);
        expect(dates.portal).toBe("2026-11-17..2026-12-08");
        expect(dates.reporting).toBe("2026-12-09..2026-12-16");
        expect((await changeOutlines(gantt)).map(({ task }) => task)).toEqual(["portal"]);
        expect(await counterText(gantt)).toBe("Your changes: 1");
        // The pin and the change fill on the portal's cell; reporting only follows, with no pin and
        // no derived mark, which is for a duration that follows the Tree.
        expect(await derivedOutlines(gantt)).toEqual([]);
        expect(await pinOf(gantt, "reporting").count()).toBe(0);
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "while the end is dragged a label reads the live duration and a guide marks the earliest end",
      async () => {
        const { run, gantt } = await opened();
        await pressAndMove(run.board, await endPoint(gantt, "portal"), 4 * WEEK_PX);
        const label = gantt.root.locator("[data-gantt-resize-label]");
        await eventually(async () => (await label.textContent())?.trim() === "15 d", "the label");
        expect(await gantt.root.locator("[data-gantt-resize]").count()).toBe(1);
        await run.board.page.keyboard.press("Escape");
        expect(await gantt.root.locator("[data-gantt-resize]").count()).toBe(0);
        expect(await durationOf(gantt, "portal")).toBe("13 d");
        await run.board.page.mouse.up();
        expect(await durationOf(gantt, "portal")).toBe("13 d");
        expect(await counterText(gantt)).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the end of a bar dragged far to the left leaves one working day",
      async () => {
        const { run, gantt } = await opened();
        await dragBy(run.board, await endPoint(gantt, "architecture"), -400);
        await eventually(
          async () => (await durationOf(gantt, "architecture")).includes("1 d"),
          "1 d",
        );
        expect(await pinOf(gantt, "architecture").count()).toBe(1);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a typed duration is a request, and 2.5 is refused with the focus and the draft kept",
      async () => {
        const { run, gantt } = await opened();
        await keysTo(run.board, "portal", "duration", PLAN_TASKS);
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.press("ControlOrMeta+A");
        await run.board.page.keyboard.type("2.5");
        await run.board.page.keyboard.press("Enter");
        expect(await gantt.note("portal").count()).toBe(1);
        expect(await gantt.grid.locator("input").count()).toBe(1);
        expect(await counterText(gantt)).toBe("No changes");
        await run.board.page.keyboard.press("ControlOrMeta+A");
        await run.board.page.keyboard.type("10");
        await run.board.page.keyboard.press("Enter");
        expect(await focusedCell(run.board)).toBe("portal.duration");
        expect(await durationOf(gantt, "portal")).toBe("10 d");
        expect(await pinOf(gantt, "portal").count()).toBe(1);
        expect(await counterText(gantt)).toBe("Your changes: 1");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "dragging back to the estimate, Delete and Use estimate each clear the request and its pin",
      async () => {
        const { run, gantt } = await opened();
        const before = await rowTexts(gantt);
        // Out and back by the pointer.
        await dragBy(run.board, await endPoint(gantt, "portal"), THREE_WORKING_DAYS);
        await eventually(async () => (await pinOf(gantt, "portal").count()) === 1, "the pin");
        await dragBy(run.board, await endPoint(gantt, "portal"), -THREE_WORKING_DAYS);
        await eventually(async () => (await pinOf(gantt, "portal").count()) === 0, "no pin");
        expect(await rowTexts(gantt)).toEqual(before);
        expect(await counterText(gantt)).toBe("No changes");
        expect(await run.board.answer.isDisabled()).toBe(true);
        // By the keyboard: Delete on the pinned cell.
        await keysTo(run.board, "portal", "duration", PLAN_TASKS);
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.press("ControlOrMeta+A");
        await run.board.page.keyboard.type("21");
        await run.board.page.keyboard.press("Enter");
        expect(await durationOf(gantt, "portal")).toBe("21 d");
        await run.board.page.keyboard.press("Delete");
        expect(await durationOf(gantt, "portal")).toBe("13 d");
        expect(await pinOf(gantt, "portal").count()).toBe(0);
        // By the pin's own control, "Use estimate".
        await dragBy(run.board, await endPoint(gantt, "billing"), THREE_WORKING_DAYS);
        await pinOf(gantt, "billing").click();
        await eventually(async () => (await pinOf(gantt, "billing").count()) === 0, "no pin");
        expect(await counterText(gantt)).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Answer sends one set of the portal's duration, and the plan then has no handle, no clear and a mark for a pin",
      async () => {
        const { run, gantt } = await opened();
        await dragBy(run.board, await endPoint(gantt, "portal"), THREE_WORKING_DAYS);
        await eventually(async () => (await pinOf(gantt, "portal").count()) === 1, "the pin");
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await run.board.receipt("sent").waitFor();
        const answer = run.messages.find((message) => message.type === "answer");
        const values = answer?.type === "answer" ? answer.values : undefined;
        const edited = validateGanttProps(values?.[planGantt.id], "edited");
        if (!edited.ok) throw new Error("the answer's plan does not validate as edited");
        expect(
          elementChanges(planGantt.id, planGantt.props, edited.value, GANTT_PLAN_SHAPE),
        ).toEqual([{ op: "set", target: "schedule.portal.duration", value: 16 }]);
        // Read-only: no handle, the pin a mark and not a button, Delete clears nothing.
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        expect(await pinOf(gantt, "portal").evaluate((pin) => pin.tagName)).toBe("SPAN");
        await keysTo(run.board, "portal", "duration", PLAN_TASKS);
        await run.board.page.keyboard.press("Delete");
        await run.board.page.keyboard.press("Enter");
        expect(await gantt.grid.locator("input").count()).toBe(0);
        expect(await durationOf(gantt, "portal")).toBe("16 d");
        await dragBy(run.board, await barEnd(gantt), -60);
        expect(await durationOf(gantt, "portal")).toBe("16 d");
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready", "answer"]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
