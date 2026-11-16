// The board's frame in the browser (answering-flow-visual, task 3.1; view-and-widgets spec: The
// board's frame, The ask row, The feedback tray, Tab clears the sticky bars, Single-question board,
// Leave-page prompt). At 1280x800: three header rows, a 256 px rail with the outline over the
// outbox and nothing fixed or sticky at the viewport's bottom; the ask row's tools and its crowded
// and agent-text cases; the tray's message for a question the agent added, with "Go"; Tab to a control
// under the header; the single-question board's two rows. The comfortable Italian case is task 8.1's.
// Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import {
  addedQuestion,
  answeringAsk,
  fortyAsk,
  longTitleAsk,
  type Presentation,
  singleAnsweringAsk,
} from "./fixtures/answering-flow-asks.ts";
import {
  eventually,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { headingOf, lifecycleScenario, openBoard, postponeOf } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const FIRST_VIEW: Record<Presentation, string[]> = {
  sections: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"],
  tabs: ["q1", "q2", "q3"],
  "one-per-view": ["q1"],
};

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`no box for ${locator}`);
  return box;
};

/** The elements fixed or sticky at the viewport's bottom: any with a bottom offset in force. */
const pinnedAtBottom = (board: Board): Promise<string[]> =>
  board.view.locator("body").evaluate((body) => {
    const view = body.ownerDocument.defaultView;
    if (view === null) return [];
    return [...body.ownerDocument.querySelectorAll("*")]
      .filter((element) => {
        const style = view.getComputedStyle(element);
        return (
          (style.position === "fixed" || style.position === "sticky") &&
          style.bottom !== "auto" &&
          style.top === "auto"
        );
      })
      .map((element) => element.tagName.toLowerCase());
  });

