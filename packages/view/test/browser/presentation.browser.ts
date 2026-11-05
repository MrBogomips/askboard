// The theme preference and the presentation updates in each engine (settings-languages, task
// 8.2): the user's or the project's settings, read by the session process, give the board page and
// the view their theme and density before the first render; `system` follows the system's scheme
// on both and `light` or `dark` ignores it; the board touches no Web Storage, IndexedDB or cookie.

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { buttonOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-presentation-p8r2" };
const scenario = (config: { user?: unknown; project?: unknown }) => ({
  ...lifecycleScenario(ask, dist),
  config,
});
const file = (settings: Record<string, string>) => ({ version: "1.0", ...settings });

/** The root's classes on the board page and in the view. */
const classes = async (board: Board) => ({
  page: await board.page.locator("html").getAttribute("class"),
  view: await board.view.locator("html").getAttribute("class"),
});
const has = (value: string | null, name: string) => (value ?? "").split(/\s+/).includes(name);

const waitForBoard = async (board: Board) =>
  buttonOf(board, "database", "Answer").waitFor({ timeout: STEP_TIMEOUT_MS });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: theme and density from the settings`, () => {
    const { start } = useEngine(engine);

    test(
      "the user's dark and comfortable settings reach the page and the view in a light system",
      async () => {
        const run = await start(
          scenario({ user: file({ theme: "dark", density: "comfortable" }) }),
          { colorScheme: "light" },
        );
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        const found = await classes(board);
        for (const side of [found.page, found.view]) {
          expect(has(side, "dark")).toBe(true);
          expect(has(side, "comfortable")).toBe(true);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "light ignores a dark system and system follows it, on the page and in the view",
      async () => {
        const light = await start(scenario({ user: file({ theme: "light" }) }), {
          colorScheme: "dark",
        });
        const lit = await openBoard(light, ["database", "cache"]);
        await waitForBoard(lit);
        await lit.page.emulateMedia({ colorScheme: "light" });
        await lit.page.emulateMedia({ colorScheme: "dark" });
        const fixed = await classes(lit);
        expect([has(fixed.page, "dark"), has(fixed.view, "dark")]).toEqual([false, false]);
        expect([has(fixed.page, "comfortable"), has(fixed.view, "comfortable")]).toEqual([
          false,
          false,
        ]);

        const system = await start(scenario({}), { colorScheme: "light" });
        const followed = await openBoard(system, ["database", "cache"]);
        await waitForBoard(followed);
        expect(has((await classes(followed)).view, "dark")).toBe(false);
        await followed.page.emulateMedia({ colorScheme: "dark" });
        await followed.view.locator("html.dark").waitFor({ state: "attached" });
        expect(has((await classes(followed)).page, "dark")).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the project's density wins over the user's, and no browser storage is touched",
      async () => {
        const run = await start(
          scenario({
            user: file({ density: "compact" }),
            project: file({ density: "comfortable" }),
          }),
        );
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        const found = await classes(board);
        expect([has(found.page, "comfortable"), has(found.view, "comfortable")]).toEqual([
          true,
          true,
        ]);
        const stored = await board.page.evaluate(async () => ({
          local: window.localStorage.length,
          session: window.sessionStorage.length,
          cookie: document.cookie,
          databases: (await window.indexedDB.databases()).length,
        }));
        expect(stored).toEqual({ local: 0, session: 0, cookie: "", databases: 0 });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
