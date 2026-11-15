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
import { guidanceAsk, MARKUP_TITLE } from "./fixtures/guidance-asks.ts";
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
  const bounds = { top: await boxOf(top), bar: await boxOf(board.view.getByRole("contentinfo")) };
  // A smooth scroll finishes within a quarter of a second: wait for the box to settle in place.
  await eventually(async () => {
    const box = await boxOf(heading);
    return box.top >= bounds.top.bottom && box.bottom <= bounds.bar.top;
  }, `the ${id} heading between the bars`);
};
const expectClearOfBars = (board: Board, id: string): Promise<void> =>
  expectBetweenBars(board, id, board.view.getByRole("banner"));

const scrollY = (board: Board): Promise<number> =>
  board.view.locator("body").evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? 0);

/** Chooses an option and presses the primary, with the keyboard alone. */
const answerWithKeys = async (board: Board, id: string, label = "Yes"): Promise<void> => {
  await optionOf(board, id, label).focus();
  await board.page.keyboard.press(" ");
  await eventually(() => optionOf(board, id, label).isChecked(), `${label} chosen on ${id}`);
  await answerOf(board, id).focus();
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
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a new question from the agent: the footer says so",
      async () => {
        const { run, board } = await openPlain(start, 3, { setting: "stay" });
        await run.session.update([
          {
            action: "add",
            item: {
              type: "question",
              id: "p9",
              props: { text: "Is the new step needed?", header: "P9", options: [{ label: "Yes" }] },
            },
          },
        ]);
        await board.question("p9").waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        await answerWithKeys(board, "p1");
        await eventually(() => isFocused(continueOf(board, "p1")), "focus on Continue");
        expect(await footerOf(board, "p1").textContent()).toContain("New from the agent");
        expect(await footerOf(board, "p1").textContent()).toContain("Next: P9");
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
        await said(board, "Answer sent: Yes. Scope completed. Next: Q4, 4 of 9.");
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
  });
}
