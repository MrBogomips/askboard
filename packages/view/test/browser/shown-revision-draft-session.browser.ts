// The draft and the confirmation follow the revision the card shows, on the real board page and the
// session process, in each engine (document-review, tasks 6.15 and 6.16; Issues #92 and #93; spec
// view-and-widgets: The draft follows the revision the card shows, The revision confirmation reads
// the revision the card shows; design decision 15). After "Keep mine" with no reload:
// - work held only on an item the agent's revision removed is kept, mirrored and counted as unsent
//   work, survives a change on the board, and "Answer" sends it naming revision 1;
// - after the agent records an answer for the question (its `update` action `answer`), "Answer"
//   asks to confirm the replacement by the Approval the card shows, though revision 2 removed it;
// - "Accept recommended" picks the option revision 1 recommends, though revision 2 recommends
//   another. Decline is not reached: the card disables it on an answered question.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-draft-session.browser.ts

import { describe, expect, test } from "bun:test";
import { database } from "./fixtures/lifecycle-asks.ts";
import { checkedEvents, decisionOf } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  buttonOf,
  card,
  lifecycleScenario,
  menuItem,
  mirrored,
  openBoard,
  promptArmed,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const verdict = { type: "approval", id: "verdict", props: {} };

const planWith = (
  items: readonly unknown[],
  options: readonly unknown[] = database("plan").props.options,
) => ({
  ...database("plan"),
  props: { ...database("plan").props, options, items },
});
const askOf = (id: string, ...items: readonly unknown[]) => ({
  askId: `${id}-draft-s2t3`,
  title: "Order service storage",
  items,
});

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');
const keepMine = async (board: Board): Promise<void> => {
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  await notice(board).getByRole("button", { name: "Keep mine", exact: true }).click();
  await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};
const revise = (
  run: Parameters<typeof actsDone>[0],
  items: readonly unknown[],
  options?: readonly unknown[],
) =>
  run.session.update([{ action: "change", itemId: "plan", props: planWith(items, options).props }]);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the draft follows the revision the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "work only on an item the agent removed: Keep mine, an edit, a change on the board; the card stays on revision 1, the draft mirrors it and counts it as unsent, Answer sends it naming revision 1",
      async () => {
        const ask = askOf(
          "two",
          planWith([field("a", "First"), field("b", "Second")]),
          database("other"),
        );
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan", "other"]);
        const { view } = board;
        await view.getByLabel("Second", { exact: true }).fill("Grace");
        await mirrored(run, (record) => draftHolds([record], "plan", "b", "Grace"), "b: Grace");
        await revise(run, [field("a", "First")]);
        await keepMine(board);
        await view.getByLabel("Second", { exact: true }).fill("Grace Hopper");
        await mirrored(
          run,
          (record) =>
            draftHolds([record], "plan", "b", "Grace Hopper") && record.questions.plan?.rev === 1,
          "b: Grace Hopper under revision 1",
        );
        expect(await promptArmed(board)).toBe(true);
        // A change on the board: the question in view moves on.
        await board.header.getByRole("button", { name: "Next open ↓" }).click();
        await Bun.sleep(QUIET_MS);
        expect(await view.getByLabel("Second", { exact: true }).inputValue()).toBe("Grace Hopper");
        expect(draftHolds(sentDrafts(run), "plan", "b", "Grace Hopper")).toBe(true);
        expect(await promptArmed(board)).toBe(true);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.results).toEqual({ b: "Grace Hopper" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a recorded answer and the recommendation read the revision the card shows`, () => {
    const { start } = useEngine(engine);
    const dialog = (board: Board) => board.view.getByRole("alertdialog");

    test(
      "the agent records an answer after Keep mine, the Approval it removed still asks: Answer waits for the confirmation, Cancel sends nothing, Send names revision 1",
      async () => {
        const ask = askOf("approval", planWith([field("a", "First"), verdict]));
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await decisionOf(board, "plan", "Approve").click();
        await mirrored(
          run,
          (record) => draftHolds([record], "plan", "verdict", { decision: "approve" }),
          "the verdict",
        );
        await revise(run, [field("a", "First")]);
        await keepMine(board);
        await run.session.update([
          { action: "answer", itemId: "plan", answer: { choice: ["SQLite"] } },
        ]);
        await card(board, "plan")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        // Decline is not reached on this path: the card disables it on an answered question.
        await buttonOf(board, "plan", "More").click({ timeout: STEP_TIMEOUT_MS });
        expect(await menuItem(board, "Decline").isDisabled()).toBe(true);
        await board.page.keyboard.press("Escape");
        await decisionOf(board, "plan", "Reject").click();
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        const before = sentActs(run).length;
        await answerOf(board, "plan").click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog(board).getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(before);
        await answerOf(board, "plan").click();
        await dialog(board).getByRole("button", { name: "Send", exact: true }).click();
        await actsDone(run, before + 1);
        const sent = sentActs(run).at(-1)?.acts[0];
        expect(sent).toMatchObject({
          type: "answer",
          itemId: "plan",
          rev: 1,
          results: { verdict: { decision: "reject" } },
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "revision 2 recommends a new option and the user keeps theirs: Accept recommended picks revision 1's recommended option and the answer names revision 1",
      async () => {
        const options: readonly Record<string, unknown>[] = database("plan").props.options;
        const postgres = Object.fromEntries(
          Object.entries(options[0] ?? {}).filter(([key]) => key !== "recommended"),
        );
        const redis = { label: "Redis", description: "In-memory store.", recommended: true };
        const ask = askOf("recommend", planWith([field("a", "First")]));
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await mirrored(run, (record) => draftHolds([record], "plan", "a", "Ada"), "a: Ada");
        await revise(run, [field("a", "First")], [postgres, ...options.slice(1), redis]);
        await keepMine(board);
        await buttonOf(board, "plan", "Accept recommended").click();
        await actsDone(run, 2);
        const answer = sentActs(run)
          .flatMap((command) => command.acts)
          .find((act) => act.type === "answer");
        expect(answer).toMatchObject({ rev: 1, choice: ["PostgreSQL"], results: { a: "Ada" } });
        const events = checkedEvents(await run.session.collectJson());
        expect(events.find((event) => event.type === "answer")).toMatchObject({
          rev: 1,
          choice: ["PostgreSQL"],
        });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
