// After an answer, in each engine (answering-flow-guidance, task 6.1; view-and-widgets spec: After an
// answer, What never moves the board, The after-answer setting, Counts and the next-open jump, Tabs,
// One question per view, Keyboard core, Focus after Answer and Submit, Focus moves clear the sticky
// bars; D2, D3, D4, D9; #168). At 1280x800: the board moves on to the next question to do, or shows
// "Continue" in the card, as the setting says; a revision, a note alone and "Edit" move nothing; the
// strip of tabs stays under the header; an agent's title in the footer is text; a held key never
// reaches the card the board moved to (NFR-10). Controls are found by their hooks, the answers are
// given with the keyboard, and each wait is a probe or a condition. Every scenario runs on the
// session process.

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { Locator } from "playwright";
import { answeringAsk, type Presentation } from "./fixtures/answering-flow-asks.ts";
import { guidanceAsk, MARKUP_TITLE, shortAsk } from "./fixtures/guidance-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  LOAD_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { type Board, boardOf } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  card,
  chooseFromMore,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  postponeOf,
  sentActs,
  viewportBottom,
} from "./harness/lifecycle-test.ts";
import { hostSettled } from "./harness/probes.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ALL,
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const STAY = { user: { version: "1.0", afterAnswer: "stay" } };
type Setting = "next" | "stay";
type Start = ReturnType<typeof useEngine>["start"];
type Scenario = Parameters<Start>[0];

const withSetting = (scenario: Scenario, setting: Setting): Scenario =>
  setting === "stay" ? { ...scenario, config: STAY } : scenario;

/** The nine tall questions in three areas (answering-flow-asks). */
const openTall = async (
  start: Start,
  options: {
    presentation?: Presentation;
    delivery?: "immediate" | "submitted";
    setting?: Setting;
  } = {},
) => {
  const { presentation = "sections", delivery = "immediate", setting = "next" } = options;
  const scenario = lifecycleScenario(answeringAsk(presentation, "en-US", delivery), dist);
  const run = await start(withSetting(scenario, setting));
  return { run, board: await openBoard(run, FIRST_VIEW[presentation]) };
};

/** A short board of plain questions, p1 to p<count>. */
const openPlain = async (
  start: Start,
  count: number,
  options: Parameters<typeof guidanceAsk>[1] & { setting?: Setting } = {},
) => {
  const { setting = "next", ...ask } = options;
  const run = await start(withSetting(lifecycleScenario(guidanceAsk(count, ask), dist), setting));
  const ids = Array.from({ length: count }, (_, at) => `p${at + 1}`);
  return { run, board: await openBoard(run, ids) };
};

// The hooks of the guided flow: the footer of a card, its "Continue", the arrival mark, the strip of
// tabs (D3, D4) and the state line.
const footerOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-footer]");
const continueOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-continue]");
const arrivedAt = (board: Board, id: string): Locator =>
  card(board, id).and(board.view.locator("[data-askboard-arrived]"));
const stateOf = (board: Board, id: string): Locator =>
  card(board, id).locator("[data-askboard-state]");
const strip = (board: Board): Locator => board.view.locator("[data-askboard-tab-strip]");
const outlineEntry = (board: Board, id: string): Locator =>
  board.view.locator(`[data-askboard-outline="${id}"]`);

type Box = { readonly top: number; readonly bottom: number };
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return { top: box.y, bottom: box.y + box.height };
};

/** The heading has focus and lies wholly between the sticky bars (`top` is the bar above it). */
const expectBetweenBars = async (board: Board, id: string, top: Locator): Promise<void> => {
  const heading = headingOf(board, id);
  await eventually(() => isFocused(heading), `focus on the ${id} heading`);
  const bounds = { top: await boxOf(top), bar: { top: await viewportBottom(board) } };
  // A smooth scroll finishes within a quarter of a second: wait for the box to settle in place.
  await eventually(async () => {
    const box = await boxOf(heading);
    return box.top >= bounds.top.bottom && box.bottom <= bounds.bar.top;
  }, `the ${id} heading between the bars`);
};
const expectClearOfBars = (board: Board, id: string): Promise<void> =>
  expectBetweenBars(board, id, board.view.getByRole("banner"));

