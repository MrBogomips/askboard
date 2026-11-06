// The critical path as the chart draws it, in each engine (gantt-widget design decision 9; view
// spec, "Gantt layout"): the highlighted bars are the tasks `compute` flags critical, and an arrow is
// highlighted only where its link is tight, the successor starting the working day after its
// predecessor finishes. Two critical tasks may be joined by a link with slack, and a successor may be
// held back by a requested start: neither link is on the path.

import { describe, expect, test } from "bun:test";
import type { GanttOwnTask } from "@askboard/contract";
import { arrowFacts, criticalTasks, ganttOf, withTasks } from "./fixtures/gantt-view.ts";
import { TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { openerFor } from "./harness/gantt-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const task = (id: string, duration: number, extra: Partial<GanttOwnTask> = {}): GanttOwnTask => ({
  id,
  label: id.toUpperCase(),
  duration,
  ...extra,
});

/** The links the chart draws on the critical path, in the arrows' order. */
const criticalLinks = async (gantt: ReturnType<typeof ganttOf>): Promise<string[]> =>
  (await arrowFacts(gantt)).filter((arrow) => arrow.critical).map((arrow) => arrow.link);

/** The plans: their tasks, the critical tasks `compute` flags and the links on the path. */
const PLANS = [
  {
    name: "a task that depends on a critical chain and on its first link has a plain link from it",
    tasks: [
      task("a", 2),
      task("b", 5, { dependencies: ["a"] }),
      task("d", 1, { dependencies: ["a", "b"] }),
    ],
    critical: ["a", "b", "d"],
    links: ["a>b", "b>d"],
  },
  {
    name: "equal-length parallel branches are all critical, with all their links",
    tasks: [
      task("x", 3),
      task("y", 3),
      task("z", 1, { dependencies: ["x", "y"] }),
      task("m", 4, { dependencies: ["z"] }),
    ],
    critical: ["x", "y", "z", "m"],
    links: ["x>z", "y>z", "z>m"],
  },
  {
    name: "a requested start moves the path to the task that holds it",
    tasks: [
      task("x", 3),
      task("y", 2, { start: "2026-11-09" }),
      task("z", 1, { dependencies: ["x", "y"] }),
    ],
    critical: ["y", "z"],
    links: ["y>z"],
  },
] as const;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt's critical path`, () => {
    const { host } = useWidgetHost(engine);

    for (const plan of PLANS) {
      test(
        `${plan.name}`,
        async () => {
          const open = openerFor((build, doc) => host(build, doc), dist);
          const run = await open(withTasks(plan.tasks));
          const gantt = ganttOf(run.board);
          expect(await criticalTasks(gantt)).toEqual([...plan.critical]);
          expect(await criticalLinks(gantt)).toEqual([...plan.links]);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
