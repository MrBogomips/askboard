// The key hints, the Keys button, the keys panel and the options' keys, in each engine
// (keyboard-shortcuts-help, tasks 3.3 to 3.5; spec view-and-widgets: Keyboard shortcuts are
// discoverable, The keys panel, Key labels by platform, Keys left to the browser): a probe type with
// a key table (a test-only TextField chunk, `fixtures/keys-probe.ts`) shows a tooltip with the
// action's name and its keys on hover and on focus, which Escape closes, and carries
// `aria-keyshortcuts`; the labels follow the platform; `?` outside a text field, and the Keys
// button, open the panel, named "<Widget> keys", Escape returns the focus, `?` typed in a text field
// opens nothing, a locked item lists only the keys that still act, and no agent text reaches the
// panel; the options of a single and of a multiple choice take the arrows, Home and End with no
// modifier only. No Content Security Policy violation occurs.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/keys-help.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { database } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard, optionOf } from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild, withKeysProbe } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await withKeysProbe(await readViewBuild());
const plainDist = await readViewBuild();

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// The agent's label: markup and a question mark, which the panel must never show.
const LABEL = "<b>x</b> ?";
const probe = (id: string, label = LABEL) => ({ type: "text-field", id, props: { label } });
const one = atomDocument([probe("probe")]);

const tool = (board: Board, id: string, name: "Probe up" | "Probe top"): Locator =>
  board.view.getByRole("button", { name: `${name} ${id}`, exact: true });
const list = (board: Board, id = "probe"): Locator =>
  board.view.locator(`[data-probe-list="${id}"]`);
const keysButton = (board: Board, id = "probe"): Locator =>
  board.view.getByRole("button", { name: `Keys ${id}`, exact: true });
const panel = (board: Board): Locator => board.view.getByRole("dialog", { name: "Ranking keys" });
const cap = (board: Board, text: string): Locator =>
  board.view.locator("kbd", { hasText: text }).first();

// Records, at the window, whether the default of each keydown but a modifier's own was prevented by
// the time the event got there; a chord such as Alt+ArrowDown sends the modifier's keydown first.
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

const KEYS = ["Alt+ArrowDown", "Alt+ArrowUp", "Shift+ArrowDown", "Shift+Home", "Alt+End"] as const;