/** The card starts 8 px (±2) under `bar`'s bottom edge, once the scroll has settled. */
const expectCardUnder = async (board: Board, id: string, bar: Locator): Promise<void> => {
  await eventually(async () => {
    const gap = (await boxOf(card(board, id))).top - (await boxOf(bar)).bottom;
    return Math.abs(gap - 8) <= 2;
  }, `the ${id} card 8 px under the bar`);
};
const expectCardUnderHeader = (board: Board, id: string): Promise<void> =>
  expectCardUnder(board, id, board.view.getByRole("banner"));

const cardIsUnderHeader = async (board: Board, id: string): Promise<boolean> => {
  const gap =
    (await boxOf(card(board, id))).top - (await boxOf(board.view.getByRole("banner"))).bottom;
  return Math.abs(gap - 8) <= 2;
};

const scrollY = (board: Board): Promise<number> =>
  board.view.locator("body").evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? 0);

/**
 * Waits until the page stands still: the same scroll position at two reads 150 ms apart. A control
 * focused by script is scrolled into view by the engine, WebKit with a smooth scroll that outlasts
 * the next key press; a person presses Enter after the page has stopped, and the move that follows
 * reads any scroll still under way as the user's own and ends short (answer-moves-to-top).
 */
const standingStill = async (board: Board): Promise<void> => {
  let last = -1;
  await eventually(async () => {
    const at = await scrollY(board);
    const still = at === last;
    last = at;
    if (!still) await Bun.sleep(150);
    return still;
  }, "the page standing still");
};

/** Chooses an option and presses the primary, with the keyboard alone. */
const answerWithKeys = async (board: Board, id: string, label = "Yes"): Promise<void> => {
  await optionOf(board, id, label).focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, label).isChecked(), `${label} chosen on ${id}`);
  await answerOf(board, id).focus();
  await standingStill(board);
  await board.page.keyboard.press("Enter");
};

const regionText = async (board: Board): Promise<string> =>
  (await board.status.textContent({ timeout: STEP_TIMEOUT_MS })) ?? "";
const said = (board: Board, text: string): Promise<void> =>
  eventually(async () => (await regionText(board)) === text, `the status region reading "${text}"`);

const heldCount = (run: Parameters<typeof sentActs>[0]) => sentActs(run).length;

const inCard = (board: Board, id: string): Promise<boolean> =>
  card(board, id).evaluate((element) => element.contains(element.ownerDocument.activeElement));

const panel = (board: Board) => board.page.getByRole("complementary", { name: "Settings" });
const settingsButton = (board: Board) =>
  board.view.getByRole("banner").getByRole("button", { name: "Settings", exact: true });
