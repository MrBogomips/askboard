// The question in view follows scrolling and focus, in each engine (answering-flow-fixes, task 3.1;
// view-and-widgets spec: The question in view, Counts and the next-open jump, Outline navigator;
// #181). At 1280x800, with the board of nine tall questions in three areas: the outline's current
// mark, "Next open" and Submit's focus all read the one question in view. The page is scrolled with
// `window.scrollTo` inside the view, and each wait is on the outline's `aria-current`. Every
// scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { answeringAsk, type Presentation } from "./fixtures/answering-flow-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  barButton,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentDrafts,
  userScrollBy,
  viewportBottom,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"],
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  presentation: Presentation,
  delivery: "immediate" | "submitted" = "immediate",
) => {
  const run = await start(lifecycleScenario(answeringAsk(presentation, "en-US", delivery), dist));
  const board = await openBoard(run, FIRST_VIEW[presentation]);
  return { run, board };
};

const outlineEntry = (board: Board, id: string): Locator =>
  board.view.locator(`[data-askboard-outline="${id}"]`);
const nextOpen = (board: Board): Locator =>
  board.view.getByRole("banner").locator("[data-askboard-next-to-do]");

/** The outline entries marked current, by question ID. */
const currentMarks = (board: Board): Promise<string[]> =>
  board.view
    .locator("[data-askboard-outline]")
    .evaluateAll((entries) =>
      entries
        .filter((entry) => entry.getAttribute("aria-current") === "true")
        .map((entry) => entry.getAttribute("data-askboard-outline") ?? ""),
    );

const expectCurrent = (board: Board, id: string): Promise<void> =>
  eventually(async () => {
    const marks = await currentMarks(board);
    return marks.length === 1 && marks[0] === id;
  }, `${id} the only entry marked current`);

type Box = { readonly top: number; readonly bottom: number };
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return { top: box.y, bottom: box.y + box.height };
};

const scrollBy = userScrollBy;

/** Scrolls so that the question's card crosses the reading line, a third down the band. */
const scrollToLine = async (board: Board, id: string): Promise<void> => {
  const header = await boxOf(board.view.getByRole("banner"));
  const bar = { top: await viewportBottom(board) };
  const line = header.bottom + (bar.top - header.bottom) / 3;
  const card = await boxOf(board.question(id));
  await scrollBy(board, card.top - (line - 20));
};

const scrollToEnd = (board: Board): Promise<void> =>
  board.view.locator("body").evaluate((body) => {
    const win = body.ownerDocument.defaultView;
    win?.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, bubbles: true, cancelable: true }));
    win?.scrollTo(0, body.ownerDocument.documentElement.scrollHeight);
  });

const scrollTop = (board: Board): Promise<number> =>
  board.view.locator("body").evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? -1);

/** Takes focus off every card, as a user who has only scrolled has it. */
const blurCards = (board: Board): Promise<void> =>
  board.view.locator("body").evaluate((body) => {
    const active = body.ownerDocument.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });

const answerWithKeys = async (board: Board, id: string): Promise<void> => {
  await optionOf(board, id, "Yes").focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, "Yes").isChecked(), `Yes chosen on ${id}`);
  await answerOf(board, id).focus();
  await board.page.keyboard.press("Enter");
};

