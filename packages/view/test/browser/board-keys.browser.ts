// The board's keys, in each engine and on the session process (board-keys, task 3.4; spec
// view-and-widgets: Next and previous open by key, The board's keys are discoverable, The board's
// keys panel, The user's keys on the board's own keys): `N`, `Shift+N` and `?` outside text fields
// and widgets, the header's "Keys" and the user's file's keys. Every scenario runs on the session
// process; a jump is read from the focus that lands on a heading clear of the sticky bars.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/board-keys.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { EN_US } from "../../src/strings/en-US.ts";
import { IT_IT } from "../../src/strings/it-IT.ts";
import { singleAnsweringAsk } from "./fixtures/answering-flow-asks.ts";
import {
  boardKeysAsk,
  KEYS_QUESTIONS,
  type Presentation,
  threeChoicesAsk,
} from "./fixtures/board-keys-asks.ts";
import { guidanceAsk } from "./fixtures/guidance-asks.ts";
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
  actsSent,
  answerOf,
  card,
  headingOf,
  lifecycleScenario,
  noteOf,
  openBoard,
  optionOf,
  postponeOf,
  tabTo,
  viewportBottom,
} from "./harness/lifecycle-test.ts";
import { viewSettled } from "./harness/probes.ts";
import { orderShown, rowOf } from "./harness/ranking-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const IDS = [...KEYS_QUESTIONS];

type KeySeen = { readonly key: string; readonly prevented: boolean };
type Watched = { __keys?: KeySeen[] };

/** Records each `keydown` as the window sees it, after every handler of the view's document. */
const watchKeys = (board: Board): Promise<void> =>
  board.view.locator("body").evaluate(() => {
    const seen: KeySeen[] = [];
    (window as unknown as Watched).__keys = seen;
    window.addEventListener("keydown", (event) =>
      seen.push({ key: event.key, prevented: event.defaultPrevented }),
    );
  });
const lastKeyOf = async (board: Board): Promise<KeySeen | undefined> => {
  const seen = await board.view
    .locator("body")
    .evaluate(() => (window as unknown as Watched).__keys);
  return seen?.at(-1);
};

const open = async (
  start: ReturnType<typeof useEngine>["start"],
  presentation: Presentation,
  config?: { readonly user?: unknown },
) => {
  const scenario = lifecycleScenario(
    boardKeysAsk(presentation, config === undefined ? "a1" : "j1"),
    dist,
  );
  const run = await start(config === undefined ? scenario : { ...scenario, config });
  const board = await openBoard(run, IDS);
  await watchKeys(board);
  return { run, board };
};

const boardPanel = (board: Board): Locator =>
  board.view.getByRole("dialog", { name: "Board keys" });
const keysButton = (board: Board): Locator =>
  board.view.getByRole("banner").getByRole("button", { name: "Keys", exact: true });

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
    bar: { top: await viewportBottom(board) },
  };
  await eventually(async () => {
    const box = await boxOf(heading);
    return box.top >= bounds.header.bottom && box.bottom <= bounds.bar.top;
  }, `the ${id} heading between the header and the bottom bar`);
};

/** Focuses an option and waits until the view has taken its question as the one in view. */
const focusOption = async (board: Board, id: string): Promise<Locator> => {
  const option = optionOf(board, id, "Yes");
  await option.focus();
  await viewSettled(board);
  return option;
};