const afterRow = (board: Board) => panel(board).locator('[data-askboard-setting="afterAnswer"]');
const openPanel = async (board: Board) => {
  await settingsButton(board).click({ timeout: STEP_TIMEOUT_MS });
  await afterRow(board).waitFor({ timeout: STEP_TIMEOUT_MS });
};
const checked = (board: Board, name: string): Promise<string | null> =>
  afterRow(board).getByRole("radio", { name, exact: true }).getAttribute("aria-checked");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "Go to the next, in sections: question 4's heading has focus between the bars with the arrival mark, and the region names it",
      async () => {
        const { run, board } = await openTall(start);
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await arrivedAt(board, "q4").waitFor({ timeout: STEP_TIMEOUT_MS });
        await expectClearOfBars(board, "q4");
        await expectCardUnderHeader(board, "q4");
        await said(board, "Answer sent: Yes. Next: Q4, 4 of 9.");
        // The mark is a moment's: it goes once its time is up (D4).
        await eventually(
          async () => (await arrivedAt(board, "q4").count()) === 0,
          "no arrival mark",
        );
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Stay here: focus is on Continue in question 3's footer, which names question 4, the page has not scrolled, and Continue moves to question 4",
      async () => {
        const { run, board } = await openTall(start, { setting: "stay" });
        await optionOf(board, "q3", "Yes").focus();
        await board.page.keyboard.press(" ");
        await answerOf(board, "q3").focus();
        const before = await scrollY(board);
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        await eventually(() => isFocused(continueOf(board, "q3")), "focus on Continue");
        expect(await footerOf(board, "q3").textContent()).toContain("Next: Q4");
        expect(await scrollY(board)).toBe(before);
        await board.page.keyboard.press("Enter");
        await expectClearOfBars(board, "q4");
        await expectCardUnderHeader(board, "q4");
        // The footer leaves with the move (D3).
        expect(await footerOf(board, "q3").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "One question per view: the board shows the next question to do and its heading has focus",
      async () => {
        const { run, board } = await openTall(start, { presentation: "one-per-view" });
        await answerWithKeys(board, "q1");
        await actsSent(run, 1);
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the q2 heading");
        expect(await headingOf(board, "q2").isVisible()).toBe(true);
        expect(await headingOf(board, "q1").isVisible()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "One question per view with Stay here: the same question is shown and focus is on its Continue",
      async () => {
        const { run, board } = await openTall(start, {
          presentation: "one-per-view",
          setting: "stay",
        });
        await answerWithKeys(board, "q1");
        await actsSent(run, 1);
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
        expect(await headingOf(board, "q1").isVisible()).toBe(true);
        await board.page.keyboard.press("Enter");
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the q2 heading");
        expect(await headingOf(board, "q2").isVisible()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Confirm in All together: question 4's heading has focus and the region reads the ready line, then question 4's title",
      async () => {
        const { run, board } = await openTall(start, { delivery: "submitted" });
        await answerWithKeys(board, "q3");
        await said(board, "Answer ready, not sent. 1 ready. Next: Q4, 4 of 9.");
        await expectClearOfBars(board, "q4");
        await hostSettled(board);
        expect(heldCount(run)).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Later moves on: the question reads Postponed and the next question to do's heading has focus",
      async () => {
        const { board } = await openTall(start);
        await postponeOf(board, "q3").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            (await stateOf(board, "q3").getAttribute("data-askboard-state")) === "postponed",
          "q3 postponed",
        );
        await expectClearOfBars(board, "q4");
        await said(board, "Postponed. Next: Q4, 4 of 9.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Decline moves on: the question reads Declined and the next question to do's heading has focus",
      async () => {
        const { board } = await openTall(start);
        await chooseFromMore(board, "q3", "Decline");
        await eventually(
          async () =>
            (await stateOf(board, "q3").getAttribute("data-askboard-state")) === "declined",
          "q3 declined",
        );
        await expectClearOfBars(board, "q4");
        await said(board, "Declined. Next: Q4, 4 of 9.");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a revision does not move the board: focus is on its heading and the region says the change was sent",
      async () => {
        const { run, board } = await openTall(start);
        await answerWithKeys(board, "q1");
        await eventually(() => isFocused(headingOf(board, "q2")), "the board moved on to q2");
        await optionOf(board, "q1", "No").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 2);
        await eventually(() => isFocused(headingOf(board, "q1")), "focus on the q1 heading");
        await said(board, "Change sent.");
        expect(await isFocused(headingOf(board, "q2"))).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a note alone does not move the board: focus stays in the card, which still reads To do",
      async () => {
        const { run, board } = await openTall(start);
        await card(board, "q2")
          .getByRole("textbox", { name: "Note for the agent (optional)" })
          .fill("Ask ops first.", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q2").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await said(board, "Note sent; the question is still to do.");
        expect(await inCard(board, "q2")).toBe(true);
        expect(await stateOf(board, "q2").getAttribute("data-askboard-state")).toBe("todo");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Accept recommended with Stay here sends the answer and leaves focus on the question's Continue",
      async () => {
        const { run, board } = await openTall(start, { setting: "stay" });
        await card(board, "q1")
          .getByRole("button", { name: "Accept recommended", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent's title in the footer is shown as text: markup stays literal and the override is isolated",
      async () => {
        const { run, board } = await openPlain(start, 3, { marked: ["p2"], setting: "stay" });
        await answerWithKeys(board, "p1");
        await actsSent(run, 1);
        await eventually(() => isFocused(continueOf(board, "p1")), "focus on Continue");
        const footer = footerOf(board, "p1");
        expect(await footer.textContent()).toContain(MARKUP_TITLE);
        expect(await footer.locator("b").count()).toBe(0);
        // The title sits in its own isolate, so its override reaches nothing around it.
        expect(await footer.locator("bdi").textContent()).toBe(MARKUP_TITLE);
        // And it holds its layout: text after the title stays to the right of it, so the override
        // reverses nothing around it (the span's parts run left to right).
        const lefts = await footer
          .locator("span")
          .first()
          .evaluate((span) => {
            const tail = span.ownerDocument.createTextNode(" TAIL");
            span.appendChild(tail);
            const out: number[] = [];
            for (const node of Array.from(span.childNodes)) {
              const range = span.ownerDocument.createRange();
              range.selectNodeContents(node);
              const rect = range.getBoundingClientRect();
              if (rect.width > 0) out.push(rect.left);
            }
            return out;
          });
        expect(lefts.length).toBeGreaterThanOrEqual(3);
        expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a new question from the agent that the user has not seen: the footer names it and says so",
      async () => {
        const { run, board } = await openTall(start, { setting: "stay" });
        await run.session.update([
          {
            action: "add",
            parentId: "release",
            item: {
              type: "question",
              id: "q10",
              props: {
                text: "Is the new step needed?",
                header: "Q10",
                options: [{ label: "Yes" }],
              },
            },
          },
        ]);
        await board.question("q10").waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        await answerWithKeys(board, "q1");
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
        const text = (await footerOf(board, "q1").textContent()) ?? "";
        expect(text).toContain("Next: Q10");
        expect(text).toContain("New from the agent");
      },
      TEST_TIMEOUT_MS,
    );
    test(
      "a ready answer whose field is edited to fail its pattern is no longer ready, and the region names the field",
      async () => {
        const { board } = await openTall(start, { delivery: "submitted" });
        await card(board, "q4")
          .getByRole("textbox", { name: "Service name" })
          .fill("billing", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q4").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await answerOf(board, "q4").getAttribute("aria-pressed")) === "true",
          "q4 ready",
        );
        await card(board, "q4")
          .getByRole("textbox", { name: "Ticket" })
          .fill("x", { timeout: STEP_TIMEOUT_MS });
        await said(board, "No longer ready: correct Ticket.");
        expect(await answerOf(board, "q4").getAttribute("aria-pressed")).toBe("false");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the move to the top`, () => {
    const { start } = useEngine(engine);
    const sendFirst = async (board: Board, run: Parameters<typeof actsSent>[0], id: string) => {
      await answerWithKeys(board, id);
      await actsSent(run, 1);
    };

    test(
      "a question already in view: the page still scrolls and the card starts under the header",
      async () => {
        const run = await start(lifecycleScenario(shortAsk(), dist));
        const board = await openBoard(run, ["s1", "s2", "s3", "s4"]);
        // Before the answer, question 2's card lies wholly in view with the page at its top.
        const before = await boxOf(card(board, "s2"));
        expect(before.top).toBeGreaterThanOrEqual(
          (await boxOf(board.view.getByRole("banner"))).bottom,
        );
        expect(before.bottom).toBeLessThanOrEqual(await viewportBottom(board));
        expect(await scrollY(board)).toBe(0);
        await card(board, "s1")
          .getByRole("textbox", { name: "Name" })
          .fill("Ada", { timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "s1").click({ timeout: STEP_TIMEOUT_MS });
        await actsSent(run, 1);
        await expectCardUnderHeader(board, "s2");
        expect(await scrollY(board)).toBeGreaterThan(0);
        await eventually(() => isFocused(headingOf(board, "s2")), "focus on the s2 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question below the viewport: the card starts under the header",
      async () => {
        const { run, board } = await openTall(start);
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await expectCardUnderHeader(board, "q4");
        await eventually(() => isFocused(headingOf(board, "q4")), "focus on the q4 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "within a tab: the card starts under the strip",
      async () => {
        const { run, board } = await openTall(start, { presentation: "tabs" });
        await sendFirst(board, run, "q1");
        await expectCardUnder(board, "q2", strip(board));
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the q2 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the last question near the page's end: the page stops at its end, the heading between the bars",
      async () => {
        const { run, board } = await openPlain(start, 3);
        await sendFirst(board, run, "p1");
        await answerWithKeys(board, "p2");
        await actsSent(run, 2);
        await expectClearOfBars(board, "p3");
        await eventually(async () => {
          const gap = await board.view
            .locator("body")
            .evaluate(
              (body) =>
                body.ownerDocument.documentElement.scrollHeight -
                (body.ownerDocument.defaultView?.innerHeight ?? 0) -
                (body.ownerDocument.defaultView?.scrollY ?? 0),
            );
          return Math.abs(gap) <= 2;
        }, "the page at its end");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view scrolled down: the page goes to its top and the next card carries the mark",
      async () => {
        const { run, board } = await openTall(start, { presentation: "one-per-view" });
        await board.view
          .locator("body")
          .evaluate((body) => body.ownerDocument.defaultView?.scrollTo(0, 300));
        await eventually(async () => (await scrollY(board)) > 100, "the page scrolled down");
        await answerWithKeys(board, "q1");
        await actsSent(run, 1);
        await arrivedAt(board, "q2").waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await scrollY(board)) === 0, "the page at its top");
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the q2 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a jump to a question in view keeps the page still, with no mark",
      async () => {
        const { board } = await openPlain(start, 4);
        await board.nextToDo.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "p1")), "focus on the p1 heading");
        expect(await scrollY(board)).toBe(0);
        expect(await arrivedAt(board, "p1").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  // The move and a scroll the browser makes on its own (answering-flow-reload-and-reveal, D2, D5;
  // #259): a smooth scroll the page started, or a focus scroll, is not the user's and is planned
  // over; the user's wheel or a focus the user moved ends the move where it is.
  describe(`${engine}: the move and the browser's own scroll`, () => {
    const { start } = useEngine(engine);
    // Chooses q3's option and focuses the primary, as `answerWithKeys` does, but does not wait.
    const readyQ3 = async (board: Board) => {
      await optionOf(board, "q3", "Yes").focus();
      await board.page.keyboard.press(" ");
      await eventually(() => optionOf(board, "q3", "Yes").isChecked(), "Yes chosen on q3");
      await answerOf(board, "q3").focus();
      await standingStill(board);
    };

    test(
      "a smooth scroll the page started, then Enter 20 ms later: the card still lands 8 px under the header",
      async () => {
        const { run, board } = await openTall(start);
        await readyQ3(board);
        await board.view.locator("body").evaluate((body) => {
          const view = body.ownerDocument.defaultView as Window;
          const y = view.scrollY;
          view.scrollTo({ top: y - Math.min(y, 600), behavior: "instant" });
          view.scrollTo({ top: y, behavior: "smooth" });
        });
        await Bun.sleep(20);
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
        await expectCardUnderHeader(board, "q4");
        await Bun.sleep(700);
        await expectCardUnderHeader(board, "q4");
        await eventually(() => isFocused(headingOf(board, "q4")), "focus on the q4 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a wheel right after Enter: the page stays where the wheel put it",
      async () => {
        const { run, board } = await openTall(start);
        await readyQ3(board);
        await board.page.keyboard.press("Enter");
        await board.page.mouse.move(200, 300);
        await board.page.mouse.wheel(0, -600);
        await actsSent(run, 1);
        // The move (282 ms at most) is over by the first sample: the page then stays where it is,
        // and is not at question 4's place, where a move that went on over the wheel would end.
        await Bun.sleep(500);
        const put = await scrollY(board);
        await Bun.sleep(500);
        expect(Math.abs((await scrollY(board)) - put)).toBeLessThanOrEqual(4);
        expect(await cardIsUnderHeader(board, "q4")).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tab during the move halts it: the card is not carried to its place",
      async () => {
        const { run, board } = await openTall(start);
        await readyQ3(board);
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.press("Tab");
        await actsSent(run, 1);
        await Bun.sleep(500);
        const put = await scrollY(board);
        await Bun.sleep(500);
        expect(Math.abs((await scrollY(board)) - put)).toBeLessThanOrEqual(4);
        expect(await cardIsUnderHeader(board, "q4")).toBe(false);
        // Focus is where Tab put it: off the heading, on the first tabbable element after it.
        const heading = await headingOf(board, "q4").elementHandle();
        const tabbed = await heading?.evaluate((element) => {
          const doc = element.ownerDocument;
          const after = [
            ...doc.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ].find(
            (each) => element.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
          return after !== undefined && after === doc.activeElement;
        });
        expect(await isFocused(headingOf(board, "q4"))).toBe(false);
        expect(tabbed).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a focus moved to another heading during the move: the move stops and that heading keeps focus",
      async () => {
        const { run, board } = await openTall(start);
        await readyQ3(board);
        await board.page.keyboard.press("Enter");
        await headingOf(board, "q1").focus();
        await actsSent(run, 1);
        await Bun.sleep(1_000);
        expect(await isFocused(headingOf(board, "q1"))).toBe(true);
        // The page shows that heading, and the move did not carry it on to question 4's place.
        const heading = await boxOf(headingOf(board, "q1"));
        expect(heading.top).toBeGreaterThanOrEqual(0);
        expect(heading.bottom).toBeLessThanOrEqual(await viewportBottom(board));
        expect(await cardIsUnderHeader(board, "q4")).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: tabs and the sticky strip`, () => {
    const { start } = useEngine(engine);

    test(
      "the strip stays under the header as the page scrolls",
      async () => {
        const { board } = await openTall(start, { presentation: "tabs" });
        const header = board.view.getByRole("banner");
        await board.view
          .locator("body")
          .evaluate((body) => body.ownerDocument.defaultView?.scrollBy(0, 500));
        await eventually(async () => (await scrollY(board)) > 400, "the page scrolled");
        expect((await boxOf(strip(board))).top).toBeCloseTo((await boxOf(header)).bottom, 0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "handing off to the next tab: the region reads the area completed, the next tab is active, its first question to do has focus and the strip is in view",
      async () => {
        const { run, board } = await openTall(start, { presentation: "tabs" });
        for (const id of ["q1", "q2", "q3"]) {
          await answerWithKeys(board, id);
          await actsSent(run, Number(id.slice(1)));
        }
        await said(board, "Answer sent: Yes. Scope completed Next: Q4, 4 of 9.");
        const data = board.view.getByRole("tab", { name: /Data/ });
        await eventually(
          async () => (await data.getAttribute("aria-selected")) === "true",
          "the Data tab active",
        );
        await expectBetweenBars(board, "q4", strip(board));
        const header = await boxOf(board.view.getByRole("banner"));
        const bar = await boxOf(strip(board));
        expect(bar.top).toBeCloseTo(header.bottom, 0);
        // The finished tab shows a done mark and no count; the other tab keeps its count.
        const scope = board.view.getByRole("tab", { name: /Scope/ });
        expect(((await scope.textContent()) ?? "").trim()).toBe("Scopecompleted");
        expect(await scope.locator("[data-askboard-tab-done]").count()).toBe(1);
        // The done mark is the check icon, hidden from assistive technology (D11).
        const check = scope.locator("svg[data-askboard-tab-done]");
        expect(await check.count()).toBe(1);
        expect(await check.getAttribute("aria-hidden")).toBe("true");
        expect(await check.getAttribute("class")).toContain("lucide-check");
        expect((await data.textContent()) ?? "").toContain("3 to do");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a jump into another tab puts its heading between the strip and the bottom bar after the scroll",
      async () => {
        const { run, board } = await openTall(start, { presentation: "tabs" });
        await answerWithKeys(board, "q3");
        await actsSent(run, 1);
        await expectBetweenBars(board, "q4", strip(board));
        await eventually(async () => (await arrivedAt(board, "q4").count()) === 1, "arrival mark");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the order of the next question to do and the count`, () => {
    const { start } = useEngine(engine);

    test(
      "postponed questions last: Next to do reaches question 6, then the postponed question 3",
      async () => {
        const { run, board } = await openPlain(start, 6);
        await postponeOf(board, "p3").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            (await stateOf(board, "p3").getAttribute("data-askboard-state")) === "postponed",
          "p3 postponed",
        );
        for (const [at, id] of ["p1", "p2", "p4", "p5"].entries()) {
          await answerWithKeys(board, id);
          await actsSent(run, at + 2);
        }
        await headingOf(board, "p2").focus();
        await eventually(
          async () => (await outlineEntry(board, "p2").getAttribute("aria-current")) === "true",
          "p2 in view",
        );
        await board.nextToDo.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "p6")), "focus on the p6 heading");
        await board.nextToDo.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "p3")), "focus on the p3 heading");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the count names the postponed, in English and in Italian",
      async () => {
        const english = await openPlain(start, 4);
        await postponeOf(english.board, "p2").click({ timeout: STEP_TIMEOUT_MS });
        await english.board.header
          .getByText("4 to do (1 postponed)", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const italian = await openPlain(start, 4, { language: "it-IT" });
        await postponeOf(italian.board, "p2").click({ timeout: STEP_TIMEOUT_MS });
        await italian.board.header
          .getByText("4 da fare (di cui 1 rimandata)", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the after-answer setting`, () => {
    const { start } = useEngine(engine);

    test(
      "the default: the panel shows After answering at Go to the next",
      async () => {
        const { board } = await openTall(start);
        await openPanel(board);
        expect(await afterRow(board).textContent()).toContain("After answering");
        expect(await checked(board, "Go to the next")).toBe("true");
        expect(await checked(board, "Stay here")).toBe("false");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a pick of Stay here applies at once, is written as the user's setting and reaches a later board",
      async () => {
        const scenario = {
          ...lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
          config: { user: { version: "1.0" } },
        };
        const run = await start(scenario);
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const board = await openBoard(run, ALL);
        await openPanel(board);
        await afterRow(board)
          .getByRole("radio", { name: "Stay here", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await checked(board, "Stay here")) === "true", "Stay here");
        await answerWithKeys(board, "q1");
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
        await eventually(
          async () =>
            (JSON.parse(await readFile(path, "utf8")) as { afterAnswer?: string }).afterAnswer ===
            "stay",
          "the user file",
        );
        await run.session.restart();
        const later = boardOf(
          await run.browser.newTab(run.session.latestLink?.() ?? run.session.link),
        );
        await later.view
          .locator('[data-askboard-question="q1"]:not([aria-busy="true"])')
          .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        await openPanel(later);
        expect(await checked(later, "Stay here")).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a project's value is read-only with its file and key, and the board behaves as Stay here",
      async () => {
        const scenario = {
          ...lifecycleScenario(answeringAsk("sections", "en-US", "immediate"), dist),
          config: { project: { version: "1.0", afterAnswer: "stay" } },
        };
        const run = await start(scenario);
        const board = await openBoard(run, ALL);
        await openPanel(board);
        const radios = await afterRow(board).getByRole("radio").all();
        expect(radios.length).toBe(2);
        for (const radio of radios) expect(await radio.isDisabled()).toBe(true);
        expect(((await afterRow(board).textContent()) ?? "").replace(/[⁨⁩]/g, "")).toContain(
          ".askboard/config.json · afterAnswer",
        );
        expect(await checked(board, "Stay here")).toBe("true");
        await answerWithKeys(board, "q1");
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: keyboard core after an act`, () => {
    const { start } = useEngine(engine);

    test(
      "with Stay here, Later puts focus on the card's Continue, and a discard then moves it to the banner",
      async () => {
        const { run, board } = await openTall(start, { setting: "stay" });
        await postponeOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(continueOf(board, "q1")), "focus on Continue");
        await run.session.exit();
        await board
          .banner(/discarded/i)
          .filter({ visible: true })
          .first()
          .waitFor({ timeout: LOAD_TIMEOUT_MS });
        await eventually(
          async () =>
            /discarded/i.test(
              await board.page.evaluate(() => document.activeElement?.textContent ?? ""),
            ),
          "focus on the discarded banner",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with Go to the next, Later puts focus on the next question to do's heading",
      async () => {
        const { board } = await openTall(start);
        await postponeOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(headingOf(board, "q2")), "focus on the q2 heading");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a held key`, () => {
    const { start } = useEngine(engine);

    for (const setting of ["next", "stay"] as const) {
      test(
        `Enter held on Send answer, with ${setting === "next" ? "Go to the next" : "Stay here"}: one answer, question 4 neither answered nor changed, Continue not activated`,
        async () => {
          const { run, board } = await openPlain(start, 5, { setting });
          await optionOf(board, "p4", "Yes").check({ timeout: STEP_TIMEOUT_MS });
          await optionOf(board, "p3", "Yes").check({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, "p3").focus();
          await board.page.keyboard.down("Enter");
          await actsSent(run, 1);
          const landed = setting === "next" ? headingOf(board, "p4") : continueOf(board, "p3");
          await eventually(() => isFocused(landed), "focus on the card the board moved to");
          // Playwright sends the second down of a key already down with `repeat: true`.
          await board.page.keyboard.down("Enter");
          await board.page.keyboard.down("Enter");
          await board.page.keyboard.up("Enter");
          await hostSettled(board);
          expect(heldCount(run)).toBe(1);
          expect(await isFocused(landed)).toBe(true);
          expect(await optionOf(board, "p4", "Yes").isChecked()).toBe(true);
          expect(await stateOf(board, "p4").getAttribute("data-askboard-state")).toBe("draft");
          if (setting === "stay") expect(await continueOf(board, "p3").count()).toBe(1);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "All together: Enter held on the last question's Answer never sends; a fresh Enter on Send does",
      async () => {
        const { run, board } = await openPlain(start, 2, { delivery: "submitted" });
        await answerWithKeys(board, "p1");
        await optionOf(board, "p2", "Yes").check({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "p2").focus();
        await board.page.keyboard.down("Enter");
        await eventually(() => isFocused(board.submit), "focus on Send");
        await board.page.keyboard.down("Enter");
        await board.page.keyboard.down("Enter");
        await board.page.keyboard.up("Enter");
        await hostSettled(board);
        expect(sentActs(run)).toEqual([]);
        expect(await isFocused(board.submit)).toBe(true);
        await board.page.keyboard.press("Enter");
        await actsSent(run, 1);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
