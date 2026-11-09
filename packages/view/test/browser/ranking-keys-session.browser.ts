// The Ranking on the session process, in each engine (keyboard-shortcuts-help, task 4.5; spec
// view-and-widgets: Ranking row selection "Not in the answer", Result widgets read-only, The user's
// keys on the board "The user's keys on a Ranking", Keys left to the browser): a selection is in no
// answer and is gone after a reload; a read-only Ranking shows no check box, takes no move, select
// or keep key and lists in its panel only the keys that still act; a user file the test owns gives
// the keys in effect, which the Ranking takes (the replaced key acts, the removed one is left to the
// browser) and which the tooltip and `aria-keyshortcuts` show; a Snapshot of a Ranking shows no
// check box and keeps the default keys whatever the user file says. The session process serves
// this file whatever the target.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/ranking-keys-session.browser.ts

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT } from "@askboard/contract";
import type { Locator, Page } from "playwright";
import { FIVE_ORDER, rankingFiveAsk } from "./fixtures/ranking-documents.ts";
import {
  eventually,
  isFocused,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { orderShown, rowOf } from "./harness/ranking-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const file = (settings: Record<string, unknown>) => ({ version: "1.0", ...settings });
const scenario = (askId: string, user?: unknown) => ({
  ...lifecycleScenario(rankingFiveAsk(askId), dist),
  ...(user === undefined ? {} : { config: { user } }),
});

const toolbar = (board: Board): Locator =>
  board.view.getByRole("toolbar", { name: "Ranking tools" });
const tool = (board: Board, name: string): Locator =>
  toolbar(board).getByRole("button", { name, exact: true });
const box = (board: Board, id: string): Locator => board.view.locator(`[data-select="${id}"]`);
const selected = (board: Board): Promise<(string | null)[]> =>
  board.view
    .locator('[data-ranking-row][aria-selected="true"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ranking-row")));
const panel = (board: Board): Locator => board.view.getByRole("dialog", { name: "Ranking keys" });
const cap = (board: Board, text: string): Locator =>
  board.view.locator("kbd", { hasText: text }).first();
const aria = (control: Locator): Promise<string | null> =>
  control.getAttribute("aria-keyshortcuts");
const ariaOf = (control: Locator, expected: string | null, what: string) =>
  eventually(async () => (await aria(control)) === expected, what);
const expectOrder = (board: Board, order: readonly string[]): Promise<void> =>
  eventually(
    async () => JSON.stringify(await orderShown(board)) === JSON.stringify(order),
    `the order ${order.join(", ")}`,
  );
const loaded = (board: Board) =>
  board.view
    .locator('[data-askboard-question="plan"]:not([aria-busy="true"])')
    .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });

type Seen = { key: string; prevented: boolean };
const recordPrevented = async (board: Board): Promise<void> => {
  const frame = await board.viewFrame();
  await frame.evaluate(() => {
    const seen: Seen[] = [];
    (globalThis as unknown as Record<string, unknown>).__prevented = seen;
    window.addEventListener("keydown", (event) => {
      if (["Alt", "Shift", "Control", "Meta"].includes(event.key)) return;
      seen.push({ key: event.key, prevented: event.defaultPrevented });
    });
  });
};
const prevented = async (board: Board): Promise<Seen[]> =>
  (await board.viewFrame()).evaluate(
    () => (globalThis as unknown as Record<string, Seen[]>).__prevented ?? [],
  );

