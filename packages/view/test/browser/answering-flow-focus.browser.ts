// Focus after acts, and focus moves clear of the sticky bars, in each engine (answering-flow-fixes,
// task 2.1; view-and-widgets spec: Focus after Answer and Submit, Focus moves clear the sticky
// bars; #179, #180). At 1280x800, with the board of nine tall questions in three areas: every move
// of focus to a heading leaves the heading wholly between the header's bottom edge and the bottom
// bar's top edge, and "Answer", "Accept recommended", a confirmed revision and Submit leave focus
// on a heading, never on the page. Answers are given with the keyboard: focus, then Space and
// Enter. Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import {
  answeringAsk,
  type Language,
  type Presentation,
  singleAnsweringAsk,
} from "./fixtures/answering-flow-asks.ts";
import { reviewedAsk } from "./fixtures/approval-asks.ts";
import { decisionOf } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  actsSent,
  answerOf,
  barButton,
  buttonOf,
  card,
  headingOf,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
// The cards of the first tab when the board offers tabs, and of one question per view's first view.
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ALL,
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const PLAN = "plan";

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  presentation: Presentation,
  delivery: "immediate" | "submitted" = "immediate",
  language: Language = "en-US",
) => {
  const run = await start(lifecycleScenario(answeringAsk(presentation, language, delivery), dist));
  const board = await openBoard(run, FIRST_VIEW[presentation]);
  return { run, board };
};

const nextOpen = (board: Board): Locator =>
  board.view.getByRole("banner").getByRole("button", { name: /^Next open/ });
const outlineEntry = (board: Board, id: string): Locator =>
  board.view.locator(`[data-askboard-outline="${id}"]`);

type Box = { readonly top: number; readonly bottom: number };
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return { top: box.y, bottom: box.y + box.height };
};

/** The heading has focus and lies wholly between the header's bottom and the bottom bar's top. */
const expectClearOfBars = async (board: Board, id: string): Promise<void> => {
  const heading = headingOf(board, id);
  await eventually(() => isFocused(heading), `focus on the ${id} heading`);
  const bounds = {
    header: await boxOf(board.view.getByRole("banner")),
    bar: await boxOf(board.view.getByRole("contentinfo")),
  };
  // A scroll the move started finishes within a frame or two: wait for the box to settle in place.
  await eventually(async () => {
    const box = await boxOf(heading);
    return box.top >= bounds.header.bottom && box.bottom <= bounds.bar.top;
  }, `the ${id} heading between the header and the bottom bar`);
};

/**
 * Scrolls the page so that the question's heading is half behind a bar, still within the viewport:
 * the case where the browser's own focus scroll leaves it where it is (#180). `bar` puts it behind
 * the bottom bar, `header` behind the header.
 */
const hideBehind = async (board: Board, id: string, bar: "bar" | "header"): Promise<void> => {
  const heading = headingOf(board, id);
  const edge = await boxOf(board.view.getByRole(bar === "bar" ? "contentinfo" : "banner"));
  const box = await boxOf(heading);
  const target = bar === "bar" ? edge.top + 6 : edge.bottom - 6 - (box.bottom - box.top);
  await heading.evaluate((element, delta) => {
    element.ownerDocument.defaultView?.scrollBy(0, delta);
  }, box.top - target);
  await eventually(async () => {
    const now = await boxOf(heading);
    return bar === "bar" ? now.bottom > edge.top : now.top < edge.bottom;
  }, `the ${id} heading behind the ${bar}`);
};

/** Chooses an option and presses "Answer", with the keyboard alone. */
const answerWithKeys = async (board: Board, id: string, label = "Yes"): Promise<void> => {
  await optionOf(board, id, label).focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, label).isChecked(), `${label} chosen on ${id}`);
  await answerOf(board, id).focus();
  await board.page.keyboard.press("Enter");
};