/** A key the view must leave alone: pressed, settled, not prevented, and the focus did not move. */
const expectKeyIgnored = async (board: Board, key: string, held: Locator): Promise<void> => {
  await board.page.keyboard.press(key);
  await viewSettled(board);
  // Left to the browser: the key pressed reached the window and its default was not prevented.
  const last = await lastKeyOf(board);
  expect(last?.key.toLowerCase()).toBe(key.split("+").at(-1)?.toLowerCase());
  expect(last?.prevented).toBe(false);
  expect(await isFocused(held)).toBe(true);
  expect(await boardPanel(board).count()).toBe(0);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the board's keys`, () => {
    const { start } = useEngine(engine);

    test(
      "from an option, N, Shift+N and Shift+N go to the next, the previous and the last question, each heading clear of the bars",
      async () => {
        const { run, board } = await open(start, "sections");
        await focusOption(board, "q1");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q2");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q1");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q4");
        await viewSettled(board);
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q1");
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: N shows the next question",
      async () => {
        const { board } = await open(start, "one-per-view");
        await focusOption(board, "q1");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q2");
        expect(await card(board, "q2").isVisible()).toBe(true);
        expect(await card(board, "q1").isVisible()).toBe(false);
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q1");
        expect(await card(board, "q1").isVisible()).toBe(true);
        expect(await card(board, "q2").isVisible()).toBe(false);
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q4");
        expect(await card(board, "q4").isVisible()).toBe(true);
        expect(await card(board, "q1").isVisible()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "tabs: N crosses to the other area, which becomes the active tab",
      async () => {
        const { board } = await open(start, "tabs");
        await focusOption(board, "q2");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "rank");
        await eventually(
          async () =>
            (await board.view.getByRole("tab", { name: /^Data/ }).getAttribute("aria-selected")) ===
            "true",
          "the Data tab active",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "'n' typed in the note and in Other… is text: nothing moves",
      async () => {
        const { board } = await open(start, "sections");
        const note = noteOf(board, "q1");
        await note.focus();
        await board.page.keyboard.type("n N");
        await viewSettled(board);
        expect(await note.inputValue()).toBe("n N");
        expect(await isFocused(note)).toBe(true);
        await optionOf(board, "q1", "Other…").click();
        const other = card(board, "q1").getByRole("textbox").first();
        await other.focus();
        await board.page.keyboard.type("n");
        await viewSettled(board);
        expect(await other.inputValue()).toContain("n");
        expect(await isFocused(other)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Ranking's row: N moves nothing, and ? opens the Ranking's panel, not the board's",
      async () => {
        const { board } = await open(start, "sections");
        const before = await orderShown(board);
        const row = rowOf(board, "c");
        await row.focus();
        await viewSettled(board);
        await board.page.keyboard.press("n");
        await viewSettled(board);
        expect(await orderShown(board)).toEqual(before);
        expect(await isFocused(row)).toBe(true);
        await board.page.keyboard.press("?");
        await board.view
          .getByRole("dialog", { name: "Ranking keys" })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await boardPanel(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a newly opened board hears nothing until the user clicks or tabs into it",
      async () => {
        const { board } = await open(start, "sections");
        await board.page.keyboard.press("n");
        await viewSettled(board);
        for (const id of IDS) expect(await isFocused(headingOf(board, id))).toBe(false);
        // After a click on blank space, the key reaches the view's document.
        await board.view.locator("main").click({ position: { x: 2, y: 2 } });
        await board.page.keyboard.press("n");
        await eventually(async () => {
          for (const id of IDS) if (await isFocused(headingOf(board, id))) return true;
          return false;
        }, "a heading focused after a click on the board");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "no other open question: N does nothing, and the single-question board has no jump",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        await watchKeys(board);
        const option = await focusOption(board, "only");
        await expectKeyIgnored(board, "n", option);
        await expectKeyIgnored(board, "Shift+N", option);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+N and Ctrl+N are the browser's",
      async () => {
        const { board } = await open(start, "sections");
        const option = await focusOption(board, "q1");
        await expectKeyIgnored(board, "Alt+n", option);
        await expectKeyIgnored(board, "Control+n", option);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "? from an option opens the board's panel; Escape gives the focus back to the option",
      async () => {
        const { board } = await open(start, "sections");
        const option = await focusOption(board, "q1");
        await board.page.keyboard.press("?");
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await boardPanel(board).textContent()) ?? "";
        expect(text).toContain("Previous to do");
        expect(text).toContain("Sending all held answers has no key.");
        await board.page.keyboard.press("Escape");
        await boardPanel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(option), "the focus back on the option");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the header's Keys button opens the panel, with ? in its description",
      async () => {
        const { board } = await open(start, "sections");
        expect(await keysButton(board).getAttribute("aria-keyshortcuts")).toBe("?");
        // In the ask row, before "Settings".
        const x = async (locator: Locator): Promise<number> => {
          const box = await locator.boundingBox();
          if (box === null) throw new Error(`no box for ${locator}`);
          return box.x;
        };
        const settings = board.askRow.getByRole("button", { name: "Settings", exact: true });
        expect(await board.askRow.getByRole("button", { name: "Keys", exact: true }).count()).toBe(
          1,
        );
        expect(await x(keysButton(board))).toBeLessThan(await x(settings));
        await keysButton(board).click();
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await boardPanel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(keysButton(board)), "the focus back on Keys");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user file giving next open J: J jumps, N does not, and the header says J",
      async () => {
        const { board } = await open(start, "sections", {
          user: { version: "1.0", keys: { "board.nextOpen": ["j"] } },
        });
        const jump = board.view.getByRole("banner").locator("[data-askboard-next-to-do]");
        await eventually(async () => (await jump.getAttribute("aria-keyshortcuts")) === "J", "J");
        const option = await focusOption(board, "q1");
        await expectKeyIgnored(board, "n", option);
        await board.page.keyboard.press("j");
        await expectClearOfBars(board, "q2");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from an option with question 3, the Ranking, answered: N, Shift+N and Shift+N go to 4, 2 and 1, skipping it",
      async () => {
        const { board } = await open(start, "sections");
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Enter");
        await answerOf(board, "rank").click();
        await viewSettled(board);
        await focusOption(board, "q2");
        await board.page.keyboard.press("n");
        await expectClearOfBars(board, "q4");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q2");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "q1");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: the header's Next to do, pressed first, shows the second question",
      async () => {
        const { board } = await open(start, "one-per-view");
        await board.view.getByRole("banner").locator("[data-askboard-next-to-do]").click();
        await expectClearOfBars(board, "q2");
        expect(await card(board, "q2").isVisible()).toBe(true);
        expect(await card(board, "q1").isVisible()).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every other question answered: the jump is absent, and N is left to the browser",
      async () => {
        const run = await start(lifecycleScenario(threeChoicesAsk(), dist));
        const board = await openBoard(run, ["q1", "q2", "q3"]);
        await watchKeys(board);
        for (const id of ["q2", "q3"]) {
          await optionOf(board, id, "Yes").click();
          await answerOf(board, id).click();
        }
        await viewSettled(board);
        const option = await focusOption(board, "q1");
        const jump = board.view.getByRole("banner").locator("[data-askboard-next-to-do]");
        // With nothing left to do the jump is absent, not disabled (answering-flow-visual, D1).
        await eventually(async () => (await jump.count()) === 0, "the jump absent");
        await expectKeyIgnored(board, "n", option);
        await expectKeyIgnored(board, "Shift+N", option);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an SVG node inside a widget is the widget's: N from it moves nothing and is not prevented",
      async () => {
        const { board } = await open(start, "sections");
        const row = rowOf(board, "c");
        await row.focus();
        await viewSettled(board);
        await row.evaluate((element) => {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.id = "probe-svg";
          element.appendChild(svg);
          svg.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
        });
        await viewSettled(board);
        expect(await isFocused(row)).toBe(true);
        for (const id of IDS) expect(await isFocused(headingOf(board, id))).toBe(false);
        expect((await lastKeyOf(board))?.prevented).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the jump's tooltip, reached by Tab, shows its name with N, and aria-keyshortcuts is N",
      async () => {
        const { board } = await open(start, "sections");
        const jump = board.view.getByRole("banner").locator("[data-askboard-next-to-do]");
        await tabTo(board, jump);
        const tooltip = board.view.getByRole("tooltip");
        await tooltip.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await tooltip.textContent()).toContain("Next to do");
        expect(await tooltip.locator("kbd").allTextContents()).toEqual(["N"]);
        expect(await jump.getAttribute("aria-keyshortcuts")).toBe("N");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "? lists next open, previous open, answer, send a follow-up and the keys panel with their keys, and the note on text fields and widgets",
      async () => {
        const { board } = await open(start, "sections");
        await focusOption(board, "q1");
        await board.page.keyboard.press("?");
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const rows = boardPanel(board).locator("li");
        const wanted = [
          ["Next to do", /^N$/],
          ["Previous to do", /^(Shift\+N|⇧N)$/],
          ["Answer the question in focus", /^(Ctrl\+Enter|⌘↩)$/],
          ["Send the follow-up", /^(Ctrl\+Enter|⌘↩)$/],
        ] as const;
        for (const [name, caps] of wanted) {
          const row = rows.filter({ hasText: name });
          expect(await row.count()).toBe(1);
          const keys = (await row.locator("kbd").allTextContents()).join("");
          expect(keys).toMatch(caps);
        }
        const keysRow = rows.filter({ has: board.view.locator("kbd", { hasText: /^\?$/ }) });
        expect(await keysRow.count()).toBe(1);
        expect(await boardPanel(board).textContent()).toContain(
          "These keys do nothing in a text field or inside a widget",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user file giving next open J: the jump's tooltip shows J, and the panel marks next open customised",
      async () => {
        const { board } = await open(start, "sections", {
          user: { version: "1.0", keys: { "board.nextOpen": ["j"] } },
        });
        const jump = board.view.getByRole("banner").locator("[data-askboard-next-to-do]");
        await eventually(async () => (await jump.getAttribute("aria-keyshortcuts")) === "J", "J");
        await tabTo(board, jump);
        const tooltip = board.view.getByRole("tooltip");
        await tooltip.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await tooltip.locator("kbd").allTextContents()).toEqual(["J"]);
        await keysButton(board).click();
        await boardPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const row = boardPanel(board).locator("li").filter({ hasText: "Next to do" });
        expect(await row.textContent()).toContain("customised");
        expect(await row.locator("kbd").allTextContents()).toEqual(["J"]);
        const other = boardPanel(board).locator("li").filter({ hasText: "Previous to do" });
        expect(await other.textContent()).not.toContain("customised");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "postponed questions last: Shift+N reaches question 2, which is to do, then question 3, which is postponed",
      async () => {
        const run = await start(lifecycleScenario(guidanceAsk(5, { suffix: "k1" }), dist));
        const ids = ["p1", "p2", "p3", "p4", "p5"];
        const board = await openBoard(run, ids);
        await postponeOf(board, "p3").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            (await card(board, "p3")
              .locator("[data-askboard-state]")
              .getAttribute("data-askboard-state")) === "postponed",
          "p3 postponed",
        );
        for (const [at, id] of ["p1", "p4", "p5"].entries()) {
          await optionOf(board, id, "Yes").check({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await actsSent(run, at + 2);
        }
        // The board moved on to question 2 with a smooth scroll: wait for the move to end, then rest
        // the focus on question 5's heading, which the key leaves alone.
        await eventually(
          async () => (await board.view.locator("[data-askboard-arrived]").count()) === 0,
          "the arrival mark gone",
        );
        await headingOf(board, "p5").focus();
        await eventually(
          async () =>
            (await board.view
              .locator('[data-askboard-outline="p5"]')
              .getAttribute("aria-current")) === "true",
          "p5 in view",
        );
        await watchKeys(board);
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "p2");
        await viewSettled(board);
        await board.page.keyboard.press("Shift+N");
        await expectClearOfBars(board, "p3");
      },
      TEST_TIMEOUT_MS,
    );

    for (const [language, title, name] of [
      ["en-US", "Board keys", "Previous to do"],
      ["it-IT", "Tasti della board", "Precedente da fare"],
    ] as const) {
      test(
        `the keys panel names the action of Shift+N ${name} in ${language}`,
        async () => {
          const ask = { ...boardKeysAsk("sections", `n-${language}`), language };
          const run = await start(lifecycleScenario(ask, dist));
          const board = await openBoard(run, IDS);
          await board.view.getByRole("banner").getByRole("button").last().waitFor();
          await focusOption(board, "q1");
          await board.page.keyboard.press("?");
          const dialog = board.view.getByRole("dialog", { name: title });
          await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
          const row = dialog.locator("li").filter({ hasText: name });
          expect(await row.count()).toBe(1);
          // The catalog's Shift for the ask's language, or the symbol on macOS.
          const shift = (language === "it-IT" ? IT_IT : EN_US)["key.shift"];
          expect((await row.locator("kbd").allTextContents()).join("")).toMatch(
            new RegExp(`^(${shift}\\+N|⇧N)$`),
          );
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "an ended board has no Keys button",
      async () => {
        const { run, board } = await open(start, "sections");
        await keysButton(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.update([{ action: "close" }]);
        await board.header
          .getByText("Closed", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await keysButton(board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
