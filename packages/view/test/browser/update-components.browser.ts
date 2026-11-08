// Live updates must load new component types without rebuilding the view or losing unrelated
// drafts, and a new item of an already loaded type must become ready in its existing question.
import { describe, expect, test } from "bun:test";
import { CHART_FIXTURE_ITEMS } from "@askboard/contract/fixtures";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { actsDone, answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const ask = {
  askId: "update-components",
  items: [
    {
      type: "question",
      id: "keep",
      props: { text: "Keep this draft", items: [field("kept", "Existing draft")] },
    },
    { type: "question", id: "review", props: { text: "Review", options: [{ label: "Yes" }] } },
  ],
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: components introduced by an update`, () => {
    const { start } = useEngine(engine);
    test(
      "new fields and charts render, answers reach the agent, and unrelated work stays",
      async () => {
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["keep", "review"]);
        const frame = await board.viewFrame();
        await board.view
          .getByRole("textbox", { name: "Existing draft", exact: true })
          .fill("Unsent work");
        await run.session.update([
          { action: "change", itemId: "review", props: { items: [field("added", "Added field")] } },
        ]);
        const added = board.view.getByRole("textbox", { name: "Added field", exact: true });
        await added.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await added.fill("User's answer");
        await answerOf(board, "review").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const result = await run.session.collect();
        expect(result.events.at(-1)).toMatchObject({
          type: "answer",
          results: { added: "User's answer" },
        });

        await run.session.update([
          {
            action: "add",
            item: {
              type: "question",
              id: "chart-review",
              props: { text: "Read the new chart", items: [CHART_FIXTURE_ITEMS[0]] },
            },
          },
        ]);
        await board
          .question("chart-review")
          .locator("canvas")
          .first()
          .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await board.viewFrame()).toBe(frame);
        expect(
          await board.view
            .getByRole("textbox", { name: "Existing draft", exact: true })
            .inputValue(),
        ).toBe("Unsent work");
        expect(await board.view.getByRole("alert").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
