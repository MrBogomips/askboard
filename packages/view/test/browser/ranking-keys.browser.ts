// The Ranking's selection, moves, keys, tooltips and keys panel, in each engine, on the widget host
// (keyboard-shortcuts-help, task 4.5; spec view-and-widgets: Ranking row selection, Moving a
// Ranking's selection, Ranking at the keyboard, Keyboard shortcuts are discoverable, Key labels by
// platform, The approved keys outside the core vocabulary): a Ranking of five rows. A range by
// keyboard and by mouse, Escape selecting none and leaving its default when nothing is selected,
// the moves on a selection and on the current row, Enter keeping the order, a crowded toolbar with
// "More" and the Keys button last, the tooltip on focus and on hover, the labels by platform, and
// the panel with Escape where it acts. The scenarios that need the session process (a reload, a
// closed ask, the user's keys, a Snapshot) are in `ranking-keys-session.browser.ts`.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/ranking-keys.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { FIVE_ORDER, rankingFiveDocument } from "./fixtures/ranking-documents.ts";
import { eventually, isFocused, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import { orderShown, rowOf } from "./harness/ranking-drag.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const toolbar = (board: Board): Locator =>
  board.view.getByRole("toolbar", { name: "Ranking tools" });
const tool = (board: Board, name: string): Locator =>
  toolbar(board).getByRole("button", { name, exact: true });
const box = (board: Board, id: string): Locator => board.view.locator(`[data-select="${id}"]`);
const selected = (board: Board): Promise<(string | null)[]> =>
  board.view
    .locator('[data-ranking-row][aria-selected="true"]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ranking-row")));
const count = (board: Board): Locator => board.view.locator("[data-ranking-selected]");
const cap = (board: Board, text: string): Locator =>
  board.view.locator("kbd", { hasText: text }).first();
const panel = (board: Board): Locator => board.view.getByRole("dialog", { name: "Ranking keys" });

const expectOrder = (board: Board, order: readonly string[]): Promise<void> =>
  eventually(
    async () => JSON.stringify(await orderShown(board)) === JSON.stringify(order),
    `the order ${order.join(", ")}`,
  );
const expectSelected = (board: Board, ids: readonly string[]): Promise<void> =>
  eventually(
    async () => JSON.stringify(await selected(board)) === JSON.stringify(ids),
    `the rows ${ids.join(", ") || "none"} selected`,
  );
const expectCurrent = (board: Board, id: string): Promise<void> =>
  eventually(
    async () => (await rowOf(board, id).getAttribute("aria-current")) === "true",
    `${id} to be current`,
  );
const draftOrder = (run: WidgetHostRun, order: readonly string[]): Promise<void> =>
  eventually(
    () => draftHolds(run.drafts, "plan", "priorities", { order }),
    `the draft to hold ${order.join(", ")}`,
  );

// Records, at the window, each keydown but a modifier's own and whether its default had been
// prevented by the time the event got there.
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

// Opens the five-row Ranking on a widget host, on the platform the user agent names.
const open = async (host: ReturnType<typeof useWidgetHost>["host"], userAgent = LINUX_UA) => {
  const run = await host(dist, rankingFiveDocument(), { userAgent });
  await readyIn(run);
  return run;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Ranking's selection`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Space on the second row, then Shift+ArrowDown twice, selects the second to the fourth, the fourth current, and the toolbar reads 3 selected",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "b").focus();
        await board.page.keyboard.press("Space");
        await expectSelected(board, ["b"]);
        await board.page.keyboard.press("Shift+ArrowDown");
        await board.page.keyboard.press("Shift+ArrowDown");
        await expectSelected(board, ["b", "c", "d"]);
        await expectCurrent(board, "d");
        await eventually(
          async () => (await count(board).textContent())?.trim() === "3 selected",
          "3 selected",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on the first row's check box, then Shift+click on the third's, selects the first three; the box takes no focus",
      async () => {
        const { board } = await open(host);
        await box(board, "a").click();
        await expectSelected(board, ["a"]);
        await box(board, "c").click({ modifiers: ["Shift"] });
        await expectSelected(board, ["a", "b", "c"]);
        await expectCurrent(board, "c");
        expect(await isFocused(rowOf(board, "c"))).toBe(true);
        expect(await box(board, "a").getAttribute("tabindex")).toBe("-1");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape with two rows selected selects none and keeps the current row, and a second Escape is not prevented",
      async () => {
        const { board } = await open(host);
        await recordPrevented(board);
        await rowOf(board, "b").focus();
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Shift+ArrowDown");
        await expectSelected(board, ["b", "c"]);
        await board.page.keyboard.press("Escape");
        await expectSelected(board, []);
        expect(await count(board).count()).toBe(0);
        await expectCurrent(board, "c");
        await board.page.keyboard.press("Escape");
        const escapes = (await prevented(board)).filter(({ key }) => key === "Escape");
        expect(escapes.map(({ prevented: taken }) => taken)).toEqual([true, false]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the Select none tool clears the selection and is disabled when nothing is selected",
      async () => {
        const { board } = await open(host);
        expect(await tool(board, "Select none").getAttribute("aria-disabled")).toBe("true");
        await box(board, "b").click();
        await expectSelected(board, ["b"]);
        await tool(board, "Select none").click();
        await expectSelected(board, []);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: moving the Ranking's selection`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "b and d selected, Move up gives b, a, d, c, e and both stay selected",
      async () => {
        const run = await open(host);
        const { board } = run;
        await box(board, "b").click();
        await box(board, "d").click();
        await tool(board, "Move up").click();
        await expectOrder(board, ["b", "a", "d", "c", "e"]);
        await expectSelected(board, ["b", "d"]);
        await draftOrder(run, ["b", "a", "d", "c", "e"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a and c selected, Alt+Shift+ArrowUp gives a, c, b, d, e: the row at the top stays",
      async () => {
        const { board } = await open(host);
        await box(board, "a").click();
        await box(board, "c").click();
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Alt+Shift+ArrowUp");
        await expectOrder(board, ["a", "c", "b", "d", "e"]);
        expect(await isFocused(rowOf(board, "c"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "b and d selected, To top gives b, d, a, c, e, and Move up and To top are disabled",
      async () => {
        const { board } = await open(host);
        await box(board, "b").click();
        await box(board, "d").click();
        await tool(board, "To top").click();
        await expectOrder(board, ["b", "d", "a", "c", "e"]);
        for (const name of ["Move up", "To top"]) {
          expect(await tool(board, name).getAttribute("aria-disabled")).toBe("true");
        }
        expect(await tool(board, "Move down").getAttribute("aria-disabled")).toBeNull();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with no selection, the third row current and Alt+Shift+End pressed, that row is last and still current",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Alt+Shift+End");
        await expectOrder(board, ["a", "b", "d", "e", "c"]);
        await expectCurrent(board, "c");
        expect(await isFocused(rowOf(board, "c"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Alt+Shift+ArrowUp then Alt+Shift+End move the third row second, then last, current throughout, and the page has not navigated",
      async () => {
        const { board } = await open(host);
        const before = board.page.url();
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Alt+Shift+ArrowUp");
        await expectOrder(board, ["a", "c", "b", "d", "e"]);
        await expectCurrent(board, "c");
        await board.page.keyboard.press("Alt+Shift+End");
        await expectOrder(board, ["a", "b", "d", "e", "c"]);
        await expectCurrent(board, "c");
        expect(board.page.url()).toBe(before);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Cmd or Ctrl+Shift+ArrowUp goes to the top as Alt+Shift+Home does",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "d").focus();
        await board.page.keyboard.press("Control+Shift+ArrowUp");
        await expectOrder(board, ["d", "a", "b", "c", "e"]);
        await board.page.keyboard.press("Alt+Shift+End");
        await board.page.keyboard.press("Alt+Shift+Home");
        await expectOrder(board, ["d", "a", "b", "c", "e"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Enter on an untouched Ranking's list keeps the agent's order: the draft holds it and Answer is enabled",
      async () => {
        const run = await open(host);
        const { board } = run;
        expect(await board.answer.isDisabled()).toBe(true);
        await rowOf(board, "a").focus();
        await board.page.keyboard.press("Enter");
        await draftOrder(run, FIVE_ORDER);
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Ranking's toolbar, tooltips and keys panel`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a crowded toolbar gives To top, To bottom and Select none to More, and the Keys button stays the last stop",
      async () => {
        const { board } = await open(host);
        await board.page.setViewportSize({ width: 520, height: 800 });
        await tool(board, "More").waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const name of ["To top", "To bottom", "Select none"]) {
          expect(await tool(board, name).count()).toBe(0);
        }
        await tool(board, "More").click();
        const items = board.view.getByRole("menuitem");
        await items.first().waitFor({ timeout: STEP_TIMEOUT_MS });
        // Each item ends with its keys as key caps, hidden from assistive technology, and still
        // announces them through aria-keyshortcuts (review 4.6, S-49).
        const texts = await items.allTextContents();
        expect(texts[0]).toStartWith("To top");
        expect(texts[0]).toEndWith("Alt+Shift+HomeCtrl+Shift+↑");
        expect(texts[1]).toStartWith("To bottom");
        expect(texts[1]).toEndWith("Alt+Shift+EndCtrl+Shift+↓");
        expect(texts[2]).toBe("Select noneEsc");
        const top = board.view.getByRole("menuitem", { name: "To top", exact: true });
        expect(await top.getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
        );
        expect(await top.locator("kbd").allTextContents()).toEqual([
          "Alt+Shift+Home",
          "Ctrl+Shift+↑",
        ]);
        await board.page.keyboard.press("Escape");
        const names = await toolbar(board).getByRole("button").allTextContents();
        expect(names.at(-1)).toBe("Keys");
        expect(names).toEqual(["Move up", "Move down", "Keep this order", "More", "Keys"]);
        // A tool of the menu acts: the first row goes last.
        await tool(board, "More").click();
        await board.view.getByRole("menuitem", { name: "To bottom" }).click();
        await expectOrder(board, ["b", "c", "d", "e", "a"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "tabbing to the toolbar and moving to Move up with the arrow keys shows its tooltip, and Move up's aria-keyshortcuts is Alt+Shift+ArrowUp",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("Shift+Tab");
        await board.page.keyboard.press("ArrowRight");
        await board.page.keyboard.press("ArrowLeft");
        await eventually(() => isFocused(tool(board, "Move up")), "focus on Move up");
        await cap(board, "Alt+Shift+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByText("Move up", { exact: true }).first().waitFor();
        expect(await tool(board, "Move up").getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+ArrowUp",
        );
        // The Keys button is the toolbar's last stop: End reaches it.
        await board.page.keyboard.press("End");
        await eventually(
          () => isFocused(toolbar(board).getByRole("button", { name: "Keys", exact: true })),
          "focus on Keys",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the pointer resting on To top shows its name with Alt+Shift+Home and Ctrl+Shift+↑ on Linux, and aria-keyshortcuts names Control and Meta",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "c").focus();
        await tool(board, "To top").hover();
        await cap(board, "Alt+Shift+Home").waitFor({ timeout: STEP_TIMEOUT_MS });
        await cap(board, "Ctrl+Shift+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tool(board, "To top").getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Move up reads ⌥⇧↑ on macOS and Alt+Shift+↑ on Linux, with the same aria-keyshortcuts",
      async () => {
        for (const [userAgent, caps] of [
          [MAC_UA, "⌥⇧↑"],
          [LINUX_UA, "Alt+Shift+↑"],
        ] as const) {
          const { board } = await open(host, userAgent);
          await rowOf(board, "c").focus();
          await tool(board, "Move up").hover();
          await cap(board, caps).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await tool(board, "Move up").getAttribute("aria-keyshortcuts")).toBe(
            "Alt+Shift+ArrowUp",
          );
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the keys panel lists To top with Alt+Shift+Home and Ctrl+Shift+↑ on Linux; the Keys button and ? open it, and a bare ? in the list is not the page's",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "c").focus();
        await board.page.keyboard.press("?");
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(board).textContent()) ?? "";
        expect(text).toContain("To top");
        expect(text).toContain("Alt+Shift+Home");
        expect(text).toContain("Ctrl+Shift+↑");
        expect(text).toContain("Keep this order");
        await board.page.keyboard.press("Escape");
        await panel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await toolbar(board).getByRole("button", { name: "Keys", exact: true }).click();
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "two rows selected, Escape closes the keys panel and keeps the selection, and Escape on the list then selects none",
      async () => {
        const { board } = await open(host);
        await rowOf(board, "b").focus();
        await board.page.keyboard.press("Space");
        await board.page.keyboard.press("Shift+ArrowDown");
        await expectSelected(board, ["b", "c"]);
        await board.page.keyboard.press("?");
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await panel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await expectSelected(board, ["b", "c"]);
        await eventually(() => isFocused(rowOf(board, "c")), "the focus back on the row");
        await board.page.keyboard.press("Escape");
        await expectSelected(board, []);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the Ranking draws no Content Security Policy violation across these scenarios",
      async () => {
        const run = await open(host);
        const { board } = run;
        await box(board, "b").click();
        await tool(board, "To top").hover();
        await board.page.keyboard.press("?");
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
