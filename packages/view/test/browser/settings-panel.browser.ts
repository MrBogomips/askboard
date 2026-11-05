// The settings panel in each engine (settings-languages, task 8.4): "Settings" opens a non-modal
// side sheet on the board page with its three groups; the read-only rows show the value, its file
// and key, "default" and the other file's value; the Language indicator reads as the ask's
// language and locale; a file not applied shows above the behaviour group and the warnings show on
// their rows; the board stays usable while it is open; the keyboard moves a segmented control,
// and Esc closes the panel with the focus back on "Settings".

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsSent,
  answerOf,
  focused,
  lifecycleScenario,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-panel-p8d4" };
const italianAsk = { ...twoAsk, askId: "two-panel-it-p8d5", language: "it-IT" };
const mixedAsk = { ...twoAsk, askId: "two-panel-mx-p8d6", language: "en-US", locale: "it-IT" };
const file = (settings: Record<string, unknown>) => ({ version: "1.0", ...settings });
const scenario = (config: { user?: unknown; project?: unknown }, which: typeof ask = ask) => ({
  ...lifecycleScenario(which, dist),
  config,
});

const panel = (board: Board, name = "Settings") => board.page.getByRole("complementary", { name });
const settingsButton = (board: Board, name = "Settings") =>
  board.view.getByRole("banner").getByRole("button", { name, exact: true });
const rowOf = (board: Board, key: string, name = "Settings") =>
  panel(board, name).locator(`[data-askboard-setting="${key}"]`);

const textOf = async (locator: ReturnType<typeof panel>): Promise<string> =>
  (await locator.textContent()) ?? "";

