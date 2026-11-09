// The user's keys on the board and in the settings panel, in each engine and on the session
// process (keyboard-shortcuts-help, task 10.4; spec view-and-widgets: The user's keys on the board,
// The keys panel shows the user's changes, The settings panel): a session process whose user file
// (under the `XDG_CONFIG_HOME` the harness owns) gives keys to the probe type's actions. The probe
// type is a test-only TextField chunk with a key table (`fixtures/keys-probe.ts`); it acts on no
// key itself, so what these scenarios check is what the view shows and takes: the tooltip,
// `aria-keyshortcuts` and the panel, the panel's own key, and the settings panel's Keys row.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/keys-config.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { atomAsk } from "./fixtures/atom-documents.ts";
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
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild, withKeysProbe } from "./harness/view-build.ts";

const dist = await withKeysProbe(await readViewBuild());

const LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const probe = (id: string) => ({ type: "text-field", id, props: { label: `probe ${id}` } });
const file = (settings: Record<string, unknown>) => ({ version: "1.0", ...settings });
const scenario = (config: { user?: unknown; project?: unknown }, askId: string) => ({
  ...lifecycleScenario(atomAsk([probe("first"), probe("second")], { askId }), dist),
  config,
});

const tool = (board: Board, id: string, name: "Probe up" | "Probe top"): Locator =>
  board.view.getByRole("button", { name: `${name} ${id}`, exact: true });
const list = (board: Board, id: string): Locator => board.view.locator(`[data-probe-list="${id}"]`);
const keysButton = (board: Board, id: string): Locator =>
  board.view.getByRole("button", { name: `Keys ${id}`, exact: true });
const panel = (board: Board): Locator => board.view.getByRole("dialog", { name: "Ranking keys" });
const cap = (board: Board, text: string): Locator =>
  board.view.locator("kbd", { hasText: text }).first();
const aria = (control: Locator): Promise<string | null> =>
  control.getAttribute("aria-keyshortcuts");

const settingsPanel = (board: Board) => board.page.getByRole("complementary", { name: "Settings" });
const openSettings = async (board: Board) => {
  await board.view
    .getByRole("banner")
    .getByRole("button", { name: "Settings", exact: true })
    .click({ timeout: STEP_TIMEOUT_MS });
  await settingsPanel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
};

// The view applies the user's keys with its first update after it boots, so each check waits.
const ariaOf = (control: Locator, expected: string | null, what: string) =>
  eventually(async () => (await aria(control)) === expected, what);

