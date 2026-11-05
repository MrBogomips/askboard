// The presentation settings end to end, on the real session process (settings-languages, task
// 8.6): picking Dark on one board writes the user file with its other keys unchanged and a board
// of a later ask opens dark, whatever the browser's storage holds; a user folder that cannot be
// written still turns the board comfortable and shows the error with the path under Density; a
// project's `density` makes its row read-only and its toggle disabled.

import { describe, expect, test } from "bun:test";
import { chmod, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { type Board, boardOf } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-persist-p8e6" };
const scenario = (config: { user?: unknown; project?: unknown }) => ({
  ...lifecycleScenario(ask, dist),
  config,
});

const theme = (board: Board) => board.view.getByRole("radiogroup", { name: "Theme" });
const density = (board: Board) => board.view.getByRole("radiogroup", { name: "Density" });
const settingsButton = (board: Board) =>
  board.view.getByRole("banner").getByRole("button", { name: "Settings", exact: true });
const panel = (board: Board) => board.page.getByRole("complementary", { name: "Settings" });

const isDark = async (board: Board) =>
  ((await board.view.locator("html").getAttribute("class")) ?? "").split(/\s+/).includes("dark");

const readUserFile = async (path: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: presentation settings end to end`, () => {
    const { start } = useEngine(engine);

    test(
      "picking Dark writes the user file, keeps its other keys, and a board of a later ask opens dark",
      async () => {
        const user = { version: "1.0", editor: ["true", "{file}"], density: "comfortable" };
        const run = await start(scenario({ user }), { colorScheme: "light" });
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const board = await openBoard(run, ["database", "cache"]);
        await theme(board).getByRole("radio", { name: "Dark" }).click({ timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await readUserFile(path)).theme === "dark", "the user file");
        const written = await readUserFile(path);
        expect(written).toEqual({ ...user, theme: "dark" });
        expect(Object.keys(written)).toEqual(["version", "editor", "density", "theme"]);
        // The browser's own storage holds nothing of it: clearing it changes nothing.
        await board.page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch {
            // No Web Storage in this page: nothing to clear.
          }
        });
        await run.browser.context.clearCookies();
        await run.session.restart();
        const later = boardOf(
          await run.browser.newTab(run.session.latestLink?.() ?? run.session.link),
        );
        await later.view
          .locator('[data-askboard-question="database"]:not([aria-busy="true"])')
          .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
        expect(await isDark(later)).toBe(true);
        expect(
          await theme(later).getByRole("radio", { name: "Dark" }).getAttribute("aria-checked"),
        ).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a user folder that cannot be written still turns the board comfortable and shows the error with the path under Density",
      async () => {
        const run = await start(scenario({ user: { version: "1.0" } }));
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const folder = dirname(path);
        const board = await openBoard(run, ["database", "cache"]);
        await chmod(folder, 0o555);
        try {
          await density(board)
            .getByRole("radio", { name: "Comfortable" })
            .click({ timeout: STEP_TIMEOUT_MS });
          await board.view.locator("html.comfortable").waitFor({ state: "attached" });
          await settingsButton(board).click();
          const row = panel(board).locator('[data-askboard-setting="density"]');
          await row.waitFor({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => ((await row.textContent()) ?? "").includes("Could not save density to"),
            "the write error under Density",
          );
          expect((await row.textContent()) ?? "").toContain(path);
          expect(
            await density(board)
              .getByRole("radio", { name: "Comfortable" })
              .getAttribute("aria-checked"),
          ).toBe("true");
        } finally {
          await chmod(folder, 0o755);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a project density makes its row read-only and its toggle disabled",
      async () => {
        const run = await start(scenario({ project: { version: "1.0", density: "comfortable" } }));
        const board = await openBoard(run, ["database", "cache"]);
        for (const radio of await density(board).getByRole("radio").all()) {
          expect(await radio.isDisabled()).toBe(true);
        }
        await settingsButton(board).click();
        const row = panel(board).locator('[data-askboard-setting="density"]');
        await row.waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const radio of await row.getByRole("radio").all()) {
          expect(await radio.isDisabled()).toBe(true);
        }
        expect((await row.textContent()) ?? "").toContain(".askboard/config.json · density");
      },
      TEST_TIMEOUT_MS,
    );
  });
}
