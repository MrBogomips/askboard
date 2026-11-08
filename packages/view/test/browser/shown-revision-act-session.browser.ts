// An answer carries what the card shows, on the real board page and the session process, in each
// engine (document-review, task 6.10; Issue #93; spec view-and-widgets: An answer carries what the
// card shows; design decision 15): the user sets a result on each of two TextFields, the agent's
// `update` removes one, "Keep mine" with no reload keeps the card on revision 1, and "Answer" sends
// both results naming revision 1, which `ask-core` logs, refusing nothing (NFR-10, AD-10).
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-act-session.browser.ts

import { describe, expect, test } from "bun:test";
import { kanbanAsk } from "./fixtures/kanban-documents.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
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
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const fieldA = { type: "text-field", id: "a", props: { label: "First" } };
const fieldB = { type: "text-field", id: "b", props: { label: "Second" } };
const askWith = (items: readonly unknown[]) => ({
  ...kanbanAsk,
  items: [{ ...kanbanAsk.items[0], props: { ...kanbanAsk.items[0].props, items } }],
});

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an answer carries what the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the agent removes an item that holds a result; Keep mine, Answer: both results go, naming revision 1, and ask-core logs them",
      async () => {
        const run = await start(lifecycleScenario(askWith([fieldA, fieldB]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await board.view.getByLabel("Second", { exact: true }).fill("Grace");
        await eventually(
          () =>
            sentDrafts(run).some(
              (record) =>
                draftHolds([record], "plan", "a", "Ada") &&
                draftHolds([record], "plan", "b", "Grace"),
            ),
          "both fields mirrored to the board page",
        );
        await run.session.update([
          {
            action: "change",
            itemId: "plan",
            props: { ...kanbanAsk.items[0].props, items: [fieldA] },
          },
        ]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice(board).getByRole("button", { name: "Keep mine", exact: true }).click();
        await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.results).toEqual({ a: "Ada", b: "Grace" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
