// UJ-2 with the five editing features of widget-editing-plus, in each engine, on the widget host
// and on the real board page (task 6.1; view spec, "Gantt task column resize", "Gantt critical
// path switch", "Gantt plan duration resize", "Tree bulk percentage adjustment panel" and "Tree
// drag has a keyboard path and is a change"): on the fixture plan the user widens the TASK column,
// switches the critical path off, lengthens the portal's bar, raises the billing's estimates by 10%
// and drags `reporting` before `billing`, then presses "Answer". The column and the switch are view
// state and leave nothing in the answer; the answer holds the plan's one `set` of a duration, the
// Tree's `set` operations and its one `move`, and validates as the edited values of the output
// format's answer event.

import { describe, expect, test } from "bun:test";
import { elementChanges, GANTT_PLAN_SHAPE, TREE_SHAPE } from "@askboard/contract";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import { validateGanttProps, validateTreeProps } from "@askboard/contract/validate";
import { WEEK_PX } from "./fixtures/gantt-documents.ts";
import { dragBy, endPoint } from "./fixtures/gantt-input.ts";
import { chooseWeek, planGantt, planQuestion, planTree } from "./fixtures/gantt-plan.ts";
import { counterText, ganttOf } from "./fixtures/gantt-view.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { dragDrop, ZONE } from "./harness/tree-drag.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { placeSuffix, placesOf, widgetBoardFor } from "./harness/widget-board.ts";

const dist = await readViewBuild();

// The portal's bar ends on Thursday 12/3; three working days later is Tuesday 12/8.
const THREE_WORKING_DAYS = 5 * WEEK_PX;
const COLUMN_STEP_PX = 60;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const place of placesOf())
    describe(`${engine}: UJ-2 with the five editing features${placeSuffix(place)}`, () => {
      const { host } = widgetBoardFor(engine, place);

      test(
        "widen the column, switch the critical path off, resize a bar, adjust by percent and drag a row, then Answer: one answer with the duration's set, the Tree's sets and a move, and nothing of the view state",
        async () => {
          const run = await host(dist, ganttPlanBoardDocument);
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const gantt = ganttOf(board, planGantt.id);
          await chooseWeek(gantt);

          // View state: the TASK column and the critical path switch.
          const header = gantt.root.locator('th[scope="col"]').first();
          const before = (await header.boundingBox())?.width ?? 0;
          const edge = await gantt.root
            .getByRole("separator", { name: "Resize the Task column" })
            .boundingBox();
          if (edge === null) throw new Error("the TASK column has no edge");
          await dragBy(
            board,
            { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 },
            COLUMN_STEP_PX,
          );
          await eventually(
            async () => Math.round(((await header.boundingBox())?.width ?? 0) - before) > 0,
            "the column to widen",
            STEP_TIMEOUT_MS,
          );
          const critical = gantt.root.getByRole("switch", { name: "Critical path" });
          await critical.click();
          expect(await critical.getAttribute("aria-checked")).toBe("false");
          expect(await counterText(gantt)).toBe("No changes");
          expect(await board.answer.isDisabled()).toBe(true);

          // The bar of the portal, three working days longer: a requested duration of 16.
          await dragBy(board, await endPoint(gantt, "portal"), THREE_WORKING_DAYS);
          await eventually(
            async () =>
              ((await gantt.cell("portal", "duration").textContent()) ?? "").includes("16 d"),
            "the portal's duration to read 16 d",
            STEP_TIMEOUT_MS,
          );

          // The billing's estimates, plus 10% in one adjustment.
          await tree.row("billing").locator("[data-select]").click();
          await tree.tool("Adjust by %…").click();
          const panel = board.view.getByRole("dialog");
          await panel.getByLabel("Percentage").fill("+10");
          await panel.getByRole("button", { name: "Apply" }).click();
          await panel.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });

          // A drag of `reporting` to the top of `billing`.
          await dragDrop(board, tree, "reporting", "billing", ZONE.before);
          await eventually(
            async () => (await tree.marks("moved").count()) === 1,
            "the move to be marked",
            STEP_TIMEOUT_MS,
          );

          // The switch is still off after the edits.
          expect(await critical.getAttribute("aria-checked")).toBe("false");
          await board.answer.click({ timeout: STEP_TIMEOUT_MS });
          await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
          const answers = run.messages.filter((message) => message.type === "answer");
          expect(answers).toHaveLength(1);
          const [answer] = answers;
          if (answer?.type !== "answer") throw new Error("no answer message");
          expect(answer.itemId).toBe(planQuestion.id);
          const values = answer.values ?? {};
          // Only the two elements' edited values: no column width, no switch.
          expect(Object.keys(values).sort()).toEqual([planGantt.id, planTree.id].sort());
          const wbs = validateTreeProps(values[planTree.id], "edited");
          const schedule = validateGanttProps(values[planGantt.id], "edited");
          if (!wbs.ok || !schedule.ok)
            throw new Error("the answer's values do not validate as edited");
          expect(
            elementChanges(planGantt.id, planGantt.props, schedule.value, GANTT_PLAN_SHAPE),
          ).toEqual([{ op: "set", target: "schedule.portal.duration", value: 16 }]);
          const treeChanges = elementChanges(planTree.id, planTree.props, wbs.value, TREE_SHAPE);
          const moves = treeChanges.filter(({ op }) => op === "move");
          expect(moves).toHaveLength(1);
          expect(moves[0]).toMatchObject({ target: `${planTree.id}.reporting`, parent: "build" });
          const sets = treeChanges.filter(({ op }) => op === "set");
          expect(sets.length).toBeGreaterThan(0);
          for (const change of sets)
            expect(change).toMatchObject({ target: expect.stringMatching(/^wbs\.billing\./) });
          expect(answer.derived).toEqual(expect.any(Object));
          if (run.logged !== undefined) {
            const [logged] = await run.logged();
            expect(logged?.changes).toHaveLength(treeChanges.length + 1);
          }
          expect(run.browser.errors).toEqual([]);
          expect(run.browser.cspProblems()).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    });
}
