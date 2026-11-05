// The reading panel, in each engine (excerpts, task 6.6; view spec, "The reading panel", "Open in
// editor on the board page"): every scenario runs on the session process, whose source route
// serves the scenario's project files. A FILE reference or an excerpt's "Open in reading panel"
// opens a non-modal side sheet on the board page, between the view's header and bottom bar; its
// frame has an empty `sandbox` and no referrer and shows the source at the anchor. The states of a
// source that cannot be shown each say so with the path. Esc on the header or the close control
// closes it and returns the focus; a moved or discarded board closes it, a closed one keeps it.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PANEL_POINTER,
  panelAsk,
  panelFiles,
  SPEC_LINES,
  SPEC_PATH,
} from "./fixtures/context-asks.ts";
import {
  eventually,
  expectNoCspProblem,
  isFocused,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const PANEL_WIDTH = 560;
const IDS = ["spec", "other"];

const panelOf = (board: Board) => board.page.locator('aside[aria-label="Reading panel"]');
const sourceFrame = (board: Board) => panelOf(board).locator("iframe");
const openerOf = (board: Board, itemId: string) =>
  board.view.locator(`[data-askboard-item="${itemId}"]`).getByRole("button").first();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the reading panel`, () => {
    const { start } = useEngine(engine);
    const folders: string[] = [];
    afterEach(async () => {
      for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
    });

    // The session project, made here so that a test can change a file while the board is open.
    const startPanel = async () => {
      const base = await realpath(await mkdtemp(join(tmpdir(), "askboard-e2e-panel-")));
      folders.push(base);
      const outside = join(base, "outside.txt");
      await writeFile(outside, "outside the project\n");
      const projectDir = join(base, "project");
      const run = await start({
        ...lifecycleScenario(panelAsk, dist),
        files: panelFiles(outside),
        projectDir,
      });
      const board = await openBoard(run, IDS);
      return { run, board, projectDir };
    };

    test(
      "a FILE reference opens a side sheet between the view's header and bottom bar, its frame sandboxed with no referrer, line 40 at the top and 40 to 52 marked",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        const panel = panelOf(board);
        await panel.waitFor({ timeout: STEP_TIMEOUT_MS });
        await panel.getByText(SPEC_PATH, { exact: true }).waitFor();
        const frame = sourceFrame(board);
        expect(await frame.getAttribute("sandbox")).toBe("");
        expect(await frame.getAttribute("referrerpolicy")).toBe("no-referrer");
        const source = board.page.frameLocator('aside[aria-label="Reading panel"] iframe');
        await source.locator("#L40").waitFor({ timeout: STEP_TIMEOUT_MS });
        const marked = await source.locator(".hit").count();
        expect(marked).toBe(13);
        await source.locator("#L52.hit").waitFor();
        expect(await source.locator("#L39.hit").count()).toBe(0);
        // Line 40 at the top of the frame's own view.
        const [line, framed] = [
          await source.locator("#L40").boundingBox(),
          await frame.boundingBox(),
        ];
        if (line === null || framed === null) throw new Error("no box");
        expect(line.y - framed.y).toBeLessThan(40);
        expect(await source.getByText(SPEC_LINES[39] ?? "").count()).toBe(1);
        // A side sheet at the right edge, as wide as the token says, between the bars.
        const box = await panel.boundingBox();
        const header = await board.header.boundingBox();
        const footer = await board.view.getByRole("contentinfo").boundingBox();
        const viewport = board.page.viewportSize();
        if (box === null || header === null || viewport === null) throw new Error("no box");
        expect(Math.round(box.width)).toBe(PANEL_WIDTH);
        expect(Math.round(box.x + box.width)).toBe(viewport.width);
        expect(box.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
        if (footer !== null) expect(box.y + box.height).toBeLessThanOrEqual(footer.y + 1);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an excerpt's Open in reading panel opens the same panel, and the question stays usable beside it",
      async () => {
        const { board } = await startPanel();
        await board.view
          .locator('[data-askboard-item="spec-excerpt"]')
          .getByRole("button", { name: "Open in reading panel" })
          .click();
        await panelOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.page
          .frameLocator('aside[aria-label="Reading panel"] iframe')
          .locator("#L40")
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        // Non-modal: the board answers while the panel stays.
        await board.view.getByRole("radio", { name: "Yes" }).first().click();
        expect(await panelOf(board).count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a range edited after the ask shows 'Changed since the agent asked'",
      async () => {
        const { board, projectDir } = await startPanel();
        await writeFile(
          join(projectDir, SPEC_PATH),
          `${SPEC_LINES.map((line, at) => (at === 44 ? "edited" : line)).join("\n")}\n`,
        );
        await board.view
          .locator('[data-askboard-item="spec-excerpt"]')
          .getByRole("button", { name: "Open in reading panel" })
          .click();
        await panelOf(board)
          .getByText("Changed since the agent asked", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the unchanged range shows no 'Changed since' chip",
      async () => {
        const { board } = await startPanel();
        await board.view
          .locator('[data-askboard-item="spec-excerpt"]')
          .getByRole("button", { name: "Open in reading panel" })
          .click();
        await board.page
          .frameLocator('aside[aria-label="Reading panel"] iframe')
          .locator("#L40")
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panelOf(board).getByText("Changed since the agent asked").isVisible()).toBe(
          false,
        );
      },
      TEST_TIMEOUT_MS,
    );

    for (const [id, path, line] of [
      ["ref-missing", "docs/missing.md", "The file is not available."],
      ["ref-outside", "escape.md", "The path is outside the project, so it is not shown."],
      ["ref-binary", "bin/data.bin", "The file is not text, so it is not shown."],
      ["ref-large", "big/large.txt", "The file is too large to show."],
    ] as const) {
      test(
        `${id}: the panel shows one line and the path, and Open in editor is disabled`,
        async () => {
          const { board } = await startPanel();
          await openerOf(board, id).click();
          const panel = panelOf(board);
          await panel.getByText(line, { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await panel.getByText(path, { exact: true }).count()).toBeGreaterThanOrEqual(1);
          expect(await panel.locator("iframe").count()).toBe(0);
          expect(await panel.getByRole("button", { name: "Open in editor" }).isDisabled()).toBe(
            true,
          );
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "with no editor set, Open in editor is disabled and says so",
      async () => {
        const { board } = await startPanel();
        await openerOf(board, "ref-file").click();
        const panel = panelOf(board);
        await panel
          .getByText("No editor set", { exact: false })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panel.getByRole("button", { name: "Open in editor" }).isDisabled()).toBe(true);
        expect(await panel.getByText("editor", { exact: false }).count()).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Esc on the header closes the panel and the focus returns to the reference",
      async () => {
        const { board } = await startPanel();
        await openerOf(board, "ref-file").click();
        await panelOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await panelOf(board).getByRole("button", { name: "Close reading panel" }).focus();
        await board.page.keyboard.press("Escape");
        await panelOf(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => isFocused(openerOf(board, "ref-file")),
          "the focus on the reference",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the close control closes it and the focus returns to the excerpt's control",
      async () => {
        const { board } = await startPanel();
        const opener = board.view
          .locator('[data-askboard-item="spec-excerpt"]')
          .getByRole("button", { name: "Open in reading panel" });
        await opener.click();
        await panelOf(board).getByRole("button", { name: "Close reading panel" }).click();
        await panelOf(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(() => isFocused(opener), "the focus on Open in reading panel");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a takeover closes the panel in the older tab",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        await panelOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await openBoard(run, IDS);
        await board.banner(/moved/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
        await panelOf(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a discarded ask closes the panel",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        await panelOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.exit();
        await panelOf(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a closed ask keeps the panel readable",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        await board.page
          .frameLocator('aside[aria-label="Reading panel"] iframe')
          .locator("#L40")
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await panelOf(board).count()).toBe(1);
        expect(await panelOf(board).locator("iframe").count()).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the source view framed from http://localhost:<port> is refused",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        const frame = sourceFrame(board);
        await frame.waitFor({ timeout: STEP_TIMEOUT_MS });
        const src = (await frame.getAttribute("src")) ?? "";
        const real = new URL(run.session.link);
        const other = `http://localhost:${real.port}/foreign`;
        const target = new URL(src, real.origin).href;
        await run.browser.context.route(other, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: `<!doctype html><iframe id="f" src="${target}" width="400" height="300"></iframe>`,
          }),
        );
        const page = await run.browser.context.newPage();
        await page.goto(other);
        await Bun.sleep(1500);
        const child = page.frames().find((each) => each !== page.mainFrame());
        const text =
          child === undefined
            ? ""
            : await child.evaluate(() => document.body?.textContent ?? "").catch(() => "");
        expect(text).not.toContain("spec line 40");
        await page.close();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the panel's request to open a source names the item only",
      async () => {
        const { run, board } = await startPanel();
        await openerOf(board, "ref-file").click();
        await panelOf(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        const sent = run.browser.sockets.flatMap((socket) =>
          socket.frames.filter((frame) => frame.dir === "sent").map((frame) => frame.text),
        );
        const opens = sent.filter((text) => text.includes('"open-source"'));
        expect(opens).toHaveLength(1);
        const message = JSON.parse(opens[0] ?? "{}") as Record<string, unknown>;
        expect(Object.keys(message).sort()).toEqual(["itemId", "type", "version"]);
        expect(message.type).toBe("open-source");
        expect(message.itemId).toBe("ref-file");
        expect(opens[0]).not.toContain(PANEL_POINTER);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
