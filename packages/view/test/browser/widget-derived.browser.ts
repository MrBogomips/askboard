// The derived values of every computing item, in each engine (widget-answers, task 5.6; design
// decision 10; view spec: Derived values of every computing item in an answer): re-estimating one
// work package of the UJ-2 WBS with the plan untouched sends `values` for the Tree alone and
// `derived` with the plan's finish and critical path as the board shows them, and `collect`
// returns them under the plan's own reference; an option picked beside an untouched plan carries
// the plan's derived values and no `values`. On the widget host, and with `--target
// session-process` on the real board page too.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument, uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { planGantt, planQuestion } from "./fixtures/gantt-plan.ts";
import { barDates, criticalTasks, ganttOf } from "./fixtures/gantt-view.ts";
import { wbsPlan, wbsQuestion, wbsTree } from "./fixtures/wbs-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import { enterField, expectSteps, readyIn, tabUntil } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { placeSuffix, placesOf, widgetBoardFor } from "./harness/widget-board.ts";

const dist = await readViewBuild();

// The plan as the board shows it: the latest finish of its bars and its critical tasks, in order.
const shown = async (gantt: ReturnType<typeof ganttOf>) => {
  const finishes = Object.values(await barDates(gantt)).map((range) => range.split("..")[1] ?? "");
  return { finish: finishes.sort().at(-1), criticalPath: await criticalTasks(gantt) };
};

// The plan beside a choice: its own question, with two options, its Tree and plan untouched.
const withOptions = {
  ...ganttPlanBoardDocument,
  items: [
    {
      ...planQuestion,
      props: { ...planQuestion.props, options: [{ label: "Keep the plan" }, { label: "Redo it" }] },
    },
  ],
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const place of placesOf())
    describe(`${engine}: the derived values of every computing item${placeSuffix(place)}`, () => {
      const { host } = widgetBoardFor(engine, place);

      test(
        "re-estimating one work package with the plan untouched sends the Tree's value alone and the plan's finish and critical path as the board shows them",
        async () => {
          const run = await host(dist, uj2ExpandedBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const answerButton = board.view
            .locator(`[data-askboard-question="${wbsQuestion.id}"]`)
            .getByRole("button", { name: "Answer", exact: true });
          await tabUntil(board, async () => (await treeFocus(board)) !== undefined, "the Tree");
          // `ux`: most likely, 5 to 4; nothing else.
          await expectSteps(run, tree, [
            ["ArrowDown", { nodeId: "ux" }],
            ["ArrowRight", { nodeId: "ux", cell: 0 }],
            ["ArrowRight", { nodeId: "ux", cell: 1 }],
            ["ArrowRight", { nodeId: "ux", cell: 2 }],
          ]);
          await enterField(run, tree, "4", { nodeId: "ux", cell: 2 });
          const facts = await shown(ganttOf(board, wbsPlan.id));
          await tabUntil(board, () => isFocused(answerButton), "Answer");
          await board.page.keyboard.press("Enter");
          await run.submit?.();
          await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
          await Bun.sleep(QUIET_MS);
          const [answer]: unknown[] = run.messages.filter((message) => message.type === "answer");
          const { values, derived } = answer as {
            values: Record<string, unknown>;
            derived: Record<string, unknown>;
          };
          expect(Object.keys(values)).toEqual([wbsTree.id]);
          expect(derived[`${wbsPlan.id}.finish`]).toBe(facts.finish);
          expect(derived[`${wbsPlan.id}.criticalPath`]).toEqual(facts.criticalPath);
          if (run.logged !== undefined) {
            const [logged] = await run.logged();
            expect(logged?.derived).toMatchObject({
              "schedule.finish": facts.finish,
              "schedule.criticalPath": facts.criticalPath,
            });
          }
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "an option picked beside an untouched plan carries the plan's derived values and no values",
        async () => {
          const run = await host(dist, withOptions as never);
          await readyIn(run);
          const { board } = run;
          const facts = await shown(ganttOf(board, planGantt.id));
          await board.view.getByRole("radio", { name: "Keep the plan" }).click();
          await board.answer.click();
          await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
          const [answer]: unknown[] = run.messages.filter((message) => message.type === "answer");
          expect(answer).toEqual({
            type: "answer",
            itemId: planQuestion.id,
            rev: planQuestion.rev,
            choice: ["Keep the plan"],
            derived: expect.objectContaining({
              [`${planGantt.id}.finish`]: facts.finish,
              [`${planGantt.id}.criticalPath`]: facts.criticalPath,
            }),
            when: expect.any(String),
          });
          expect(Object.hasOwn(answer as object, "values")).toBe(false);
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    });
}