const ADDED = {
  action: "add",
  parentId: "release",
  item: {
    type: "question",
    id: "q10",
    props: {
      text: "Is step q10 needed for the release?",
      header: "Q10",
      options: [{ label: "Yes" }, { label: "No" }],
    },
  },
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the question in view`, () => {
    const { start } = useEngine(engine);

    test(
      "scrolling with focus on no card: the card crossing the reading line is current, and no other entry; at the end of the page, the last card",
      async () => {
        const { run, board } = await open(start, "sections");
        await outlineEntry(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await expectCurrent(board, "q2");
        await blurCards(board);
        await scrollToLine(board, "q7");
        await expectCurrent(board, "q7");
        await scrollToEnd(board);
        await expectCurrent(board, "q9");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the card holding focus stays current while it shows between the bars, though the next card crosses the reading line",
      async () => {
        const { board } = await open(start, "sections");
        await optionOf(board, "q3", "Yes").focus();
        await expectCurrent(board, "q3");
        // Put q4 across the reading line while q3's card still shows above it.
        await scrollToLine(board, "q4");
        await eventually(() => isFocused(optionOf(board, "q3", "Yes")), "focus still on q3");
        const header = await boxOf(board.view.getByRole("banner"));
        const q3 = await boxOf(board.question("q3"));
        expect(q3.bottom).toBeGreaterThan(header.bottom);
        await expectCurrent(board, "q3");
        // Moving focus to q5's card makes q5 current.
        await board.question("q5").getByRole("radio").first().focus();
        await expectCurrent(board, "q5");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "another tab: the question in view is a question of that tab, and follows scrolling within it",
      async () => {
        const { board } = await open(start, "tabs");
        await board.view.getByRole("tab", { name: /^Data/ }).click({ timeout: STEP_TIMEOUT_MS });
        await board.question("q5").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        await eventually(async () => {
          const [mark] = await currentMarks(board);
          return mark === "q4" || mark === "q5" || mark === "q6";
        }, "a question of the Data tab current");
        await blurCards(board);
        await scrollToLine(board, "q6");
        await expectCurrent(board, "q6");
        await scrollToLine(board, "q5");
        await expectCurrent(board, "q5");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "after a reload the draft's question in view stays while the page opens at its top, until the user scrolls",
      async () => {
        const { run, board } = await open(start, "sections");
        await outlineEntry(board, "q5").click({ timeout: STEP_TIMEOUT_MS });
        await expectCurrent(board, "q5");
        await eventually(
          () => sentDrafts(run).some((record) => JSON.stringify(record).includes('"inView":"q5"')),
          "the draft mirrored with q5 in view",
        );
        await reloadBoard(board, run, () =>
          board.question("q1").waitFor({ timeout: STEP_TIMEOUT_MS }),
        );
        await expectCurrent(board, "q5");
        expect(await scrollTop(board)).toBe(0);
        // Settled: nothing moved the mark on its own.
        await board.page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => done(0))),
        );
        await expectCurrent(board, "q5");
        await scrollToLine(board, "q8");
        await expectCurrent(board, "q8");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Next open goes on from where the user is: jump to q2, scroll to q5, answer it, and the jump reaches q6",
      async () => {
        const { board } = await open(start, "sections");
        await outlineEntry(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await expectCurrent(board, "q2");
        await blurCards(board);
        await scrollToLine(board, "q5");
        await expectCurrent(board, "q5");
        await answerWithKeys(board, "q5");
        // "Go to the next" (the default) moves on from q5 to q6; the jump then goes on from there.
        await eventually(() => isFocused(headingOf(board, "q6")), "focus on the q6 heading");
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "q7")), "focus on the q7 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question the agent added comes first, with q5 in view",
      async () => {
        const { run, board } = await open(start, "sections");
        await outlineEntry(board, "q5").click({ timeout: STEP_TIMEOUT_MS });
        await expectCurrent(board, "q5");
        await run.session.update([ADDED]);
        await eventually(
          async () => ((await outlineEntry(board, "q10").textContent()) ?? "").includes("New"),
          "q10 marked new",
        );
        await nextOpen(board).click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "q10")), "focus on the q10 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Submit moves focus to the next question to do after the question in view, a mid-board question",
      async () => {
        const { run, board } = await open(start, "sections", "submitted");
        await answerWithKeys(board, "q1");
        await eventually(
          async () => ((await outlineEntry(board, "q1").textContent()) ?? "").includes("Ready"),
          "q1 ready",
        );
        await blurCards(board);
        await scrollToLine(board, "q5");
        await expectCurrent(board, "q5");
        await board.submit.focus();
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        // Submit moves focus to the next question to do after the question in view (q5).
        await eventually(() => isFocused(headingOf(board, "q6")), "focus on the q6 heading");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
