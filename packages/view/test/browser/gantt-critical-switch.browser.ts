// The Gantt's "Critical path" switch, in each engine, on the widget host (widget-editing-plus
// design decision 8; view spec, "Gantt critical path switch" and "The critical path switch is
// view state"), on the fixture plan: on when the board opens; off, the critical bars and arrows
// are drawn as ordinary ones, the legend drops its critical entry, and the schedule, the grid and
// the computed flags do not change; the arrow keys of the toolbar reach it and Space toggles it;
// it is no answer, and it works after "Answer".

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { chooseWeek, planGantt, planQuestion } from "./fixtures/gantt-plan.ts";
import {
  arrowFacts,
  barFacts,
  colour,
  counterText,
  ganttOf,
  rowTexts,
} from "./fixtures/gantt-view.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const CRITICAL = ["ux", "prototype", "portal", "reporting"];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's critical path switch`, () => {
    const { host } = useWidgetHost(engine);

    const opened = async () => {
      const run = await host(dist, ganttPlanBoardDocument);
      await eventually(() => run.messages.length > 0, "the plan's ready message", LOAD_TIMEOUT_MS);
      const gantt = ganttOf(run.board, planGantt.id);
      await chooseWeek(gantt);
      return { run, gantt, toggle: gantt.root.getByRole("switch", { name: "Critical path" }) };
    };

    /** The legend's entries, by their texts. */
    const legend = (gantt: ReturnType<typeof ganttOf>) =>
      gantt.root.locator("[data-gantt-legend]").allTextContents();

    test(
      "it is on at open, and off it draws every bar and arrow as an ordinary one, leaving the schedule as it was",
      async () => {
        const { run, gantt, toggle } = await opened();
        expect(await toggle.getAttribute("aria-checked")).toBe("true");
        const bars = await barFacts(gantt);
        const fills = (list: typeof bars) => list.filter((bar) => bar.fill === colour("critical"));
        expect(fills(bars).map((bar) => bar.task)).toEqual(CRITICAL);
        expect(await legend(gantt)).toEqual(["task", "critical path", "your change"]);
        const rows = await rowTexts(gantt);
        await toggle.click();
        expect(await toggle.getAttribute("aria-checked")).toBe("false");
        const plain = await barFacts(gantt);
        expect(fills(plain)).toEqual([]);
        expect(plain.every((bar) => bar.fill === colour("gantt-bar"))).toBe(true);
        // The computed flags and the grid are as before.
        expect(plain.filter((bar) => bar.critical).map((bar) => bar.task)).toEqual(CRITICAL);
        expect(await rowTexts(gantt)).toEqual(rows);
        const arrows = await arrowFacts(gantt);
        expect(arrows.every((arrow) => arrow.stroke === colour("border-strong"))).toBe(true);
        expect(arrows.every((arrow) => arrow.width === "1px")).toBe(true);
        expect(await legend(gantt)).toEqual(["task", "your change"]);
        await toggle.click();
        expect(fills(await barFacts(gantt)).map((bar) => bar.task)).toEqual(CRITICAL);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "by keyboard: Tab to the toolbar, the arrow keys to the switch, Space toggles it, and the page does not navigate",
      async () => {
        const { run, gantt, toggle } = await opened();
        const url = await run.board.page.evaluate(() => location.href);
        await gantt.root
          .getByRole("radiogroup", { name: "Zoom" })
          .getByRole("radio")
          .first()
          .focus();
        for (const _ of [1, 2, 3]) await run.board.page.keyboard.press("ArrowRight");
        expect(
          await toggle.evaluate((element) => element === element.ownerDocument.activeElement),
        ).toBe(true);
        await run.board.page.keyboard.press("Space");
        expect(await toggle.getAttribute("aria-checked")).toBe("false");
        await run.board.page.keyboard.press("ArrowLeft");
        expect(
          await gantt.root
            .getByRole("radiogroup", { name: "Zoom" })
            .getByRole("radio", { name: "Month" })
            .evaluate((element) => element === element.ownerDocument.activeElement),
        ).toBe(true);
        expect(await run.board.page.evaluate(() => location.href)).toBe(url);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the switch is no answer: nothing is sent, Answer stays disabled and the counter reads No changes",
      async () => {
        const { run, gantt, toggle } = await opened();
        await toggle.click();
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: planQuestion.id }]);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await counterText(gantt)).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after Answer the switch still works, and the bars still do not drag",
      async () => {
        const { run, gantt, toggle } = await opened();
        // One change of the plan's own, by keyboard, so that the question can be answered.
        const cell = gantt.cell("reporting", "start");
        await cell.focus();
        await run.board.page.keyboard.press("Enter");
        await run.board.page.keyboard.type("12/9/2026");
        await run.board.page.keyboard.press("Enter");
        await run.board.answer.click();
        await eventually(() => run.messages.length > 1, "the answer message");
        await run.board.receipt("sent").waitFor();
        await toggle.click();
        expect(await toggle.getAttribute("aria-checked")).toBe("false");
        expect((await barFacts(gantt)).filter((bar) => bar.fill === colour("critical"))).toEqual(
          [],
        );
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready", "answer"]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
