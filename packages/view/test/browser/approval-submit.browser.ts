// The Approval in submitted delivery on the real board page, in each engine (approval-scale-
// ranking, task 6.1; spec view-and-widgets: Every path to an answer checks the reason, Submit asks
// before replacing a received verdict; design decisions 6 and 12): "Select recommended" leaving a
// question that lacks its reason unmarked; Submit asking when a revision marked while its receipt
// read "sent" has since been delivered, its Cancel and its confirmation; "Send and switch" asking
// the same; a held answer whose reason is gone, seeded through a draft restore since the board can
// no longer reach that state, sending nothing from Submit and from "Send and switch" and taking the
// focus to its prompt; an agent update arriving while the confirmation is open; and a very long
// question text in the confirmation. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { reviewedAsk, reviewedOnePerViewAsk, reviewQuestion } from "./fixtures/approval-asks.ts";
import { decisionOf, promptOf, REASON, REASON_MISSING } from "./harness/approval-board.ts";
import {
  type BoardRun,
  eventually,
  expectNoCspProblem,
  isFocused,
  QUIET_MS,
  reloadBoard,
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
  sentActs,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const PLAN = "plan";
const REVIEW = "review";
const WHY = "Show the training as an extra";

const dialog = (board: Board) => board.view.getByRole("alertdialog");
const dialogButton = (board: Board, name: string) =>
  dialog(board).getByRole("button", { name, exact: true });
const submit = (board: Board) => barButton(board, "Submit");
const held = async (board: Board, id: string): Promise<boolean> =>
  (await answerOf(board, id).getAttribute("aria-pressed")) === "true";

// Marks the question ready with `decision` (and an option for the review), then waits for it.
const markReady = async (board: Board, id: string, decision: string): Promise<void> => {
  if (id === REVIEW) await optionOf(board, id, "SQLite").click();
  await decisionOf(board, id, decision).click();
  await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
  await eventually(() => held(board, id), `${id} to be marked ready`);
};

// A revision held for Submit over an answer the agent has received: the first answer is submitted
// and its receipt reads "sent"; the revision is marked ready with no question asked; then the
// agent collects, which turns the receipt to delivered. Submit has not been pressed since.
const heldOverDelivered = async (run: BoardRun, board: Board, id: string): Promise<void> => {
  await markReady(board, id, "Approve");
  await submit(board).click();
  await actsDone(run, 1);
  await card(board, id).getByText("sent", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await markReady(board, id, "Reject");
  expect(await dialog(board).count()).toBe(0);
  await run.session.collect();
  await card(board, id)
    .getByText("delivered to the agent", { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
};

// Seeds the state the board can no longer reach: the review's held "Approve with changes" whose
// draft lost its note. The page's draft record goes through the server unchanged, then the page
// is reloaded through a socket that hands it the stored record without the note.
const seedLostReason = async (run: BoardRun, board: Board): Promise<void> => {
  await optionOf(board, REVIEW, "SQLite").click();
  await decisionOf(board, REVIEW, "Approve with changes").click();
  await promptOf(board, REVIEW, REASON).fill(WHY);
  await answerOf(board, REVIEW).click({ timeout: STEP_TIMEOUT_MS });
  await eventually(() => held(board, REVIEW), "the review to be marked ready");
  await mirrored(
    run,
    (record) =>
      record.questions[REVIEW]?.held !== undefined && record.questions[REVIEW]?.note === WHY,
    "the held answer with its reason",
  );
  await board.page.routeWebSocket(/.*/, (page) => {
    const server = page.connectToServer();
    page.onMessage((message) => server.send(message));
    server.onMessage((message) => page.send(withoutNote(message)));
  });
  await reloadBoard(board, run, () =>
    board.view
      .locator(`[data-askboard-question="${REVIEW}"]:not([aria-busy="true"])`)
      .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
  );
  await eventually(() => held(board, REVIEW), "the held answer to come back");
  expect(await promptOf(board, REVIEW, REASON).inputValue()).toBe("");
};

// The draft record of a message from the server with the review's note taken out; anything else as is.
const withoutNote = (message: string | Buffer): string | Buffer => {
  if (typeof message !== "string") return message;
  const parsed = JSON.parse(message) as {
    type?: string;
    record?: { questions?: Record<string, { note?: string }> };
  };
  const entry = parsed.record?.questions?.[REVIEW];
  if (parsed.type !== "draft" || entry === undefined) return message;
  delete entry.note;
  return JSON.stringify(parsed);
};

// The prompt with its error: the focus is in it and the field error shows under it.
const expectAskedForReason = async (board: Board): Promise<void> => {
  await card(board, REVIEW)
    .getByText(REASON_MISSING, { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await eventually(
    () => isFocused(promptOf(board, REVIEW, REASON)),
    "focus in the review's prompt",
  );
};

// One question per view, the review held with its reason gone while the plan is the one shown: the
// review's card is mounted but hidden (spec review U-1 of group 6).
const seedLostReasonOffScreen = async (run: BoardRun, board: Board): Promise<void> => {
  const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
  const at = (position: number) =>
    navigator
      .getByText(`Question ${position} of 2`, { exact: true })
      .waitFor({ timeout: STEP_TIMEOUT_MS });
  await markReady(board, PLAN, "Approve");
  await navigator.getByRole("button", { name: "Next", exact: true }).click();
  await at(2);
  await seedLostReason(run, board);
  // The reload keeps the review shown: go back to the plan, leaving the review mounted but hidden.
  await at(2);
  await navigator.getByRole("button", { name: "Previous", exact: true }).click();
  await at(1);
  expect(await card(board, REVIEW).isVisible()).toBe(false);
};

// Both answers are still held, read from the draft record the page mirrors (the plan's card is
// hidden, so the page's own buttons cannot be asked).
const expectBothStillHeld = (run: BoardRun): Promise<unknown> =>
  mirrored(
    run,
    (record) =>
      record.questions[PLAN]?.held !== undefined && record.questions[REVIEW]?.held !== undefined,
    "both answers held",
  );

// The review is the question shown, and its prompt holds the focus with the error.
const expectReviewShownAndAsked = async (board: Board): Promise<void> => {
  const navigator = board.view.getByRole("navigation", { name: "Question navigator" });
  await navigator
    .getByText("Question 2 of 2", { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(await card(board, REVIEW).isVisible()).toBe(true);
  await expectAskedForReason(board);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Approval in submitted delivery`, () => {
    const { start } = useEngine(engine);

    test(
      "Select recommended selects the recommended option but leaves a question lacking its reason unmarked",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await decisionOf(board, REVIEW, "Approve with changes").click();
        await promptOf(board, REVIEW, REASON).waitFor({ timeout: STEP_TIMEOUT_MS });
        await barButton(board, "Select recommended").click();
        await eventually(() => optionOf(board, REVIEW, "PostgreSQL").isChecked(), "PostgreSQL");
        await Bun.sleep(QUIET_MS);
        expect(await held(board, REVIEW)).toBe(false);
        expect(await submit(board).isDisabled()).toBe(true);
        expect(sentActs(run)).toEqual([]);
        // With the reason written, Answer marks it ready as before.
        await promptOf(board, REVIEW, REASON).fill(WHY);
        await answerOf(board, REVIEW).click();
        await eventually(() => held(board, REVIEW), "the review to be marked ready");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Submit over a verdict delivered since it was marked asks first, naming the question: Cancel keeps it held with the focus on Submit, confirming sends the command",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await heldOverDelivered(run, board, PLAN);
        await submit(board).click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog(board).getByText("Send new answers?", { exact: true }).waitFor();
        expect(await dialog(board).getByRole("listitem").allTextContents()).toEqual(["Plan"]);
        await dialogButton(board, "Cancel").click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(submit(board)), "focus back on Submit");
        expect(await held(board, PLAN)).toBe(true);
        expect(await submit(board).isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        await submit(board).click();
        await dialogButton(board, "Submit").click();
        const [, command] = await actsDone(run, 2);
        expect(command?.acts).toMatchObject([
          { type: "answer", itemId: PLAN, results: { verdict: { decision: "reject" } } },
        ]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send and switch with a delivered verdict held asks as Submit does: Cancel keeps submitted delivery and every act held with the focus on Submit, confirming sends and then switches",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await heldOverDelivered(run, board, PLAN);
        await barButton(board, "Immediate").click();
        await dialogButton(board, "Send and switch").click();
        await dialog(board).getByText("Send new answers?", { exact: true }).waitFor();
        await dialogButton(board, "Cancel").click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(submit(board)), "focus back on Submit");
        expect(await barButton(board, "Submitted").getAttribute("aria-pressed")).toBe("true");
        expect(await held(board, PLAN)).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        await barButton(board, "Immediate").click();
        await dialogButton(board, "Send and switch").click();
        await dialogButton(board, "Submit").click();
        await actsDone(run, 2);
        await eventually(
          async () => (await barButton(board, "Immediate").getAttribute("aria-pressed")) === "true",
          "immediate delivery",
        );
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Submit with a held answer whose reason is gone sends nothing, keeps the acts held and takes the focus to that question's prompt with the error",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await markReady(board, PLAN, "Approve");
        await seedLostReason(run, board);
        await submit(board).click();
        await expectAskedForReason(board);
        expect(await dialog(board).count()).toBe(0);
        expect(await held(board, PLAN)).toBe(true);
        expect(await held(board, REVIEW)).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send and switch with a held answer whose reason is gone sends nothing: the board stays in submitted delivery with every act held and the focus in that question's prompt with the error",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await markReady(board, PLAN, "Approve");
        await seedLostReason(run, board);
        await barButton(board, "Immediate").click();
        await dialogButton(board, "Send and switch").click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await expectAskedForReason(board);
        expect(await barButton(board, "Submitted").getAttribute("aria-pressed")).toBe("true");
        expect(await held(board, PLAN)).toBe(true);
        expect(await held(board, REVIEW)).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: Submit with a held answer whose reason is gone, on a question not shown, brings it into view with the error and the focus in its prompt, and sends nothing",
      async () => {
        const run = await start(lifecycleScenario(reviewedOnePerViewAsk(), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await seedLostReasonOffScreen(run, board);
        await submit(board).click();
        await expectReviewShownAndAsked(board);
        expect(await dialog(board).count()).toBe(0);
        await expectBothStillHeld(run);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: Send and switch with a lost reason on a question not shown brings it into view with the error and the focus in its prompt, sends nothing and stays in submitted delivery",
      async () => {
        const run = await start(lifecycleScenario(reviewedOnePerViewAsk(), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await seedLostReasonOffScreen(run, board);
        await barButton(board, "Immediate").click();
        await dialogButton(board, "Send and switch").click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await expectReviewShownAndAsked(board);
        expect(await barButton(board, "Submitted").getAttribute("aria-pressed")).toBe("true");
        await expectBothStillHeld(run);
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent update to a held question while Submit's confirmation is open disables its Submit and sends nothing",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await heldOverDelivered(run, board, PLAN);
        // The review is held too, still open: the agent can change it.
        await markReady(board, REVIEW, "Approve");
        await submit(board).click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.update([
          {
            action: "change",
            itemId: REVIEW,
            props: { text: "Which database should the order service use now?" },
          },
        ]);
        await eventually(() => dialogButton(board, "Submit").isDisabled(), "its Submit to wait");
        await dialogButton(board, "Submit").click({ force: true });
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);
        await dialogButton(board, "Cancel").click();
        await dialog(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await held(board, PLAN)).toBe(true);
        expect(await held(board, REVIEW)).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question text of 5,000 characters is one line with an ellipsis in Submit's confirmation, and Submit and Cancel stay within the viewport",
      async () => {
        const text = "A question the agent wrote very long indeed ".repeat(120).slice(0, 5000);
        expect(reviewQuestion(text).props.text).toHaveLength(5000);
        const run = await start(lifecycleScenario(reviewedAsk("submitted", text), dist));
        const board = await openBoard(run, [PLAN, REVIEW]);
        await heldOverDelivered(run, board, REVIEW);
        await submit(board).click();
        await dialog(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const label = dialog(board).getByRole("listitem").locator("span");
        expect(await label.getAttribute("title")).toBe(text);
        const shape = await label.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            ellipsis: style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap",
            oneLine: element.getBoundingClientRect().height < 2 * parseFloat(style.lineHeight),
            cut: element.scrollWidth > element.clientWidth,
          };
        });
        expect(shape).toEqual({ ellipsis: true, oneLine: true, cut: true });
        const viewport = board.page.viewportSize();
        for (const name of ["Submit", "Cancel"]) {
          const box = await dialogButton(board, name).boundingBox();
          expect(box).not.toBeNull();
          expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
          expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
        }
        await dialogButton(board, "Cancel").click();
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