const CHORD = "Control+Alt+Enter";
const MOD_ALT_ENTER = "Control+Alt+Enter Meta+Alt+Enter";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the user's keys on the board`, () => {
    const { start } = useEngine(engine);

    test(
      "a user file's keys show in the tooltip, in aria-keyshortcuts and in the panel, with a removed action kept and marked",
      async () => {
        const run = await start(
          scenario(
            { user: file({ keys: { "move.up": ["Mod+Alt+ArrowUp"], "move.top": [] } }) },
            "keys-user-k1a1",
          ),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        const up = tool(board, "first", "Probe up");
        await ariaOf(up, "Control+Alt+ArrowUp Meta+Alt+ArrowUp", "the user's keys on Move up");
        await up.hover();
        await cap(board, "Ctrl+Alt+↑").waitFor({ timeout: STEP_TIMEOUT_MS });
        // A removed action keeps its tooltip, with its name and no key, and has no attribute.
        const top = tool(board, "first", "Probe top");
        expect(await aria(top)).toBeNull();
        await board.page.mouse.move(600, 700, { steps: 5 });
        await eventually(
          async () => (await cap(board, "Ctrl+Alt+↑").count()) === 0,
          "tooltip gone",
        );
        await top.hover();
        await board.view.getByText("To top", { exact: true }).first().waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        expect(await board.view.locator("kbd").count()).toBe(0);
        await board.page.mouse.move(600, 700, { steps: 5 });
        await keysButton(board, "first").click();
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const row = (name: string) => panel(board).locator("li", { hasText: name });
        const changed = (await row("Move up").textContent()) ?? "";
        expect(changed).toContain("customised");
        expect(changed).toContain("Ctrl+Alt+↑");
        const removed = (await row("To top").textContent()) ?? "";
        expect(removed).toContain("customised");
        expect(removed).toContain("no key");
        expect((await row("Go down").textContent()) ?? "").not.toContain("customised");
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "keys.open rebound opens the panel and `?` opens nothing; a click elsewhere closes it and leaves the focus there",
      async () => {
        const run = await start(
          scenario({ user: file({ keys: { "keys.open": ["Mod+Alt+Enter"] } }) }, "keys-open-k1a2"),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await ariaOf(keysButton(board, "second"), MOD_ALT_ENTER, "the Keys button's new keys");
        await list(board, "second").focus();
        await board.page.keyboard.press("?");
        await Bun.sleep(QUIET_MS);
        expect(await panel(board).count()).toBe(0);
        await board.page.keyboard.press(CHORD);
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(((await panel(board).textContent()) ?? "").includes("Ctrl+Alt+Enter")).toBe(true);
        const field = board.view.locator('[data-probe-text="first"]');
        await field.click();
        await panel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(field), "the focus to stay in the field clicked");
        // Escape from a panel the rebound key opened gives the focus back.
        await list(board, "second").focus();
        await board.page.keyboard.press(CHORD);
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await panel(board).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(list(board, "second"))).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "keys.open given no key: `?` opens nothing, the Keys button has its tooltip with no key and opens the panel",
      async () => {
        const run = await start(
          scenario({ user: file({ keys: { "keys.open": [] } }) }, "keys-none-k1a3"),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        const button = keysButton(board, "second");
        await ariaOf(button, null, "the Keys button to lose its attribute");
        await list(board, "second").focus();
        await board.page.keyboard.press("?");
        await Bun.sleep(QUIET_MS);
        expect(await panel(board).count()).toBe(0);
        await button.hover();
        await board.view.getByText("Keys", { exact: true }).first().waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        expect(await board.view.locator("kbd").count()).toBe(0);
        await button.click();
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const text = (await panel(board).textContent()) ?? "";
        expect(text).toContain("Show the keys");
        expect(text).toContain("no key");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user file with a combination the check refuses: every key is the default",
      async () => {
        // Alt+Shift+ArrowUp is Move up's key, so giving it to "To top" is a conflict: the board page
        // passes none of the overrides on, whatever the session process sent.
        const run = await start(
          scenario(
            { user: file({ keys: { "move.top": ["Alt+Shift+ArrowUp"] } }) },
            "keys-refused-k1a4",
          ),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await ariaOf(
          tool(board, "first", "Probe up"),
          "Alt+Shift+ArrowUp",
          "Move up to keep its default",
        );
        await Bun.sleep(QUIET_MS);
        expect(await aria(tool(board, "first", "Probe top"))).toBe(
          "Alt+Shift+Home Control+Shift+ArrowUp Meta+Shift+ArrowUp",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the settings panel's Keys row counts the actions the user file changed, names the file and the key, and offers no control",
      async () => {
        const run = await start(
          scenario(
            { user: file({ keys: { "move.up": ["Mod+Alt+ArrowUp"], "move.top": [] } }) },
            "keys-row-k1a7",
          ),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await openSettings(board);
        const keysRow = settingsPanel(board).locator('[data-askboard-setting="keys"]');
        // The path is file text: isolated from the sentence (U+2068, U+2069), which a reader does not see.
        const text = ((await keysRow.textContent()) ?? "").replace(/[\u2068\u2069]/g, "");
        expect(text).toContain("2 actions changed");
        expect(text).toMatch(/config\.json · keys/);
        expect(text).toContain("Applies to boards opened after a change");
        expect(await keysRow.getByRole("radio").count()).toBe(0);
        expect(await keysRow.getByRole("button").count()).toBe(0);
        // The presentation group ends with it, before the Language indicator.
        const all = (await settingsPanel(board).textContent()) ?? "";
        expect(all.indexOf("Context placement")).toBeLessThan(all.indexOf("2 actions changed"));
        expect(all.indexOf("2 actions changed")).toBeLessThan(all.indexOf("Language"));
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "file text in the panel: a pointer holding a line feed and a right-to-left override shows escaped and between isolates",
      async () => {
        const name = "bad\n\u202ename";
        const run = await start(
          scenario({ user: file({ keys: { [name]: "not a list" } }) }, "keys-text-k1a8"),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await openSettings(board);
        const notice = settingsPanel(board).locator("[data-askboard-settings-file]");
        const text = (await notice.textContent()) ?? "";
        expect(text).toContain("is not applied");
        expect(text).not.toContain("\n");
        expect(text).not.toContain("\u202e");
        expect(text).toContain("\\n");
        expect(text).toContain("\\u202e");
        expect(text).toMatch(/\u2068[^\u2068\u2069]*\\u202e[^\u2068\u2069]*\u2069/);
      },
      TEST_TIMEOUT_MS,
    );

    // Needs task 9.1 of this change: `ask-core` runs the check and sends the `keys-not-applied`
    // warning and a row with no value. Before it, the session process sends the refused keys as the
    // row's value and the row reads "1 action changed". Un-skip when group 9 lands.
    test.skip(
      "the settings panel's Keys row names the problem of a refused user file",
      async () => {
        const run = await start(
          scenario(
            { user: file({ keys: { "move.top": ["Alt+Shift+ArrowUp"] } }) },
            "keys-refused-k1a6",
          ),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await openSettings(board);
        const keysRow = settingsPanel(board).locator('[data-askboard-setting="keys"]');
        const text = ((await keysRow.textContent()) ?? "").replace(/[\u2068\u2069]/g, "");
        expect(text).toContain("Default keys");
        expect(text).toContain("move.top");
        expect(text).toContain("Alt+Shift+ArrowUp");
        expect(text).toContain("move.up");
      },
      TEST_TIMEOUT_MS,
    );

    // Needs task 9.1 of this change: `ask-core` drops a project file's `keys` with the
    // `project-keys-ignored` warning. Before it, the project's keys become the row's value, which the
    // board protocol refuses, and the board page has no settings. Un-skip when group 9 lands.
    test.skip(
      "a project file's keys are ignored, with their warning on the Keys row",
      async () => {
        const run = await start(
          scenario(
            {
              user: file({ keys: { "move.up": ["Mod+Alt+ArrowUp"] } }),
              project: file({ keys: { "move.up": ["Mod+Alt+ArrowDown"] } }),
            },
            "keys-project-k1a5",
          ),
          { userAgent: LINUX_UA },
        );
        const board = await openBoard(run, ["plan"]);
        await ariaOf(
          tool(board, "first", "Probe up"),
          "Control+Alt+ArrowUp Meta+Alt+ArrowUp",
          "the user file's keys, not the project's",
        );
        await openSettings(board);
        const keysRow = settingsPanel(board).locator('[data-askboard-setting="keys"]');
        const text = (await keysRow.textContent()) ?? "";
        expect(text).toContain("1 action changed");
        expect(text).toContain("The project's keys");
        expect(text).toContain("are ignored");
        expect(await keysRow.getByRole("radio").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
