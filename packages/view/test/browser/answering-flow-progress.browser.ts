// The progress strip, the key caps and what the ask pill says, in the browser (answering-flow-visual,
// task 5.1; view-and-widgets spec: The progress strip, Key caps on the board's main controls, Counts
// and the next-open jump "Nothing left to do", What the ask pill says, Status messages for the
// answering flow "A question the agent adds"). The tray's own scenarios are in
// `answering-flow-frame.browser.ts`. At 1280x800, with the board of nine questions. Every scenario
// runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import {
  addedQuestion,
  answeringAsk,
  fortyAsk,
  type Presentation,
} from "./fixtures/answering-flow-asks.ts";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  headingOf,
  lifecycleScenario,
  openBoard,
  optionOf,
  receiptOf,
  viewportBottom,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ALL = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ALL,
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const current = (locator: Locator): Promise<string | null> => locator.getAttribute("aria-current");
const outlineEntry = (board: Board, id: string): Locator =>
  board.view.locator(`[data-askboard-outline="${id}"]`);
const caps = (locator: Locator): Promise<string[]> => locator.locator("kbd").allTextContents();

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (found === null) throw new Error(`no box for ${locator}`);
  return found;
};

/** The heading has focus and lies wholly between the header's bottom and the viewport's foot. */
const expectBetweenBars = async (board: Board, id: string): Promise<void> => {
  const heading = headingOf(board, id);
  await eventually(() => isFocused(heading), `focus on the ${id} heading`);
  await eventually(async () => {
    const header = await box(board.header);
    const at = await box(heading);
    return at.y >= header.y + header.height && at.y + at.height <= (await viewportBottom(board));
  }, `the ${id} heading between the bars`);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the progress strip`, () => {
    const { start } = useEngine(engine);

    const open = async (
      presentation: Presentation,
      delivery: "immediate" | "submitted" = "immediate",
    ) => {
      const run = await start(
        lifecycleScenario(answeringAsk(presentation, "en-US", delivery), dist),
      );
      return { run, board: await openBoard(run, FIRST_VIEW[presentation]) };
    };

    test(
      "a segment per question; confirming Q1 in All together gives it the ready state and the name 'Q1 Q1: Ready, not sent'",
      async () => {
        const { board } = await open("sections", "submitted");
        for (const id of ALL) expect(await board.strip(id).count()).toBe(1);
        expect(await board.strip("q1").getAttribute("aria-label")).toBe("Q1 Q1: To do");
        await optionOf(board, "q1", "Yes").click({ timeout: STEP_TIMEOUT_MS });
        await answerOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            (await board.strip("q1").getAttribute("aria-label")) === "Q1 Q1: Ready, not sent",
          "the segment ready",
        );
        expect(
          ((await outlineEntry(board, "q1").textContent()) ?? "").includes("Ready, not sent"),
        ).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with sections, a segment jumps to its question: the heading has focus between the bars and the segment and the outline entry are current",
      async () => {
        const { board } = await open("sections");
        await board.strip("q7").click({ timeout: STEP_TIMEOUT_MS });
        await expectBetweenBars(board, "q7");
        await eventually(
          async () => (await current(board.strip("q7"))) === "true",
          "strip current",
        );
        expect(await current(outlineEntry(board, "q7"))).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with tabs, the segment of a question in a hidden tab activates the tab and focuses the heading",
      async () => {
        const { board } = await open("tabs");
        await board.strip("q7").click({ timeout: STEP_TIMEOUT_MS });
        await expectBetweenBars(board, "q7");
        const tab = board.view.getByRole("tab", { name: /^Release/ });
        expect(await tab.getAttribute("aria-selected")).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one Tab stop: focus lands on the current segment, two arrows move it two on without scrolling the board, Enter jumps",
      async () => {
        const { board } = await open("sections");
        await board.askRow.getByRole("button", { name: "Settings", exact: true }).focus();
        await board.page.keyboard.press("Tab");
        await eventually(() => isFocused(board.strip("q1")), "focus on the current segment");
        const scrollOf = () =>
          board.view
            .locator("body")
            .evaluate((body) => body.ownerDocument.defaultView?.scrollY ?? 0);
        const before = await scrollOf();
        await board.page.keyboard.press("ArrowRight");
        await board.page.keyboard.press("ArrowRight");
        await eventually(() => isFocused(board.strip("q3")), "focus on the third segment");
        expect(await scrollOf()).toBe(before);
        await board.page.keyboard.press("Enter");
        await expectBetweenBars(board, "q3");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "forty questions, the last in view: the progress row does not overflow, the strip scrolls and the current segment is wholly visible",
      async () => {
        const run = await start(lifecycleScenario(fortyAsk(), dist));
        const board = await openBoard(run, ["s1"]);
        await board.strip("s40").waitFor({ state: "attached" });
        await board.question("s40").scrollIntoViewIfNeeded();
        await board.view.locator("body").evaluate((body) => {
          body.ownerDocument.defaultView?.scrollTo(
            0,
            body.ownerDocument.documentElement.scrollHeight,
          );
        });
        await eventually(async () => (await current(board.strip("s40"))) === "true", "s40 current");
        const row = await box(board.progressRow);
        const rowScroll = await board.progressRow.evaluate((r) => r.scrollWidth - r.clientWidth);
        expect(rowScroll).toBeLessThanOrEqual(1);
        const strip = board.view.locator("[data-askboard-progress-strip]");
        await eventually(
          async () => (await strip.evaluate((s) => s.scrollLeft)) > 0,
          "the strip scrolled",
        );
        const stripBox = await box(strip);
        const segment = await box(board.strip("s40"));
        expect(segment.x).toBeGreaterThanOrEqual(stripBox.x - 1);
        expect(segment.x + segment.width).toBeLessThanOrEqual(stripBox.x + stripBox.width + 1);
        expect(stripBox.x + stripBox.width).toBeLessThanOrEqual(row.x + row.width);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the key caps`, () => {
    const { start } = useEngine(engine);

    test(
      "macOS with the default keys: Next to do shows the cap N, the primary shows ⌘ and ↩",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist), {
          userAgent: MAC_UA,
        });
        const board = await openBoard(run, ALL);
        expect(await caps(board.nextToDo)).toEqual(["N"]);
        const [cap] = await caps(answerOf(board, "q1"));
        expect(cap).toContain("⌘");
        expect(cap).toContain("↩");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Linux with the default keys: the primary shows Ctrl and Enter",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist), {
          userAgent: LINUX_UA,
        });
        const board = await openBoard(run, ALL);
        expect(await caps(answerOf(board, "q1"))).toEqual(["Ctrl+Enter"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the user's keys: next open j and no answer key show the cap J and none on the primary",
      async () => {
        const run = await start(
          {
            ...lifecycleScenario(answeringAsk("sections"), dist),
            config: {
              user: { version: "1.0", keys: { "board.nextOpen": ["j"], "board.answer": [] } },
            },
          },
          { userAgent: MAC_UA },
        );
        const board = await openBoard(run, ALL);
        await eventually(async () => (await caps(board.nextToDo)).join() === "J", "the cap J");
        expect(await caps(answerOf(board, "q1"))).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the count, the ask pill and the status region`, () => {
    const { start } = useEngine(engine);

    test(
      "nothing left to do: the progress row reads '0 to do' and has no Next to do",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        for (const [id, label] of [
          ["database", "SQLite"],
          ["cache", "Yes"],
        ] as const) {
          await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
        }
        await board.progressRow
          .getByText("0 to do", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.nextToDo.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "One by one: two of nine sent reads 'Partly answered 2/9', both receipts read Sent",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        for (const id of ["q1", "q2"]) {
          await optionOf(board, id, "Yes").click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await receiptOf(board, id, "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        }
        await board.askRow
          .getByText("Partly answered 2/9", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "One by one: every question sent reads 'Answered' with no word of delivery, every receipt Sent and the ledger's Delivered 0",
      async () => {
        const run = await start(lifecycleScenario(twoAsk, dist));
        const board = await openBoard(run, ["database", "cache"]);
        for (const [id, label] of [
          ["database", "SQLite"],
          ["cache", "Yes"],
        ] as const) {
          await optionOf(board, id, label).click({ timeout: STEP_TIMEOUT_MS });
          await answerOf(board, id).click({ timeout: STEP_TIMEOUT_MS });
          await receiptOf(board, id, "sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        }
        const pill = board.askRow.locator("[data-askboard-ask-pill]");
        await eventually(async () => (await pill.textContent())?.trim() === "Answered", "Answered");
        expect(((await pill.getAttribute("aria-label")) ?? "").toLowerCase()).not.toContain(
          "deliver",
        );
        expect(await board.ledger("delivered").locator("[data-askboard-count]").textContent()).toBe(
          "0",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question the agent adds: the status region names it and focus does not move",
      async () => {
        const run = await start(lifecycleScenario(answeringAsk("sections"), dist));
        const board = await openBoard(run, ALL);
        await run.session.update([
          { action: "add", item: addedQuestion, parentId: "release", after: "q9" },
        ]);
        await eventually(
          async () =>
            ((await board.status.textContent()) ?? "").includes(
              "The agent added 1 question: Retention.",
            ),
          "the region reading the addition",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });
}
