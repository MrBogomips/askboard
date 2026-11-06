// The Gantt plan's axis labels, in each engine, in en-US and it-IT at each zoom (view spec, "Gantt
// layout"): a label never runs into the next, so the timeline header stays readable. At day zoom a
// day's column is 32px, which `mer 11` does not fit beside its neighbour: the weekday sits over the
// day. The boxes the browser lays the labels out in must not overlap, in any zoom.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { planGantt, type ZoomName, zoomOption } from "./fixtures/gantt-plan.ts";
import { type GanttParts, ganttOf } from "./fixtures/gantt-view.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const LOCALES = ["en-US", "it-IT"] as const;
const CHART_NAME = {
  "en-US": (zoom: ZoomName) => `Gantt chart, ${zoom} zoom`,
  "it-IT": (zoom: ZoomName) =>
    `Diagramma di Gantt, zoom ${ZOOM_LABEL["it-IT"][zoom].toLowerCase()}`,
} as const;
const ZOOM_LABEL: Record<(typeof LOCALES)[number], Record<ZoomName, string>> = {
  "en-US": { day: "Day", week: "Week", month: "Month" },
  "it-IT": { day: "Giorno", week: "Settimana", month: "Mese" },
};

type Box = { readonly left: number; readonly right: number; readonly top: number };

/** The boxes the axis labels are laid out in, left to right. */
const tickBoxes = (gantt: GanttParts): Promise<Box[]> =>
  gantt.ticks.evaluateAll((labels) =>
    labels
      .map((label) => label.getBoundingClientRect())
      .map(({ left, right, top }) => ({ left, right, top }))
      .sort((a, b) => a.left - b.left),
  );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const language of LOCALES) {
    describe(`${engine}, ${language}: the Gantt plan's axis labels`, () => {
      const { host } = useWidgetHost(engine);

      for (const zoom of ["day", "week", "month"] as const) {
        test(
          `do not overlap at ${zoom} zoom`,
          async () => {
            const document = { ...ganttPlanBoardDocument, language } as unknown as ViewDocument;
            const run = await openerFor((build, doc) => host(build, doc), dist)(document);
            const gantt = ganttOf(run.board, planGantt.id);
            await zoomOption(gantt, ZOOM_LABEL[language][zoom]).click({ timeout: STEP_TIMEOUT_MS });
            await gantt.root
              .getByRole("img", { name: CHART_NAME[language](zoom) })
              .waitFor({ timeout: STEP_TIMEOUT_MS });
            await eventually(async () => (await gantt.ticks.count()) > 0, "the axis labels");
            const boxes = await tickBoxes(gantt);
            expect(boxes.length).toBeGreaterThan(0);
            for (const [at, box] of boxes.entries()) {
              const next = boxes[at + 1];
              if (next === undefined) continue;
              expect(box.right).toBeLessThanOrEqual(next.left);
            }
            expect(run.browser.cspProblems()).toEqual([]);
          },
          TEST_TIMEOUT_MS,
        );
      }
    });
  }
}
