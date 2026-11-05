// The quick toggles in each engine (settings-languages, task 8.3): header row 2 ends with "Theme"
// and "System | Light | Dark", "Compact | Comfortable" and "Settings"; a toggle sends the board
// page's `setting` command and the board changes at once; a key the project sets disables its
// toggle, whose description names the file and the key.

import { describe, expect, test } from "bun:test";
import { twoAsk } from "./fixtures/lifecycle-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { buttonOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const ask = { ...twoAsk, askId: "two-toggles-t8g3" };
const scenario = (config: { user?: unknown; project?: unknown }) => ({
  ...lifecycleScenario(ask, dist),
  config,
});
const file = (settings: Record<string, string>) => ({ version: "1.0", ...settings });

const theme = (board: Board) => board.view.getByRole("radiogroup", { name: "Theme" });
const density = (board: Board) => board.view.getByRole("radiogroup", { name: "Density" });
const settingsButton = (board: Board) =>
  board.view.getByRole("banner").getByRole("button", { name: "Settings", exact: true });

const hasClass = async (board: Board, side: "page" | "view", name: string) => {
  const classes =
    side === "page"
      ? await board.page.locator("html").getAttribute("class")
      : await board.view.locator("html").getAttribute("class");
  return (classes ?? "").split(/\s+/).includes(name);
};

/** The `setting` commands the board page sent, in order. */
const sentSettings = (run: Awaited<ReturnType<ReturnType<typeof useEngine>["start"]>>) =>
  run.browser.sockets
    .flatMap((socket) => socket.frames)
    .filter((frame) => frame.dir === "sent")
    .map((frame) => JSON.parse(frame.text) as { type?: string; key?: string; value?: string })
    .filter((message) => message.type === "setting");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the quick toggles`, () => {
    const { start } = useEngine(engine);

    test(
      "row 2 ends with Theme, its three choices, the two densities and Settings",
      async () => {
        const run = await start(scenario({ user: file({ theme: "dark" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await buttonOf(board, "database", "Answer").waitFor({ timeout: STEP_TIMEOUT_MS });
        await theme(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const labels = async (group: ReturnType<typeof theme>) =>
          group.getByRole("radio").allTextContents();
        expect(await labels(theme(board))).toEqual(["System", "Light", "Dark"]);
        expect(await labels(density(board))).toEqual(["Compact", "Comfortable"]);
        expect(
          await theme(board).getByRole("radio", { name: "Dark" }).getAttribute("aria-checked"),
        ).toBe("true");
        expect(
          await density(board).getByRole("radio", { name: "Compact" }).getAttribute("aria-checked"),
        ).toBe("true");
        const x = async (locator: ReturnType<typeof theme>) =>
          (await locator.boundingBox())?.x ?? 0;
        const order = [
          await x(board.view.getByText("Theme", { exact: true })),
          await x(theme(board)),
          await x(density(board)),
          await x(settingsButton(board)),
        ];
        expect(order).toEqual([...order].sort((a, b) => a - b));
        const row = await board.view.locator("header > div").nth(1).boundingBox();
        const last = await settingsButton(board).boundingBox();
        expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(
          (row?.x ?? 0) + (row?.width ?? 0) + 0.5,
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "picking Light and Comfortable changes the board at once and sends the settings",
      async () => {
        const run = await start(scenario({ user: file({ theme: "dark" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await theme(board)
          .getByRole("radio", { name: "Light" })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.view.locator("html:not(.dark)").waitFor({ state: "attached" });
        expect(await hasClass(board, "page", "dark")).toBe(false);
        await density(board)
          .getByRole("radio", { name: "Comfortable" })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.view.locator("html.comfortable").waitFor({ state: "attached" });
        expect(await hasClass(board, "page", "comfortable")).toBe(true);
        await eventually(
          () => sentSettings(run).length >= 2,
          "the board page's two setting commands",
        );
        expect(sentSettings(run).map(({ key, value }) => ({ key, value }))).toEqual([
          { key: "theme", value: "light" },
          { key: "density", value: "comfortable" },
        ]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a key the project sets disables its toggle and names the file and key",
      async () => {
        const run = await start(scenario({ project: file({ density: "comfortable" }) }));
        const board = await openBoard(run, ["database", "cache"]);
        await density(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const radio of await density(board).getByRole("radio").all()) {
          expect(await radio.isDisabled()).toBe(true);
        }
        expect(await density(board).getAttribute("title")).toBe(".askboard/config.json · density");
        expect(await density(board).getAttribute("aria-describedby")).not.toBeNull();
        for (const radio of await theme(board).getByRole("radio").all()) {
          expect(await radio.isDisabled()).toBe(false);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "arrow keys move the choice of a toggle, Home and End go to its ends",
      async () => {
        const run = await start(scenario({}));
        const board = await openBoard(run, ["database", "cache"]);
        await theme(board).getByRole("radio", { name: "System" }).focus();
        await board.page.keyboard.press("ArrowRight");
        await board.view
          .locator('[role="radio"][aria-checked="true"]', { hasText: "Light" })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("End");
        await board.view
          .locator('[role="radio"][aria-checked="true"]', { hasText: "Dark" })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page.keyboard.press("Home");
        await board.view
          .locator('[role="radio"][aria-checked="true"]', { hasText: "System" })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
