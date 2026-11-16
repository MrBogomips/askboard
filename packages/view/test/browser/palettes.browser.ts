// The named palettes on a board, in the browser (palettes, tasks 3.4 and 3.5; view-and-widgets spec:
// Named palettes, The palette preference, High contrast follows the system, Contrasto's marks): the
// settings give the board page and the view their palette before the first render, the Theme
// popover's palette row picks one and the session process writes it, the project's palette makes
// the row read-only, and Contrasto replaces any palette under the theme's System while the system
// asks for more contrast, with a note and nothing written. Chromium runs it (task 0.2's probes P1
// and P2 are what the media emulation here rests on). Every scenario runs on the session process.

import { describe, expect, test } from "bun:test";
import { chmod, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { paletteColor } from "./harness/design-colors.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-palettes-p3b4" };
const scenario = (config: { user?: unknown; project?: unknown }) => ({
  ...lifecycleScenario(ask, dist),
  config,
});
const file = (settings: Record<string, unknown>) => ({ version: "1.0", ...settings });
const PALETTES = ["carta", "nordico", "grafite", "contrasto"] as const;

const waitForBoard = (board: Board) =>
  answerOf(board, "database").waitFor({ timeout: STEP_TIMEOUT_MS });

/** The `data-palette` of the board page's root and of the view's. */
const attributes = async (board: Board) => ({
  page: await board.page.locator("html").getAttribute("data-palette"),
  view: await board.view.locator("html").getAttribute("data-palette"),
});

/** The root's page colour, as a computed style reads it, on the page and in the view. */
const backgrounds = async (board: Board) => ({
  page: await board.page.locator("html").evaluate((root) => getComputedStyle(root).backgroundColor),
  view: await board.view.locator("html").evaluate((root) => getComputedStyle(root).backgroundColor),
});

