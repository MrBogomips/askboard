// The Gantt's scenarios, in each engine, on the widget host (gantt-widget design decisions 9 and 12),
// since the board page refuses a board document holding a Gantt until the input format admits
// one. A question holding only a widget counts as loaded on its `ready` message: the board
// harness's `loaded()` waits for option controls. The fixture Gantt's question counts as visible
// with no CSP violation, its `compute` library chunk running under the view's policy; a Gantt
// whose props fail the contract's checks fails its question (AD-10); and an eval in the `compute`
// chunk is reported, the negative control that makes "no violation" mean something there.

import { describe, expect, test } from "bun:test";
import { type GanttOwnTask, ganttPropsProblems } from "@askboard/contract";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { EVAL_PROBE, readViewBuild, withChunkScript } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const [schedule] = ganttBoardDocument.items;
const [release] = schedule.props.items;
const tasks = release.props.tasks as readonly GanttOwnTask[];

// The fixture Gantt with a task only the view may add: `u-` IDs are refused from the agent, so the
// contract's check fails it.
const refusedProps = {
  ...release.props,
  tasks: [...tasks, { id: "u-1", label: "Added by the agent", duration: 1 }],
};
const refusedGantt: ViewDocument = {
  ...ganttBoardDocument,
  items: [
    { ...schedule, props: { ...schedule.props, items: [{ ...release, props: refusedProps }] } },
  ],
};

// The build with the eval probe run first in the `compute` library chunk.
const withComputeProbe = () => {
  const script = dist.manifest.chunks.compute?.script;
  if (script === undefined) throw new Error("the view build has no compute chunk");
  return withChunkScript(dist, "compute", `${EVAL_PROBE}${dist.files.get(script.path) ?? ""}`);
};

const reportsEval = (problems: readonly string[]): boolean =>
  problems.some((problem) => /eval/i.test(problem));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Gantt`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the fixture Gantt's question counts as visible, its ready message recorded, with no CSP violation",
      async () => {
        const run = await host(dist, ganttBoardDocument);
        await eventually(
          () => run.messages.length > 0,
          "the question's ready message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: schedule.id }]);
        const card = run.board.question(schedule.id);
        expect(await card.getAttribute("aria-busy")).toBe("false");
        expect(await card.getByRole("alert").count()).toBe(0);
        const shown = (await card.textContent()) ?? "";
        for (const { label } of tasks) expect(shown).toContain(label);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Gantt whose props fail the contract's checks fails its question, with no Answer",
      async () => {
        const problems = ganttPropsProblems(refusedProps, "agent");
        expect(problems).toHaveLength(1);
        const [problem] = problems;
        const run = await host(dist, refusedGantt);
        await eventually(
          () => run.messages.length > 0,
          "the Gantt's item-error message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([
          {
            type: "item-error",
            itemId: release.id,
            error: expect.stringContaining(`${problem?.path}: ${problem?.message}`),
          },
        ]);
        const card = run.board.question(schedule.id);
        expect(await card.getByRole("alert").count()).toBe(1);
        expect(await run.board.answer.count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "catches a caught eval in the compute chunk the Gantt's view runs",
      async () => {
        const run = await host(withComputeProbe(), ganttBoardDocument);
        await eventually(
          () => reportsEval(run.browser.cspProblems()),
          "the compute chunk's eval to be reported",
          LOAD_TIMEOUT_MS,
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
