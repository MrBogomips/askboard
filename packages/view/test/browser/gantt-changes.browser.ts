// The Gantt's changes and its answer, in each engine, on the widget host (gantt-widget design
// decisions 9 and 12; spec, "Gantt formula errors", "Gantt change highlight", "Gantt edits only
// fill the draft", "Answering a question with a Gantt" and "Read-only Gantt"): tasks the graph
// cannot schedule show a field error under their rows and do not block "Answer"; the change
// highlight and the counter in either scheme; edits undone by hand disable "Answer", and "Answer"
// sends one message with the Gantt's edited value and derived values; after it, or while the host
// sends a lock, the Gantt stays readable and navigable and takes no edit.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_SHAPE } from "@askboard/contract";
import { ganttBoardDocument, ganttEditedValue } from "@askboard/contract/fixtures";
import { release, schedule, UJ2, WEEK_PX } from "./fixtures/gantt-documents.ts";
import { dragBy, endPoint, grabPoint, keysTo, sendLock } from "./fixtures/gantt-input.ts";
import {
  alignment,
  barDates,
  changeOutlines,
  colour,
  counterText,
  criticalTasks,
  filledCells,
  GANTT_ID,
  ganttOf,
  panelOf,
  RELEASE_TASKS,
  rowTexts,
  withTasks,
} from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { expectReadOnly, openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

// Two tasks that depend on each other, and one after a task the Gantt does not hold.
const brokenGantt = withTasks([
  ...RELEASE_TASKS,
  { id: "qa", label: "QA sign-off", duration: 2, dependencies: ["docs"] },
  { id: "docs", label: "Release notes", duration: 3, dependencies: ["qa"] },
  { id: "launch", label: "Launch", duration: 1, dependencies: ["ghost"] },
]);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's changes and answer`, () => {
    const { host } = useWidgetHost(engine);
    const opened = openerFor(host, dist);

    test(
      "tasks on a cycle, or after a task the Gantt does not hold, show a field error under their rows and no bar, the others scheduled, and do not block Answer",
      async () => {
        const run = await opened(brokenGantt);
        const gantt = ganttOf(run.board);
        const cycle = "No dates: its predecessors form a cycle.";
        for (const task of ["qa", "docs"]) {
          expect(((await gantt.note(task).textContent()) ?? "").trim()).toBe(cycle);
        }
        expect(((await gantt.note("launch").textContent()) ?? "").trim()).toBe(
          "No dates: its predecessor ghost names no task.",
        );
        expect(await gantt.root.locator("[data-gantt-note]").count()).toBe(3);
        // The other tasks keep their dates; with the plan's end unknown, no path is critical.
        expect(await barDates(gantt)).toEqual(
          Object.fromEntries(UJ2.map(([task, start, finish]) => [task, `${start}..${finish}`])),
        );
        expect(await criticalTasks(gantt)).toEqual([]);
        const rows = await rowTexts(gantt);
        expect(rows.slice(6)).toEqual([
          ["qa", "QA sign-off", "", "2", "Release notes"],
          ["docs", "Release notes", "", "3", "QA sign-off"],
          ["launch", "Launch", "", "1", "ghost"],
        ]);
        const lined = await alignment(gantt);
        expect(lined.map(({ row }) => row)).toEqual([32, 68, 104, 140, 176, 212, 248, 304, 360]);
        for (const { row, bar } of lined) if (bar !== undefined) expect(bar).toBe(row);
        expect(await run.board.answer.isDisabled()).toBe(true);
        // A change elsewhere: the question can be answered, the errors standing.
        await keysTo(run.board, "billing", "duration", [...RELEASE_TASKS]);
        await run.board.page.keyboard.press("F2");
        await run.board.page.keyboard.type("10");
        await run.board.page.keyboard.press("Enter");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(await gantt.root.locator("[data-gantt-note]").count()).toBe(3);
        // The cycle broken in the panel: both tasks are scheduled again.
        await gantt.cell("docs", "dependencies").click();
        await run.board.page.keyboard.press("Enter");
        await panelOf(gantt, "docs").getByRole("checkbox", { name: "QA sign-off" }).click();
        await panelOf(gantt, "docs").getByRole("button", { name: "Done" }).click();
        expect(await gantt.note("qa").count()).toBe(0);
        expect(await gantt.note("docs").count()).toBe(0);
        const dates = await barDates(gantt);
        expect([dates.docs, dates.qa]).toEqual([
          "2026-11-02..2026-11-04",
          "2026-11-05..2026-11-06",
        ]);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, a changed task takes the change outline and its changed cells the change fill, a task moved only by a predecessor neither, and the counter counts each changed task once`,
        async () => {
          const run = await opened();
          if (scheme === "dark") {
            await run.board.page.emulateMedia({ colorScheme: "dark" });
            await run.board.page.reload();
            await eventually(
              () => run.messages.filter((message) => message.type === "ready").length > 1,
              "the reloaded question's ready message",
              LOAD_TIMEOUT_MS,
            );
            const view = await run.board.viewFrame();
            expect(await view.evaluate(() => document.querySelector(".dark") !== null)).toBe(true);
          }
          const gantt = ganttOf(run.board);
          expect(await counterText(gantt)).toBe("No changes");
          expect(await changeOutlines(gantt)).toEqual([]);
          await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
          expect(await counterText(gantt)).toBe("Your changes: 1");
          await dragBy(run.board, await endPoint(gantt, "ux"), 2 * WEEK_PX);
          await gantt.cell("billing", "dependencies").click();
          await run.board.page.keyboard.press("Enter");
          await panelOf(gantt, "billing").getByRole("checkbox", { name: "UX design" }).click();
          await panelOf(gantt, "billing").getByRole("button", { name: "Done" }).click();
          const change = { stroke: colour("change", scheme), width: "2px" };
          expect(await changeOutlines(gantt)).toEqual(
            ["ux", "billing", "reporting"].map((task) => ({ task, ...change })),
          );
          expect(await filledCells(gantt, colour("change-subtle", scheme))).toEqual(
            ["ux.duration", "billing.dependencies", "reporting.start"].map((cell) => ({
              cell,
              color: colour("change-text", scheme),
            })),
          );
          expect(await counterText(gantt)).toBe("Your changes: 3");
          expect(run.messages.filter((message) => message.type !== "ready")).toEqual([]);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "edits undone by hand disable Answer; Answer sends one message with the Gantt's edited value and derived values, whose diff gives the edits made",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        // Later, then back by typing its earliest start: no change is left.
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        expect(await run.board.answer.isEnabled()).toBe(true);
        await keysTo(run.board, "reporting", "start");
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.type("12/4/2026");
        await run.board.page.keyboard.press("Enter");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await counterText(gantt)).toBe("No changes");
        // The fixture's two edits, by keyboard.
        await keysTo(run.board, "reporting", "start");
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.type("12/9/2026");
        await run.board.page.keyboard.press("Enter");
        await keysTo(run.board, "billing", "duration");
        await run.board.page.keyboard.press("F2");
        await run.board.page.keyboard.type("11");
        await run.board.page.keyboard.press("Enter");
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([
          { type: "ready", itemId: schedule.id },
          {
            type: "answer",
            itemId: schedule.id,
            rev: schedule.rev,
            values: { [GANTT_ID]: ganttEditedValue },
            derived: { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] },
            when: expect.any(String),
          },
        ]);
        const answer = run.messages[1] as { values: Record<string, object> };
        expect(
          elementChanges(GANTT_ID, release.props, answer.values[GANTT_ID] ?? {}, GANTT_SHAPE),
        ).toEqual([
          { op: "set", target: "release.billing.duration", value: 11 },
          { op: "set", target: "release.reporting.start", value: "2026-12-09" },
        ]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after Answer, the Gantt stays readable and navigable, shows what was sent, and takes no edit",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await dragBy(run.board, await grabPoint(gantt, "reporting"), 5 * WEEK_PX);
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await run.board.receipt("sent").waitFor();
        expect((await barDates(gantt)).reporting).toBe("2026-12-09..2026-12-16");
        await expectReadOnly(run);
        expect(run.messages.map((message) => message.type)).toEqual(["ready", "answer"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "while the host sends a lock, the Gantt stays readable and navigable and takes no edit",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board);
        await sendLock(run.board, ganttBoardDocument);
        await eventually(
          async () => (await gantt.root.locator("[data-gantt-handle]").count()) === 0,
          "the Gantt to turn read-only",
        );
        await expectReadOnly(run);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
