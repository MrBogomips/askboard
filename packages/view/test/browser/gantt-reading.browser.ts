// How the Gantt plan reads on the fixture plan at 1280 px, in each engine (widget-editing-plus,
// view spec, "Gantt plan opening zoom", "Gantt overflow cue", "Gantt time axis", "Gantt plan
// baseline", "Gantt rescheduling by drag" and "Gantt grid labels and dates"): it opens at the
// finest zoom that fits and says when it scrolls; the axis labels its first period and shades the
// weekends at Day; the arrows leave and enter by the rules; the drag guide runs the chart's height
// and says its date.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { ORIGIN, WEEK_PX } from "./fixtures/gantt-documents.ts";
import { grabPoint, guideFacts, pressAndMove } from "./fixtures/gantt-input.ts";
import {
  checkedZoom,
  DAY_PX,
  PLAN_ROWS,
  planGantt,
  planQuestion,
  tickLabels,
  zoomOption,
} from "./fixtures/gantt-plan.ts";
import { arrowFacts, colour, daysFrom, ganttOf, rowTexts } from "./fixtures/gantt-view.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: how the Gantt plan reads`, () => {
    const { host } = useWidgetHost(engine);

    const opened = async (): Promise<WidgetHostRun> => {
      const run = await host(dist, ganttPlanBoardDocument);
      await eventually(() => run.messages.length > 0, "the plan's first message", LOAD_TIMEOUT_MS);
      expect(run.messages[0]).toEqual({ type: "ready", itemId: planQuestion.id });
      return run;
    };

    test(
      "the plan opens at the finest zoom its whole span fits, and a plan that does not fit shows the overflow cue",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board, planGantt.id);
        const [checked] = await checkedZoom(gantt);
        const chart = gantt.root.getByRole("img", { name: /^Gantt chart/ });
        const days =
          Number(await chart.getAttribute("width")) /
          DAY_PX[(checked ?? "").toLowerCase() as "day"];
        const room = await chart.evaluate((svg) => svg.parentElement?.clientWidth ?? 0);
        // The finest zoom at which the span fits the box, Month when none does.
        const fits = (["Day", "Week", "Month"] as const).find(
          (zoom) => days * DAY_PX[zoom.toLowerCase() as "day"] <= room,
        );
        expect(checked).toBe(fits ?? "Month");
        const more = gantt.root.locator("[data-gantt-more]");
        const scrolls = await chart.evaluate(
          (svg) => (svg.parentElement?.scrollWidth ?? 0) > (svg.parentElement?.clientWidth ?? 0),
        );
        expect(await more.count()).toBe(scrolls ? 1 : 0);
        // Day is wider than the box: the cue shows on the side that holds more, then both.
        await zoomOption(gantt, "Day").click();
        await gantt.root.locator('[data-gantt-more="after"]').waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await gantt.root.locator('[data-gantt-more="before"]').count()).toBe(0);
        await chart.evaluate((svg) => {
          if (svg.parentElement !== null) svg.parentElement.scrollLeft = 200;
        });
        await gantt.root
          .locator('[data-gantt-more="before"]')
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the axis labels November at Month, the plan fills the chart, and Day shades the weekends",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board, planGantt.id);
        await zoomOption(gantt, "Month").click();
        await gantt.root.getByRole("img", { name: "Gantt chart, month zoom" }).waitFor();
        expect((await tickLabels(gantt))[0]).toBe("Nov 2026");
        const room = await gantt.root
          .getByRole("img", { name: "Gantt chart, month zoom" })
          .evaluate((svg) => [
            Number(svg.getAttribute("width")),
            svg.parentElement?.clientWidth ?? 0,
          ]);
        expect(room[0]).toBeGreaterThanOrEqual(room[1] ?? 0);
        await zoomOption(gantt, "Day").click();
        await gantt.root.getByRole("img", { name: "Gantt chart, day zoom" }).waitFor();
        const weekends = await gantt.root
          .locator("[data-gantt-weekend]")
          .evaluateAll((rects) =>
            rects.map((rect) => [
              rect.getAttribute("data-gantt-weekend"),
              getComputedStyle(rect).fill,
            ]),
          );
        expect(weekends.length).toBeGreaterThan(0);
        expect(weekends[0]).toEqual(["2026-11-07", colour("muted")]);
        for (const [date] of weekends) {
          expect(["Sat", "Sun"]).toContain(
            new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
              weekday: "short",
              timeZone: "UTC",
            }),
          );
        }
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an arrow leaves the bar's end by a stub and a plain one is drawn in border-strong, apart from the gridlines",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board, planGantt.id);
        const facts = await arrowFacts(gantt);
        const plain = facts.filter((arrow) => !arrow.critical);
        expect(plain.length).toBeGreaterThan(0);
        for (const arrow of plain) {
          expect(arrow.stroke).toBe(colour("border-strong"));
          expect(arrow.width).toBe("1px");
        }
        const path = await gantt.arrows.first().getAttribute("d");
        expect(path).toMatch(/^M[\d.]+,[\d.]+ h8 V[\d.]+ H[\d.]+ V[\d.]+ H[\d.]+$/);
        expect(run.browser.errors).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a drag shows the earliest start as a full-height dashed guide with its date",
      async () => {
        const run = await opened();
        const gantt = ganttOf(run.board, planGantt.id);
        await zoomOption(gantt, "Week").click();
        await gantt.root.getByRole("img", { name: "Gantt chart, week zoom" }).waitFor();
        await pressAndMove(run.board, await grabPoint(gantt, "reporting"), -10 * WEEK_PX);
        const guide = await guideFacts(gantt);
        const chartHeight = await gantt.root
          .getByRole("img", { name: "Gantt chart, week zoom" })
          .evaluate((svg) => Number(svg.getAttribute("height")));
        expect(guide).toMatchObject({
          date: "2026-12-04",
          x: daysFrom(ORIGIN, "2026-12-04") * 15,
          stroke: colour("foreground-secondary"),
          width: "2px",
          height: chartHeight,
          label: "earliest 12/4",
        });
        await run.board.page.mouse.up();
        expect(await guideFacts(gantt)).toBeUndefined();
        expect(await rowTexts(gantt)).toEqual(PLAN_ROWS);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
