// The Approval end to end on the real board page, in each engine (approval-scale-ranking, task
// 6.1; spec view-and-widgets: A widget result end to end, A reason the answer requires, Every path
// to an answer checks the reason, Revising a received verdict asks first, A revision keeps the
// widgets' results; design decision 12): a Tree edit beside an Approval, the reason an
// "Approve with changes" requires and its field error, the answer `collect` returns with `results`,
// the note and the Tree's `changes`, a delivered verdict revised only after a confirmation that
// Cancel and Escape leave as it was, a Tree revised beside the verdict it keeps, Decline of a delivered decline
// asking first, and "Accept recommended" taking the same path as "Answer". Immediate delivery; the
// submitted delivery's cases are in `approval-submit.browser.ts`.

import { describe, expect, test } from "bun:test";
import { reviewedAsk } from "./fixtures/approval-asks.ts";
import {
  checkedEvents,
  decisionOf,
  isPressed,
  OPEN_NOTE,
  promptOf,
  REASON,
  REASON_MISSING,
  renameNode,
} from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
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
  buttonOf,
  card,
  chooseFromMore,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
} from "./harness/lifecycle-test.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const PLAN = "plan";
const REVIEW = "review";
const UX = "UX design, reviewed";
const ARCHITECTURE = "Architecture, reviewed";
const WHY = "Show the training as an extra";

const error = (board: Board, id: string) =>
  card(board, id).getByText(REASON_MISSING, { exact: true });
const dialog = (board: Board) => board.view.getByRole("alertdialog");
const delivered = (board: Board, id: string) =>
  card(board, id).getByText("delivered to the agent", { exact: true });