const openPanel = async (board: Board, name = "Settings") => {
  await settingsButton(board, name).click({ timeout: STEP_TIMEOUT_MS });
  await panel(board, name).waitFor({ timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the settings panel`, () => {
    const { start } = useEngine(engine);

    test(
      "opens with the three groups: the controls, the Language indicator, then the behaviour rows under their note",
      async () => {
        const run = await start(scenario({ user: file({ theme: "dark" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        const text = await textOf(panel(board));
        const at = (needle: string) => text.indexOf(needle);
        const order = [
          "Theme",
          "Density",
          "Context placement",
          "Language",
          "Applies from the next session",
          "Default language",
          "Asking rules",
          "Snapshot folder",
          "Editor",
        ].map(at);
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        const labels = async (name: string) =>
          panel(board).getByRole("radiogroup", { name }).getByRole("radio").allTextContents();
        expect(await labels("Theme")).toEqual(["System", "Light", "Dark"]);
        expect(await labels("Density")).toEqual(["Compact", "Comfortable"]);
        expect(await labels("Context placement")).toEqual(["Beside", "Inline"]);
        expect(
          await panel(board)
            .getByRole("radiogroup", { name: "Theme" })
            .getByRole("radio", { name: "Dark" })
            .getAttribute("aria-checked"),
        ).toBe("true");
        await panel(board).getByRole("button", { name: "Close settings" }).waitFor();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the read-only rows show the value, the file and key, default, and the other file's value",
      async () => {
        const run = await start(
          scenario({
            user: file({ askingRule: "none", editor: ["code", "{file}"] }),
            project: file({ askingRule: "always", snapshotFolder: "snaps" }),
          }),
        );
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        const rule = await textOf(rowOf(board, "askingRule"));
        expect(rule).toContain("always");
        expect(rule).toContain(".askboard/config.json · askingRule");
        expect(rule).toMatch(/also in .*config\.json: none \(not used\)/);
        const snapshots = await textOf(rowOf(board, "snapshotFolder"));
        expect(snapshots).toContain("snaps");
        expect(snapshots).toContain(".askboard/config.json · snapshotFolder");
        const editor = await textOf(rowOf(board, "editor"));
        expect(editor).toContain("code {file}");
        expect(editor).toContain("· editor");
        const language = await textOf(rowOf(board, "defaultLanguage"));
        expect(language).toContain("en-US");
        expect(language).toMatch(/default · .*config\.json · defaultLanguage/);
        for (const key of ["askingRule", "snapshotFolder", "editor", "defaultLanguage"]) {
          expect(await rowOf(board, key).getByRole("radio").count()).toBe(0);
        }
      },
      TEST_TIMEOUT_MS,
    );

    for (const [which, name, expected] of [
      [ask, "Settings", "English (en-US)"],
      [italianAsk, "Impostazioni", "Italiano (it-IT)"],
      [mixedAsk, "Settings", "English (en-US) · formats it-IT"],
    ] as const) {
      test(
        `the Language indicator reads "${expected}" for the ask's language and formats`,
        async () => {
          const run = await start(scenario({}, which));
          const board = await openBoard(run, ["database", "cache"]);
          await openPanel(board, name);
          expect(await textOf(rowOf(board, "language", name))).toContain(expected);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a file not applied shows above the behaviour group, and the warnings show on their rows",
      async () => {
        const run = await start(
          scenario({
            user: file({ theme: "purple" }),
            project: file({ editor: ["evil", "{file}"], fontSize: 12 }),
          }),
        );
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        const notice = panel(board).locator("[data-askboard-settings-file]");
        expect(await notice.count()).toBe(1);
        expect(await textOf(notice)).toContain("is not applied");
        const text = await textOf(panel(board));
        expect(text.indexOf("is not applied")).toBeLessThan(text.indexOf("Default language"));
        expect(text.indexOf("is not applied")).toBeLessThan(
          text.indexOf("Applies from the next session"),
        );
        expect(text).toContain("fontSize is not a known key");
        // The project's editor is ignored: the row carries the warning.
        expect(await textOf(rowOf(board, "editor"))).toContain("The project's editor is ignored");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the board stays usable while the panel is open: an answer is sent and the panel stays",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        // By keyboard: the sheet covers the right of the card at the 1280 px floor, and the board
        // stays operable without the pointer.
        await optionOf(board, "database", "SQLite").focus();
        await board.page.keyboard.press("Space");
        // At the 1280 px floor the sheet covers the card's right edge, where Answer is: the
        // keyboard reaches it.
        await answerOf(board, "database").focus();
        await board.page.keyboard.press("Enter");
        const [command] = await actsSent(run, 1);
        expect(command?.acts[0]?.type).toBe("answer");
        expect(await panel(board).count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a choice made in the panel changes the board at once and is sent",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        await panel(board)
          .getByRole("radiogroup", { name: "Density" })
          .getByRole("radio", { name: "Comfortable" })
          .click();
        await board.view.locator("html.comfortable").waitFor({ state: "attached" });
        await eventually(
          () =>
            run.browser.sockets
              .flatMap((socket) => socket.frames)
              .some((frame) => frame.dir === "sent" && frame.text.includes('"density"')),
          "the density command",
        );
        expect(
          await board.view
            .getByRole("radiogroup", { name: "Density" })
            .getByRole("radio", { name: "Comfortable" })
            .getAttribute("aria-checked"),
        ).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from the keyboard: Enter opens it, arrow keys, Home and End move a control, Esc closes it and the focus returns to Settings",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await settingsButton(board).focus();
        await board.page.keyboard.press("Enter");
        await panel(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const theme = panel(board).getByRole("radiogroup", { name: "Theme" });
        const checked = (name: string) =>
          theme.locator('[role="radio"][aria-checked="true"]', { hasText: name });
        await eventually(
          () =>
            theme
              .getByRole("radio", { name: "System" })
              .evaluate((element) => element === element.ownerDocument.activeElement),
          "the focus in the Theme control",
        );
        await board.page.keyboard.press("ArrowRight");
        await checked("Light").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("End");
        await checked("Dark").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Home");
        await checked("System").waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Escape");
        await panel(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => focused(settingsButton(board)), "the focus back on Settings");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the close control closes it and the focus returns to Settings",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        await panel(board).getByRole("button", { name: "Close settings" }).click();
        await panel(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => focused(settingsButton(board)), "the focus back on Settings");
        await openPanel(board);
        expect(await panel(board).count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a key the project sets is read-only in the panel with the file and key",
      async () => {
        const run = await start(scenario({ project: file({ density: "comfortable" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await openPanel(board);
        const group = panel(board).getByRole("radiogroup", { name: "Density" });
        for (const radio of await group.getByRole("radio").all()) {
          expect(await radio.isDisabled()).toBe(true);
        }
        expect(await textOf(rowOf(board, "density"))).toContain(".askboard/config.json · density");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