const orderIn = (page: Page): Promise<(string | null)[]> =>
  page
    .locator("[data-ranking-row]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ranking-row")));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Ranking on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "two rows selected, answered and reloaded: the answer's order is shown, nothing in it names the selection, and no row is selected",
      async () => {
        const run = await start(scenario("ranking-keys-r1a1"));
        const board = await openBoard(run, ["plan"]);
        await rowOf(board, "b").focus();
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Shift+ArrowDown");
        await eventually(async () => (await selected(board)).length === 2, "two rows selected");
        await board.page.keyboard.press("Enter");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ priorities: { order: FIVE_ORDER } });
        const written = JSON.stringify([events, sentDrafts(run), sentActs(run)]);
        expect(written).not.toMatch(/selected|selection|anchor|aria-/i);
        await reloadBoard(board, run, () => loaded(board));
        expect(await orderShown(board)).toEqual(FIVE_ORDER);
        expect(await selected(board)).toEqual([]);
        expect(await board.view.locator("[data-ranking-selected]").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "once the ask closes the Ranking shows no check box, its select, move and keep keys change nothing, and its panel lists only the keys that still act",
      async () => {
        const run = await start(scenario("ranking-keys-r1a2"), { userAgent: LINUX_UA });
        const board = await openBoard(run, ["plan"]);
        expect(await box(board, "a").count()).toBe(1);
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () => (await board.view.locator("[data-select]").count()) === 0,
          "the check boxes to go",
        );
        const [drafts, acts] = [sentDrafts(run).length, sentActs(run).length];
        await rowOf(board, "c").focus();
        await recordPrevented(board);
        for (const key of ["Space", "Shift+ArrowDown", "Alt+Shift+ArrowUp", "Enter"]) {
          await board.page.keyboard.press(key);
        }
        await Bun.sleep(QUIET_MS);
        expect(await orderShown(board)).toEqual(FIVE_ORDER);
        expect(await selected(board)).toEqual([]);
        expect([sentDrafts(run).length, sentActs(run).length]).toEqual([drafts, acts]);
        // The cursor still moves, and the panel lists the keys that act in a read-only Ranking.
        await board.page.keyboard.press("ArrowDown");
        await eventually(
          async () => (await rowOf(board, "d").getAttribute("aria-current")) === "true",
          "the cursor to move",
        );
        await board.page.keyboard.press("?");
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(board).textContent()) ?? "";
        for (const listed of ["Go up", "Go down", "Show the keys"]) expect(text).toContain(listed);
        for (const unlisted of ["Move up", "To top", "Keep this order", "Select none"]) {
          expect(text).not.toContain(unlisted);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the user file gives to the top Mod+Alt+ArrowUp and select none no key: Alt+Shift+Home moves nothing and is not prevented, Ctrl+Alt+ArrowUp moves the row to the top, Escape leaves both rows selected, and the tooltip and aria-keyshortcuts show the new keys",
      async () => {
        const user = file({ keys: { "move.top": ["Mod+Alt+ArrowUp"], "select.none": [] } });
        const run = await start(scenario("ranking-keys-r1a3", user), { userAgent: LINUX_UA });
        const board = await openBoard(run, ["plan"]);
        const top = tool(board, "To top");
        await ariaOf(top, "Control+Alt+ArrowUp Meta+Alt+ArrowUp", "the user's keys on To top");
        await recordPrevented(board);
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Alt+Shift+Home");
        await Bun.sleep(QUIET_MS);
        expect(await orderShown(board)).toEqual(FIVE_ORDER);
        await board.page.keyboard.press("Control+Alt+ArrowUp");
        await expectOrder(board, ["c", "a", "b", "d", "e"]);
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Shift+ArrowDown");
        await eventually(async () => (await selected(board)).length === 2, "two rows selected");
        await board.page.keyboard.press("Escape");
        await Bun.sleep(QUIET_MS);
        expect((await selected(board)).length).toBe(2);
        const seen = await prevented(board);
        expect(seen.filter(({ key }) => key === "Home").map(({ prevented: p }) => p)).toEqual([
          false,
        ]);
        expect(seen.filter(({ key }) => key === "Escape").map(({ prevented: p }) => p)).toEqual([
          false,
        ]);
        await top.hover();
        await cap(board, "Ctrl+Alt+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(rowOf(board, "a"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Snapshot of a Ranking shows no check box and keeps the default keys, whatever the user file says",
      async () => {
        const user = file({ keys: { "move.up": ["Mod+Alt+ArrowUp"] } });
        const run = await start(scenario("ranking-keys-r1a4", user), { userAgent: LINUX_UA });
        const board = await openBoard(run, ["plan"]);
        await ariaOf(
          tool(board, "Move up"),
          "Control+Alt+ArrowUp Meta+Alt+ArrowUp",
          "the user's keys on the board",
        );
        await rowOf(board, "a").focus();
        await board.page.keyboard.press("Enter");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        expect(html).toContain(`id="${SNAPSHOT_DATA_ELEMENT}"`);
        const browser = await launchEngine(engine);
        try {
          const page = await (
            await browser.newContext({ offline: true, userAgent: LINUX_UA })
          ).newPage();
          await page.goto(`file://${taken.path}`);
          const up = page
            .getByRole("toolbar", { name: "Ranking tools" })
            .getByRole("button", { name: "Move up", exact: true });
          await up.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await orderIn(page)).toEqual(FIVE_ORDER);
          expect(await page.locator("[data-select]").count()).toBe(0);
          expect(await up.getAttribute("aria-keyshortcuts")).toBe("Alt+Shift+ArrowUp");
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