// The plan answered "Approve with changes" with one rename and a reason, collected and delivered.
const answerWithChanges = async (run: Parameters<typeof actsDone>[0], board: Board) => {
  await renameNode(board, "ux", UX);
  await decisionOf(board, PLAN, "Approve with changes").click();
  await promptOf(board, PLAN, REASON).fill(WHY);
  await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
  await actsDone(run, 1);
  const collected = checkedEvents(await run.session.collectJson());
  await delivered(board, PLAN).waitFor({ timeout: STEP_TIMEOUT_MS });
  return collected;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Approval end to end`, () => {
    const { start } = useEngine(engine);

    test(
      "an edit disables Approve; Approve with changes with no reason sends nothing and shows the error, which a deleted reason does not bring back; with a reason, collect returns the result, the note and the Tree's change",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await renameNode(board, "ux", UX);
        await eventually(
          () => decisionOf(board, PLAN, "Approve").isDisabled(),
          "Approve to be disabled",
        );
        await decisionOf(board, PLAN, "Approve with changes").click();
        await promptOf(board, PLAN, REASON).waitFor({ timeout: STEP_TIMEOUT_MS });
        // Pressed with the reason empty: nothing is sent, the error shows, the focus is in the prompt.
        await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
        await error(board, PLAN).waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(promptOf(board, PLAN, REASON)), "focus in the prompt");
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        // Writing the reason clears the error, and deleting it again does not bring it back.
        await promptOf(board, PLAN, REASON).fill(WHY);
        await error(board, PLAN).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await promptOf(board, PLAN, REASON).fill("");
        await Bun.sleep(QUIET_MS / 3);
        expect(await error(board, PLAN).count()).toBe(0);
        await promptOf(board, PLAN, REASON).fill(WHY);
        await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
        const [command] = await actsDone(run, 1);
        expect(command?.acts).toHaveLength(1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: "answer",
          itemId: PLAN,
          note: WHY,
          results: { verdict: { decision: "approve-with-changes" } },
          changes: [{ op: "set", target: "wbs.ux.label", value: UX }],
        });
        await delivered(board, PLAN).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(sentActs(run)).toHaveLength(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a delivered verdict revised asks first: Cancel and Escape send nothing and give the focus back to Answer, confirming sends a revision naming the first answer with the result alone; a Tree renamed after it rides with the kept result",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        const [first] = await answerWithChanges(run, board);
        await decisionOf(board, PLAN, "Reject").click();
        await eventually(() => isPressed(decisionOf(board, PLAN, "Reject")), "Reject to select");
        // Cancel: nothing is sent, Reject is still selected, the focus is on Answer.
        await answerOf(board, PLAN).click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog(board).getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(answerOf(board, PLAN)), "focus back on Answer");
        expect(await isPressed(decisionOf(board, PLAN, "Reject"))).toBe(true);
        // Escape: the same.
        await answerOf(board, PLAN).click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(answerOf(board, PLAN)), "focus back on Answer");
        expect(await isPressed(decisionOf(board, PLAN, "Reject"))).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        // Confirming sends the revision: the Tree was left alone, so its answered edit is carried as
        // the card shows it, and the event holds the result and the Tree's earlier rename, which a
        // revision used to lose (reopen-start-from-answer, A revision keeps the widgets' edits).
        await answerOf(board, PLAN).click();
        await dialog(board).getByRole("button", { name: "Send", exact: true }).click();
        await actsDone(run, 2);
        const [second] = sentActs(run).slice(1);
        expect(second?.acts[0]).toMatchObject({
          type: "answer",
          itemId: PLAN,
          results: { verdict: { decision: "reject" } },
        });
        const carried = second?.acts[0] as unknown as {
          readonly values: {
            readonly wbs: { readonly nodes: readonly { children: readonly { label: string }[] }[] };
          };
        };
        expect(carried.values.wbs.nodes[0]?.children[0]?.label).toBe(UX);
        const revised = checkedEvents(await run.session.collectJson());
        expect(revised).toHaveLength(1);
        expect(revised[0]?.replaces).toBe(first?.cursor);
        expect(revised[0]?.results).toEqual({ verdict: { decision: "reject" } });
        expect(revised[0]?.changes).toEqual([{ op: "set", target: "wbs.ux.label", value: UX }]);
        await delivered(board, PLAN).waitFor({ timeout: STEP_TIMEOUT_MS });
        // Revising a Tree beside the Approval: the revision carries the Tree's change and the
        // seeded result.
        await renameNode(board, "architecture", ARCHITECTURE);
        await answerOf(board, PLAN).click();
        await dialog(board).getByRole("button", { name: "Send", exact: true }).click();
        await actsDone(run, 3);
        const [third] = checkedEvents(await run.session.collectJson());
        expect(third?.replaces).toBe(revised[0]?.cursor);
        expect(third?.results).toEqual({ verdict: { decision: "reject" } });
        expect(third?.changes).toEqual(
          expect.arrayContaining([
            { op: "set", target: "wbs.architecture.label", value: ARCHITECTURE },
          ]),
        );
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Decline chosen again on a delivered decline asks first: cancelled it sends nothing with the focus on the question's More menu button; confirmed it sends the reopen and moves the focus to the heading",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        // The question is answered by declining it: the verdict the agent receives. Decline is
        // disabled on an answered question, so a delivered decline is where it asks.
        await chooseFromMore(board, PLAN, "Decline");
        await actsDone(run, 1);
        await run.session.collect();
        await delivered(board, PLAN).waitFor({ timeout: STEP_TIMEOUT_MS });
        await chooseFromMore(board, PLAN, "Decline");
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog(board).getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(buttonOf(board, PLAN, "More")), "focus on More");
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        await chooseFromMore(board, PLAN, "Decline");
        await dialog(board).getByRole("button", { name: "Send", exact: true }).click();
        const [, reopen] = await actsDone(run, 2);
        expect(reopen?.acts.map((act) => act.type)).toEqual(["reopen"]);
        await eventually(() => isFocused(headingOf(board, PLAN)), "focus on the heading");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Accept recommended with Approve with changes and no reason sends nothing and shows the error; on a delivered answer it asks first and Cancel gives the focus back to it",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        const accept = buttonOf(board, REVIEW, "Accept recommended");
        await decisionOf(board, REVIEW, "Approve with changes").click();
        await promptOf(board, REVIEW, REASON).waitFor({ timeout: STEP_TIMEOUT_MS });
        await accept.click();
        await error(board, REVIEW).waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(promptOf(board, REVIEW, REASON)), "focus in the prompt");
        expect(await optionOf(board, REVIEW, "PostgreSQL").isChecked()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        // A first answer, delivered; then the recommended option asks first.
        await decisionOf(board, REVIEW, "Approve").click();
        await promptOf(board, REVIEW, OPEN_NOTE).waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, REVIEW, "SQLite").click();
        await answerOf(board, REVIEW).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collect();
        await delivered(board, REVIEW).waitFor({ timeout: STEP_TIMEOUT_MS });
        await optionOf(board, REVIEW, "SQLite").click();
        await accept.click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog(board).getByRole("button", { name: "Cancel", exact: true }).click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(accept), "focus back on Accept recommended");
        expect(await optionOf(board, REVIEW, "PostgreSQL").isChecked()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        expect(await treeGridOf(board).grid.count()).toBe(1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