const paletteGroup = (board: Board) => board.view.getByRole("radiogroup", { name: "Palette" });
const openTheme = async (board: Board): Promise<void> => {
  await board.themeControl.click({ timeout: STEP_TIMEOUT_MS });
  await paletteGroup(board).waitFor({ timeout: STEP_TIMEOUT_MS });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the palettes`, () => {
    const { start } = useEngine(engine);

    test(
      "no palette set: no attribute anywhere, and Carta's page colour in light and in dark",
      async () => {
        for (const scheme of ["light", "dark"] as const) {
          const run = await start(scenario({}), { colorScheme: scheme });
          const board = await openBoard(run, ["database", "cache"]);
          await waitForBoard(board);
          expect(await attributes(board)).toEqual({ page: null, view: null });
          const expected = paletteColor("carta", "background", scheme);
          expect(await backgrounds(board)).toEqual({ page: expected, view: expected });
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "every palette in both schemes: the attribute on the page and in the view, and the palette's own page colour",
      async () => {
        for (const palette of PALETTES) {
          for (const theme of ["light", "dark"] as const) {
            const run = await start(scenario({ user: file({ palette, theme }) }));
            const board = await openBoard(run, ["database", "cache"]);
            await waitForBoard(board);
            const named = palette === "carta" ? null : palette;
            expect(await attributes(board)).toEqual({ page: named, view: named });
            const expected = paletteColor(palette, "background", theme);
            expect(await backgrounds(board)).toEqual({ page: expected, view: expected });
          }
        }
      },
      TEST_TIMEOUT_MS * 4,
    );

    test(
      "Grafite keeps the theme preference: a light system with Grafite and System is light",
      async () => {
        const run = await start(scenario({ user: file({ palette: "grafite" }) }), {
          colorScheme: "light",
        });
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        expect((await board.view.locator("html").getAttribute("class")) ?? "").not.toContain(
          "dark",
        );
        expect(await backgrounds(board)).toEqual({
          page: paletteColor("grafite", "background", "light"),
          view: paletteColor("grafite", "background", "light"),
        });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "picked in the Theme popover: both documents change at once, the user file is written, and a keyboard arrow picks the next",
      async () => {
        const user = file({ editor: ["true", "{file}"] });
        const run = await start(scenario({ user }));
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        await openTheme(board);
        expect(await board.paletteRow.count()).toBe(1);
        await paletteGroup(board).getByRole("radio", { name: "Nordico" }).click();
        await board.view.locator("html[data-palette=nordico]").waitFor({ state: "attached" });
        await board.page.locator("html[data-palette=nordico]").waitFor({ state: "attached" });
        await eventually(
          async () => JSON.parse(await readFile(path, "utf8")).palette === "nordico",
          "the user file",
        );
        // From the keyboard: the focused segment's arrow selects the next one and writes it.
        await paletteGroup(board).getByRole("radio", { name: "Nordico" }).focus();
        await board.page.keyboard.press("ArrowRight");
        await board.view.locator("html[data-palette=grafite]").waitFor({ state: "attached" });
        await eventually(
          async () => JSON.parse(await readFile(path, "utf8")).palette === "grafite",
          "the user file after the arrow",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a write that fails: the board keeps the palette, and Settings shows the error with the path under Palette",
      async () => {
        const run = await start(scenario({ user: file({}) }));
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const folder = dirname(path);
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        await chmod(folder, 0o555);
        try {
          await openTheme(board);
          await paletteGroup(board).getByRole("radio", { name: "Grafite" }).click();
          await board.view.locator("html[data-palette=grafite]").waitFor({ state: "attached" });
          await board.view
            .getByRole("banner")
            .getByRole("button", { name: "Settings", exact: true })
            .click();
          const row = board.page
            .getByRole("complementary", { name: "Settings" })
            .locator('[data-askboard-setting="palette"]');
          await row.waitFor({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => ((await row.textContent()) ?? "").includes("Could not save palette to"),
            "the write error under Palette",
          );
          expect((await row.textContent()) ?? "").toContain(path);
          expect((await attributes(board)).view).toBe("grafite");
        } finally {
          await chmod(folder, 0o755);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the project sets the palette: the row is read-only and names the file and key, and Carta is not applied",
      async () => {
        const run = await start(
          scenario({ user: file({ palette: "nordico" }), project: file({ palette: "contrasto" }) }),
        );
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        expect((await attributes(board)).view).toBe("contrasto");
        await openTheme(board);
        const radios = paletteGroup(board).getByRole("radio");
        expect(await radios.count()).toBe(4);
        for (let at = 0; at < 4; at += 1) expect(await radios.nth(at).isDisabled()).toBe(true);
        expect(await paletteGroup(board).getAttribute("title")).toContain(
          ".askboard/config.json · palette",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the Theme popover holds the palette row, and no note while the palette in use is the chosen one",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        await openTheme(board);
        expect(await board.paletteRow.count()).toBe(1);
        expect(await board.paletteNote.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: high contrast`, () => {
    const { start } = useEngine(engine);

    test(
      "more contrast under System puts Contrasto in both documents, says so, and writes nothing; the system stopping returns the chosen palette",
      async () => {
        const user = file({ palette: "nordico" });
        const run = await start(scenario({ user }), { colorScheme: "light" });
        const path = run.session.userConfigPath;
        if (path === undefined) throw new Error("the session has no user file");
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        expect((await attributes(board)).view).toBe("nordico");
        await board.page.emulateMedia({ contrast: "more" });
        await board.view.locator("html[data-palette=contrasto]").waitFor({ state: "attached" });
        await board.page.locator("html[data-palette=contrasto]").waitFor({ state: "attached" });
        await openTheme(board);
        await board.paletteNote.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await board.paletteNote.textContent()).toContain("Contrasto is in use");
        expect(
          await paletteGroup(board)
            .getByRole("radio", { name: "Nordico" })
            .getAttribute("aria-checked"),
        ).toBe("true");
        expect(JSON.parse(await readFile(path, "utf8"))).toEqual(user);
        await board.page.emulateMedia({ contrast: "no-preference" });
        await board.view.locator("html[data-palette=nordico]").waitFor({ state: "attached" });
        expect(await board.paletteNote.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an explicit theme ignores the system's request",
      async () => {
        const run = await start(scenario({ user: file({ palette: "nordico", theme: "light" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await waitForBoard(board);
        await board.page.emulateMedia({ contrast: "more" });
        // Give the change event time to arrive in both documents before looking.
        await board.page.waitForTimeout(300);
        expect(await attributes(board)).toEqual({ page: "nordico", view: "nordico" });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the focus ring is 3 px under Contrasto and 2 px under Carta; a question card is matched by a 1.5 px border rule under Contrasto only",
      async () => {
        const measure = async (palette: string) => {
          const run = await start(scenario({ user: file({ palette }) }));
          const board = await openBoard(run, ["database", "cache"]);
          await waitForBoard(board);
          const button = board.themeControl;
          // A key first, so that a script's focus is a keyboard focus (:focus-visible).
          await board.page.keyboard.press("Shift");
          await button.focus();
          return {
            ring: await button.evaluate((element) => {
              const style = getComputedStyle(element);
              return `${style.outlineStyle} ${style.outlineWidth}`;
            }),
            // The computed width of a 1.5 px border is snapped to whole device pixels, so a
            // device pixel ratio of 1 reads 1 px: the rule itself is what is checked.
            rule: await board.question("database").evaluate((card) => {
              for (const sheet of card.ownerDocument.styleSheets) {
                for (const rule of sheet.cssRules) {
                  if (
                    rule instanceof CSSStyleRule &&
                    rule.selectorText.includes(
                      '[data-palette="contrasto"] [data-askboard-question]',
                    )
                  ) {
                    return {
                      width: rule.style.borderWidth,
                      applies: card.matches(rule.selectorText),
                    };
                  }
                }
              }
              return undefined;
            }),
          };
        };
        expect(await measure("contrasto")).toEqual({
          ring: "solid 3px",
          rule: { width: "1.5px", applies: true },
        });
        expect(await measure("carta")).toEqual({
          ring: "solid 2px",
          rule: { width: "1.5px", applies: false },
        });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