/** The view's focused element is not the page: something in the view has focus. */
const focusOnPage = (board: Board): Promise<boolean> =>
  board.view
    .locator("body")
    .evaluate((body) => body.ownerDocument.activeElement === body.ownerDocument.body);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: focus moves clear of the sticky bars`, () => {
    const { start } = useEngine(engine);

    test(
      "next open to a heading half behind the bottom bar scrolls it clear",
      async () => {
        const { run, board } = await open(start, "sections");
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q1");
        await hideBehind(board, "q2", "bar");
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q2");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "next open that wraps upward lands the first heading below the header",
      async () => {
        const { board } = await open(start, "sections");
        await outlineEntry(board, "q9").click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q9");
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q1");
      },
      TEST_TIMEOUT_MS,
    );

    for (const presentation of ["sections", "tabs"] as const) {
      test(
        `an outline jump in ${presentation} puts a heading half behind a bar between the header and the bottom bar`,
        async () => {
          const { board } = await open(start, presentation);
          await hideBehind(board, "q2", "bar");
          await outlineEntry(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
          await expectClearOfBars(board, "q2");
          await hideBehind(board, "q2", "header");
          await outlineEntry(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
          await expectClearOfBars(board, "q2");
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a next-open jump into another tab activates it and puts the heading between the bars",
      async () => {
        const { board } = await open(start, "tabs");
        await outlineEntry(board, "q3").click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q3");
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q4");
        expect(
          await board.view.getByRole("tab", { name: /Data/ }).getAttribute("aria-selected"),
        ).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: focus after Answer and Submit`, () => {
    const { start } = useEngine(engine);

    for (const presentation of ["sections", "tabs", "one-per-view"] as const) {
      test(
        `Answer in ${presentation} with the keyboard leaves focus on the question's heading`,
        async () => {
          const { run, board } = await open(start, presentation);
          await answerWithKeys(board, "q1");
          await actsSent(run, 1);
          await eventually(() => isFocused(headingOf(board, "q1")), "focus on the q1 heading");
          // One question per view still shows the same question.
          expect(await headingOf(board, "q1").isVisible()).toBe(true);
          expect(await focusOnPage(board)).toBe(false);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "Answer in Italian leaves focus on the heading too",
      async () => {
        const { run, board } = await open(start, "sections", "immediate", "it-IT");
        await optionOf(board, "q1", "Sì").focus();
        await board.page.keyboard.press(" ");
        await card(board, "q1").getByRole("button", { name: "Rispondi", exact: true }).focus();
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "q1")), "focus on the q1 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the last open question: Answer leaves focus on its heading",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        await answerWithKeys(board, "only");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "only")), "focus on the heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Accept recommended sends the answer and leaves focus on the heading",
      async () => {
        const { run, board } = await open(start, "sections");
        await buttonOf(board, "q1", "Accept recommended").focus();
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "q1")), "focus on the q1 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a confirmed revision leaves focus on the heading once the dialog has closed",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("immediate"), dist));
        const board = await openBoard(run, [PLAN, "review"]);
        await decisionOf(board, PLAN, "Approve").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.collectJson();
        await card(board, PLAN)
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await decisionOf(board, PLAN, "Reject").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
        const dialog = board.view.getByRole("alertdialog");
        await dialog.getByRole("button", { name: "Send", exact: true }).click();
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, PLAN)), "focus on the heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "submitted delivery: Answer marks ready and keeps focus; Submit moves focus to the heading of the question in view; Send and switch never drops focus to the page",
      async () => {
        const { run, board } = await open(start, "sections", "submitted");
        await answerWithKeys(board, "q1");
        await eventually(
          async () => ((await outlineEntry(board, "q1").textContent()) ?? "").includes("Ready"),
          "q1 ready",
        );
        expect(await isFocused(answerOf(board, "q1"))).toBe(true);
        expect(await answerOf(board, "q1").isEnabled()).toBe(true);
        await answerWithKeys(board, "q2");
        await eventually(
          async () => ((await outlineEntry(board, "q2").textContent()) ?? "").includes("Ready"),
          "q2 ready",
        );
        await barButton(board, "Submit").focus();
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        // The heading of the question in view; the first question when none is set.
        const current = outlineEntry(board, "q1").or(outlineEntry(board, "q2"));
        const inView =
          (await current.evaluateAll((entries) =>
            entries
              .find((entry) => entry.getAttribute("aria-current") === "true")
              ?.getAttribute("data-askboard-outline"),
          )) ?? "q1";
        await eventually(
          () => isFocused(headingOf(board, inView)),
          `focus on the ${inView} heading`,
        );
        expect(await focusOnPage(board)).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send and switch leaves focus on the Immediate button",
      async () => {
        const { run, board } = await open(start, "sections", "submitted");
        await answerWithKeys(board, "q1");
        await eventually(
          async () => ((await outlineEntry(board, "q1").textContent()) ?? "").includes("Ready"),
          "q1 ready",
        );
        await barButton(board, "Immediate").click({ timeout: STEP_TIMEOUT_MS });
        await board.view
          .getByRole("alertdialog")
          .getByRole("button", { name: "Send and switch", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await board.view.getByRole("alertdialog").waitFor({
          state: "detached",
          timeout: STEP_TIMEOUT_MS,
        });
        await eventually(
          () => isFocused(barButton(board, "Immediate")),
          "focus on the Immediate button",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Send and switch through the replace dialog leaves focus on the Immediate button, not on the page",
      async () => {
        const run = await start(lifecycleScenario(reviewedAsk("submitted"), dist));
        const board = await openBoard(run, [PLAN, "review"]);
        const markReady = async (decision: string) => {
          await decisionOf(board, PLAN, decision).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, PLAN).click({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => (await outlineEntry(board, PLAN).textContent())?.includes("Ready") === true,
            `${PLAN} ready`,
          );
        };
        await markReady("Approve");
        await barButton(board, "Submit").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await markReady("Reject");
        await run.session.collect();
        await card(board, PLAN)
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await barButton(board, "Immediate").click({ timeout: STEP_TIMEOUT_MS });
        const dialog = board.view.getByRole("alertdialog");
        await dialog
          .getByRole("button", { name: "Send and switch", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await dialog
          .getByText("Send new answers?", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await dialog
          .getByRole("button", { name: "Submit", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        await eventually(
          () => isFocused(barButton(board, "Immediate")),
          "focus on the Immediate button",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "focus the user moved meanwhile stays where it is once the receipt shows sent",
      async () => {
        const { board } = await open(start, "sections");
        await answerWithKeys(board, "q1");
        await noteOf(board, "q2").focus();
        await card(board, "q1")
          .getByText("sent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(noteOf(board, "q2"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