const insideDialog = (board: Board): Promise<boolean> =>
  board
    .viewFrame()
    .then((frame) =>
      frame.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
    );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: key hints`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "hovering a control shows its name and keys as caps, and its aria-keyshortcuts is the table's",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        const up = tool(run.board, "probe", "Probe up");
        expect(await up.getAttribute("aria-keyshortcuts")).toBe("Alt+Shift+ArrowUp");
        await up.hover();
        await cap(run.board, "Alt+Shift+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.board.view.getByText("Move up", { exact: true }).first().waitFor();
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "keyboard focus shows it too, and Escape closes it",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        await tool(run.board, "probe", "Probe top").focus();
        await cap(run.board, "Alt+Shift+Home").waitFor({ timeout: STEP_TIMEOUT_MS });
        await cap(run.board, "Ctrl+Shift+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tool(run.board, "probe", "Probe top").getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
        );
        await run.board.page.keyboard.press("Escape");
        await eventually(
          async () => (await cap(run.board, "Alt+Shift+Home").count()) === 0,
          "the tooltip to close",
        );
        expect(await isFocused(tool(run.board, "probe", "Probe top"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the labels follow the platform: symbols on macOS, names elsewhere, the same aria-keyshortcuts",
      async () => {
        const mac = await host(dist, one, { userAgent: MAC_UA });
        await readyIn(mac);
        await tool(mac.board, "probe", "Probe up").hover();
        await cap(mac.board, "⌥⇧↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tool(mac.board, "probe", "Probe up").getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+ArrowUp",
        );
        // Leave the first tooltip well away before the second control: Radix keeps it open while the
        // pointer is in its grace area, and holds the pointer in transit toward it.
        await mac.board.page.mouse.move(600, 700, { steps: 5 });
        await eventually(
          async () => (await cap(mac.board, "⌥⇧↑").count()) === 0,
          "the first tooltip to close",
        );
        await tool(mac.board, "probe", "Probe top").hover();
        await cap(mac.board, "⇧⌘↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        const linux = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(linux);
        await tool(linux.board, "probe", "Probe up").hover();
        await cap(linux.board, "Alt+Shift+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tool(linux.board, "probe", "Probe up").getAttribute("aria-keyshortcuts")).toBe(
          "Alt+Shift+ArrowUp",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the keys panel`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "`?` on the list opens the panel by group, with the focus in it; Escape closes it and the focus is back on the list",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        await list(run.board).focus();
        await run.board.page.keyboard.press("?");
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(run.board).textContent()) ?? "";
        for (const expected of ["Move around", "Go down", "Move items", "Move up", "To top"]) {
          expect(text).toContain(expected);
        }
        expect(text).not.toContain("Move to…");
        await eventually(() => insideDialog(run.board), "the focus to move into the panel");
        await run.board.page.keyboard.press("Escape");
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(list(run.board))).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the Keys button opens the panel, which holds no text the agent sent; Escape returns the focus to the button",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        await keysButton(run.board).click();
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(run.board).textContent()) ?? "";
        expect(text).not.toContain("<b>");
        expect(text).not.toContain("x ?");
        expect(await panel(run.board).locator("b").count()).toBe(0);
        await run.board.page.keyboard.press("Escape");
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(keysButton(run.board))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "`?` typed in a text field inside the item is typed, and no panel opens",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        const field = run.board.view.locator('[data-probe-text="probe"]');
        await field.focus();
        await run.board.page.keyboard.press("?");
        expect(await field.inputValue()).toBe("?");
        await Bun.sleep(QUIET_MS);
        expect(await panel(run.board).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an item among others opens its own panel and no other",
      async () => {
        const run = await host(
          dist,
          atomDocument([probe("first", "one"), probe("second", "two")]),
          { userAgent: LINUX_UA },
        );
        await readyIn(run);
        await list(run.board, "second").focus();
        await run.board.page.keyboard.press("?");
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await run.board.view.getByRole("dialog").count()).toBe(1);
        expect(await panel(run.board).getAttribute("data-askboard-keys-for")).toBe("second");
        await run.board.page.keyboard.press("Escape");
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(list(run.board, "second"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on another item's text field closes the panel and leaves the focus in that field",
      async () => {
        const run = await host(
          dist,
          atomDocument([probe("first", "one"), probe("second", "two")]),
          { userAgent: LINUX_UA },
        );
        await readyIn(run);
        await list(run.board, "second").focus();
        await run.board.page.keyboard.press("?");
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const field = run.board.view.locator('[data-probe-text="first"]');
        await field.click();
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(field), "the focus to stay in the field clicked");
        expect(await isFocused(list(run.board, "second"))).toBe(false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Close returns the focus to the element that held it before the panel opened",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        await list(run.board).focus();
        await run.board.page.keyboard.press("?");
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await panel(run.board).getByRole("button", { name: "Close", exact: true }).click();
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(list(run.board)), "the focus to return to the list");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an item inside a Group opens its own panel on `?`: the nearest frame wins",
      async () => {
        const group = {
          type: "group",
          id: "outer",
          props: { title: "Outer", items: [probe("inner", "inner"), probe("sibling", "sibling")] },
        };
        const run = await host(dist, atomDocument([group]), { userAgent: LINUX_UA });
        await readyIn(run);
        await list(run.board, "inner").focus();
        await run.board.page.keyboard.press("?");
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await run.board.view.getByRole("dialog").count()).toBe(1);
        expect(await panel(run.board).getAttribute("data-askboard-keys-for")).toBe("inner");
        await run.board.page.keyboard.press("Escape");
        await panel(run.board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(list(run.board, "inner"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a locked item lists only the keys that still act: the cursor, selection and panel keys, no move",
      async () => {
        const run = await host(dist, one, { userAgent: LINUX_UA });
        await readyIn(run);
        await run.update({ type: "state", state: openStateOf(one), lock: "closed" });
        await eventually(
          async () => (await run.board.view.getByText("Closed", { exact: false }).count()) > 0,
          "the view to show the lock",
        );
        await keysButton(run.board).click();
        await panel(run.board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(run.board).textContent()) ?? "";
        expect(text).toContain("Go down");
        expect(text).toContain("Select");
        expect(text).toContain("Show the keys");
        expect(text).not.toContain("Move up");
        expect(text).not.toContain("To top");
        expect(text).not.toContain("Next tool");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the options' keys`, () => {
    const { start } = useEngine(engine);
    const multiple = {
      ...database("multi"),
      props: { ...database("multi").props, multiSelect: true },
    };
    const ask = {
      askId: "options-keys-d4e5",
      title: "Options",
      items: [database(), multiple],
    };

    test(
      "Alt with an arrow, Shift with an arrow, Home and End keep the focus on a single choice's option, check nothing and keep their default; with no modifier the arrow moves the focus",
      async () => {
        const run = await start(lifecycleScenario(ask, plainDist));
        const board = await openBoard(run, ["database", "multi"]);
        await recordPrevented(board);
        const option = optionOf(board, "database", "PostgreSQL");
        await option.focus();
        for (const keys of [
          "Alt+ArrowDown",
          "Alt+ArrowUp",
          "Shift+ArrowDown",
          "Shift+Home",
          "Alt+End",
        ]) {
          await board.page.keyboard.press(keys);
          expect(await isFocused(option)).toBe(true);
        }
        expect(await optionOf(board, "database", "SQLite").getAttribute("aria-checked")).toBe(
          "false",
        );
        expect(await option.getAttribute("aria-checked")).toBe("false");
        expect((await prevented(board)).map((each) => each.prevented)).toEqual([
          false,
          false,
          false,
          false,
          false,
        ]);
        await board.page.keyboard.press("ArrowDown");
        await eventually(
          () => isFocused(optionOf(board, "database", "SQLite")),
          "the focus to move to the next option",
        );
        expect((await prevented(board))[5]).toEqual({ key: "ArrowDown", prevented: true });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the same on a multiple choice's box: the focus stays, nothing is checked and the default is kept",
      async () => {
        const run = await start(lifecycleScenario(ask, plainDist));
        const board = await openBoard(run, ["database", "multi"]);
        await recordPrevented(board);
        const box = optionOf(board, "multi", "PostgreSQL");
        await box.focus();
        for (const keys of [
          "Alt+ArrowDown",
          "Alt+ArrowUp",
          "Shift+ArrowDown",
          "Shift+Home",
          "Alt+End",
        ]) {
          await board.page.keyboard.press(keys);
          expect(await isFocused(box)).toBe(true);
        }
        expect(await box.getAttribute("aria-checked")).toBe("false");
        expect(await optionOf(board, "multi", "SQLite").getAttribute("aria-checked")).toBe("false");
        expect((await prevented(board)).map((each) => each.prevented)).toEqual([
          false,
          false,
          false,
          false,
          false,
        ]);
        await board.page.keyboard.press("ArrowDown");
        await eventually(
          () => isFocused(optionOf(board, "multi", "SQLite")),
          "the focus to move to the next box",
        );
        expect((await prevented(board))[5]).toEqual({ key: "ArrowDown", prevented: true });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
