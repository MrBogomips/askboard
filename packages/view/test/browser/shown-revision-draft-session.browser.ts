// The draft follows the revision the card shows, on the real board page and the session process, in
// each engine (document-review, task 6.15; Issue #93; spec view-and-widgets: The draft follows the
// revision the card shows; design decision 15). After "Keep mine" with no reload, work held only on
// an item the agent's revision removed is kept, mirrored and counted as unsent work, survives a
// change on the board, and "Answer" sends it naming revision 1.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-draft-session.browser.ts

import { describe, expect, test } from "bun:test";
import { database } from "./fixtures/lifecycle-asks.ts";
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
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  promptArmed,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });

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
}