/** The header's rows that overflow their width: none may. */
const overflowingRows = (board: Board): Promise<number> =>
  board.view
    .locator("[data-askboard-header], [data-askboard-ask-row], [data-askboard-progress-row]")
    .evaluateAll((rows) => rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the board's frame`, () => {
    const { start } = useEngine(engine);

    const open = async (ask: Parameters<typeof lifecycleScenario>[0], ids: string[]) => {
      const run = await start(lifecycleScenario(ask, dist));
      return { run, board: await openBoard(run, ids) };
    };

    test(
      "sections at the viewport floor: three header rows, a 256 px rail with the outline over the outbox, nothing pinned at the bottom",
      async () => {
        const { board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        const rows = [
          await boxOf(board.whoAndWhere),
          await boxOf(board.askRow),
          await boxOf(board.progressRow),
        ];
        expect(new Set(rows.map((row) => row.height)).size).toBe(1);
        expect(rows[1]?.y).toBeGreaterThan(rows[0]?.y ?? 0);
        expect(rows[2]?.y).toBeGreaterThan(rows[1]?.y ?? 0);
        const rail = await boxOf(board.rail);
        expect(rail.width).toBe(256);
        const outline = await boxOf(board.view.getByRole("navigation", { name: "Outline" }));
        const outbox = await boxOf(board.outbox);
        expect(outline.y).toBeLessThan(outbox.y);
        expect(outbox.y + outbox.height).toBeLessThanOrEqual(800);
        expect(await board.view.getByRole("contentinfo").count()).toBe(0);
        expect(await pinnedAtBottom(board)).toEqual([]);
        expect(await overflowingRows(board)).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "one question per view: the rail shows the outline and the outbox beside the question shown",
      async () => {
        const { board } = await open(answeringAsk("one-per-view"), FIRST_VIEW["one-per-view"]);
        await board.rail.waitFor();
        expect(await board.rail.getByRole("navigation", { name: "Outline" }).count()).toBe(1);
        expect(await board.rail.locator("[data-askboard-outbox]").count()).toBe(1);
        expect((await boxOf(board.rail)).width).toBe(256);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "forty questions: the outline scrolls to its end and the outbox stays at the rail's foot, wholly in view",
      async () => {
        const { board } = await open(fortyAsk(), ["s1"]);
        const outline = board.view.getByRole("navigation", { name: "Outline" });
        const before = await boxOf(board.outbox);
        await outline.evaluate((nav) => {
          const scroller = nav.parentElement;
          if (scroller !== null) scroller.scrollTop = scroller.scrollHeight;
        });
        await eventually(
          async () => (await boxOf(board.outbox)).y === before.y,
          "the outbox in the same place",
        );
        const after = await boxOf(board.outbox);
        expect(after.y + after.height).toBeLessThanOrEqual(800);
        expect(after.y).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the ask row: the tools show, a 120-character title ends in an ellipsis with its text on focus, the ID is isolated and the row keeps its height",
      async () => {
        const { board } = await open(longTitleAsk(), FIRST_VIEW.sections);
        const plain = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        const normal = (await boxOf(plain.board.askRow)).height;
        expect((await boxOf(board.askRow)).height).toBe(normal);
        for (const name of ["Snapshot", "Keys", "Theme", "Settings"]) {
          expect(await board.askRow.getByRole("button", { name, exact: true }).count()).toBe(1);
        }
        const title = board.askRow.getByRole("heading", { level: 1 });
        const clipped = title.locator("[tabindex]");
        expect(await clipped.evaluate((span) => span.scrollWidth > span.clientWidth)).toBe(true);
        await clipped.focus();
        await board.view.getByRole("tooltip").waitFor({ timeout: STEP_TIMEOUT_MS });
        const id = board.askRow.locator("[data-askboard-ask-id]");
        expect(await id.locator("bdi").count()).toBe(1);
        expect(await overflowingRows(board)).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the ask pill's name reads 'Ask: <state>'; the postponed warning shows after the agent pill and no row changes height",
      async () => {
        const { board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        const pill = board.askRow.locator("[data-askboard-ask-pill]");
        expect(await pill.getAttribute("aria-label")).toMatch(/^Ask: /);
        const heights = async () => [
          (await boxOf(board.whoAndWhere)).height,
          (await boxOf(board.askRow)).height,
          (await boxOf(board.progressRow)).height,
        ];
        const before = await heights();
        await postponeOf(board, "q1").click({ timeout: STEP_TIMEOUT_MS });
        const warning = board.askRow.locator("[data-askboard-warning]");
        await warning.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await warning.textContent()).toContain("postponed");
        expect(await heights()).toEqual(before);
        expect(await overflowingRows(board)).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the Theme popover: Dark, then Comfortable, apply at once",
      async () => {
        const { board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        await board.themeControl.click();
        const popover = board.view.getByRole("dialog", { name: "Theme" });
        await popover.getByRole("radio", { name: "Dark", exact: true }).click();
        await eventually(
          () =>
            board.view
              .locator("html.dark")
              .count()
              .then((n) => n === 1),
          "the board dark",
        );
        await popover.getByRole("radio", { name: "Comfortable", exact: true }).click();
        await eventually(
          () =>
            board.view
              .locator("html.comfortable")
              .count()
              .then((n) => n === 1),
          "the board comfortable",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a question the agent adds shows in the tray with Go, focus stays, Go reveals and focuses its heading",
      async () => {
        const { run, board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        const focusBefore = await board.view
          .locator("body")
          .evaluate((body) => body.ownerDocument.activeElement?.tagName);
        await run.session.update([
          { action: "add", item: addedQuestion, parentId: "release", after: "q9" },
        ]);
        const message = board.tray("added");
        await message.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await message.textContent()).toContain("The agent added 1 question: Retention.");
        expect(
          await board.view
            .locator("body")
            .evaluate((body) => body.ownerDocument.activeElement?.tagName),
        ).toBe(focusBefore);
        await message.getByRole("button", { name: "Go", exact: true }).click();
        await eventually(() => isFocused(headingOf(board, "retention")), "focus on Retention");
        await board.tray("added").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the added message ends when the question is seen, without Go",
      async () => {
        const { run, board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        await run.session.update([
          { action: "add", item: addedQuestion, parentId: "release", after: "q9" },
        ]);
        await board.tray("added").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.question("retention").scrollIntoViewIfNeeded();
        await board.tray("added").waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Tab to a control under the header ends it wholly below the header's bottom edge",
      async () => {
        const { board } = await open(answeringAsk("sections"), FIRST_VIEW.sections);
        const target = postponeOf(board, "q2");
        const header = await boxOf(board.header);
        const at = await boxOf(target);
        // Scroll so that "Later" of q2 sits half under the header, then Tab through its card.
        await target.evaluate(
          (element, delta) => {
            element.ownerDocument.defaultView?.scrollBy(0, delta);
          },
          at.y - (header.y + header.height - 10),
        );
        await headingOf(board, "q2").focus();
        for (let step = 0; step < 8; step += 1) {
          await board.page.keyboard.press("Tab");
          await eventually(
            async () => {
              const bounds = await boxOf(board.header);
              const focused = board.view.locator(":focus");
              const box = await focused.boundingBox();
              return box === null || box.y >= bounds.y + bounds.height - 1;
            },
            `focus clear of the header after Tab ${step + 1}`,
          );
        }
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the single-question board's frame`, () => {
    const { start } = useEngine(engine);

    test(
      "two header rows with Snapshot in the second, no rail, the card across the content, nothing pinned at the bottom",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        expect(await board.progressRow.count()).toBe(0);
        expect(await board.rail.count()).toBe(0);
        expect(
          await board.askRow.getByRole("button", { name: "Snapshot", exact: true }).count(),
        ).toBe(1);
        const card = await boxOf(board.question("only"));
        expect(card.width).toBeGreaterThan(1280 - 64);
        expect(await pinnedAtBottom(board)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the postponed warning shows on the single-question board without changing a row's height",
      async () => {
        const run = await start(lifecycleScenario(singleAnsweringAsk, dist));
        const board = await openBoard(run, ["only"]);
        const before = [
          (await boxOf(board.whoAndWhere)).height,
          (await boxOf(board.askRow)).height,
        ];
        await postponeOf(board, "only").click({ timeout: STEP_TIMEOUT_MS });
        await board.askRow.locator("[data-askboard-warning]").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect([
          (await boxOf(board.whoAndWhere)).height,
          (await boxOf(board.askRow)).height,
        ]).toEqual(before);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
