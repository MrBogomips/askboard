// The wiring of the revision the card shows, on the real board page and the session process, in each
// engine (document-review, task 6.22; Issues #92, #93 and #100; spec view-and-widgets: The items
// follow the revision the card shows; design decision 15, Appendix rows 13, 26 and 43). Each case
// fails when the call site it pins is changed, which no unit test sees (re-review 6.20, S-1, S-2):
// - "Reload, losing my work" on a question whose revision added a TextField: the field shows, takes
//   text and "Answer" names the current revision with it (the ready tracker follows the board's
//   work: `connectTracker` in the shell);
// - "Start from my previous answer" after "Keep mine" seeds the revision the card shows, so a result
//   for an item only that revision holds comes back into the draft;
// - "Select recommended" shows by the recommendation the cards show, not the agent's latest.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-wiring-session.browser.ts

import { describe, expect, test } from "bun:test";
import { database, plain } from "./fixtures/lifecycle-asks.ts";
import { planAsk } from "./fixtures/widget-asks.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  optionOf,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const [plan] = planAsk.items;

// The question `plan` of the UJ-2 ask with fields in place of its items, and a later revision of it.
const askWith = (id: string, ...items: readonly unknown[]) => ({
  ...planAsk,
  askId: `${id}-wiring-v6w7`,
  items: [{ ...plan, props: { ...plan.props, items } }],
});
const revise = (run: Parameters<typeof actsDone>[0], items: readonly unknown[]) =>
  run.session.update([
    { action: "change", itemId: "plan", props: { ...plan.props, items } as unknown },
  ]);

const notice = (board: Board, id = "plan") =>
  card(board, id).locator('[data-askboard-notice="agent-change"]');
const choose = async (board: Board, name: "Keep mine" | "Reload, losing my work", id = "plan") => {
  await notice(board, id).waitFor({ timeout: STEP_TIMEOUT_MS });
  await notice(board, id).getByRole("button", { name, exact: true }).click({
    timeout: STEP_TIMEOUT_MS,
  });
  await notice(board, id).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the wiring of the revision the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the agent added a TextField to a question holding work and the user reloads: the field shows, takes text and Answer names revision 2 with it",
      async () => {
        const run = await start(lifecycleScenario(askWith("reload", field("a", "First")), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await mirrored(run, (record) => record.questions.plan?.results?.a === "Ada", "a: Ada");
        await revise(run, [field("a", "First"), field("d", "Added")]);
        await choose(board, "Reload, losing my work");
        const added = board.view.getByLabel("Added", { exact: true });
        await added.waitFor({ timeout: STEP_TIMEOUT_MS });
        await added.fill("Dee");
        await mirrored(run, (record) => record.questions.plan?.results?.d === "Dee", "d: Dee");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:2",
        ]);
        expect(events[1]?.results).toEqual({ d: "Dee" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Start from my previous answer after Keep mine seeds the revision the card shows: the result of an item only that revision holds comes back",
      async () => {
        const items = [field("a", "First"), field("b", "Second"), field("c", "Third")];
        const run = await start(lifecycleScenario(askWith("previous", ...items), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await board.view.getByLabel("Second", { exact: true }).fill("Bo");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        // The agent reopens the question: revision 2, the answer kept as the previous one.
        await run.session.update([{ action: "reopen", itemId: "plan" }]);
        const reopened = card(board, "plan").locator('[data-askboard-notice="reopened"]');
        await reopened.waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByLabel("Third", { exact: true }).fill("Cy");
        await mirrored(
          run,
          (record) => record.questions.plan?.rev === 2 && record.questions.plan.results?.c === "Cy",
          "c: Cy on revision 2",
        );
        // Revision 3 drops the field `b`: the card keeps showing revision 2, which holds it.
        await revise(run, [field("a", "First"), field("c", "Third")]);
        await choose(board, "Keep mine");
        expect(await board.view.getByLabel("Second", { exact: true }).count()).toBe(1);
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click({
          timeout: STEP_TIMEOUT_MS,
        });
        await mirrored(
          run,
          (record) => record.questions.plan?.results?.b === "Bo",
          "b: Bo, from the previous answer",
        );
        const held = sentDrafts(run).at(-1)?.questions.plan;
        expect(held?.rev).toBe(2);
        expect(held?.results).toMatchObject({ a: "Ada", b: "Bo" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    const twoQuestions = (id: string, first: unknown) => ({
      askId: `${id}-wiring-v6w7`,
      title: "Which revision recommends",
      items: [first, plain("cache", "Should the order service cache reads?", "Cache")],
    });

    test(
      "Select recommended shows while the revision the card keeps recommends, though the agent's latest does not",
      async () => {
        const [first] = [database()];
        const run = await start(lifecycleScenario(twoQuestions("kept", first), dist));
        const board = await openBoard(run, ["database", "cache"]);
        await optionOf(board, "database", "SQLite").click();
        await mirrored(
          run,
          (record) => record.questions.database?.values?.database !== undefined,
          "the choice",
        );
        expect(await barButton(board, "Select recommended").count()).toBe(1);
        const options = first.props.options.map(({ recommended: _, ...option }) => option);
        await run.session.update([
          {
            action: "change",
            itemId: "database",
            props: { ...first.props, text: "Which database, from next quarter?", options },
          },
        ]);
        await notice(board, "database").waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "Keep mine", "database");
        await Bun.sleep(QUIET_MS);
        expect(await barButton(board, "Select recommended").count()).toBe(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended stays hidden while the revision the card keeps recommends nothing, though the agent's latest does",
      async () => {
        const first = plain("cache", "Should the order service cache reads?", "Cache");
        const ask = {
          askId: "latest-wiring-v6w7",
          title: "Which revision recommends",
          items: [first, plain("audit", "Should every order change be audited?", "Audit")],
        };
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["cache", "audit"]);
        await optionOf(board, "cache", "No").click();
        await mirrored(
          run,
          (record) => record.questions.cache?.values?.cache !== undefined,
          "the choice",
        );
        expect(await barButton(board, "Select recommended").count()).toBe(0);
        const options = first.props.options.map((option) =>
          option.label === "Yes" ? { ...option, recommended: true } : option,
        );
        await run.session.update([
          {
            action: "change",
            itemId: "cache",
            props: { ...first.props, text: "Should reads be cached, from next quarter?", options },
          },
        ]);
        await notice(board, "cache").waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "Keep mine", "cache");
        await Bun.sleep(QUIET_MS);
        expect(await barButton(board, "Select recommended").count()).toBe(0);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
