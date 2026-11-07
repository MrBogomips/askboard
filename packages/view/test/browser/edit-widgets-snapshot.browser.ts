// A Snapshot of a board answered with the LaTeX, the Kanban and the Timeline, in each engine
// (latex-kanban-timeline, task 6.3; spec view-and-widgets: LaTeX, Kanban and Timeline read-only):
// the agent takes the Snapshot after the answer, the session process exits, and the file opens
// from `file://` offline with no CSP violation and no request. Each widget shows the answer's
// value read-only with its change highlight, KaTeX's fonts are inline, the `askboard-licences`
// block holds the `katex` 0.19.1 notice `MIT AND OFL-1.1` with the OFL text, nothing can be edited
// or moved, and the file inlines the chunks `assemble` selects for the three types, `dnd` among
// them. An answer too complex to preview (task 4.22) shows its source with the same field error and
// no drawn preview, and one raised a million em down (task 5b.1) holds its preview within the cap.
// The session process serves this test whatever the target.

import { describe, expect, test } from "bun:test";
import {
  SNAPSHOT_DATA_ELEMENT,
  SNAPSHOT_LICENCES_ELEMENT,
  type SnapshotData,
} from "@askboard/contract";
import { LATEX_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { kanbanItem } from "./fixtures/kanban-documents.ts";
import { latexItem } from "./fixtures/latex-documents.ts";
import { timelineItem } from "./fixtures/timeline-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { beginDrag, cardOf, columnOf, dragOver, release } from "./harness/kanban-drag.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { entryOf } from "./harness/timeline-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };
const COMPLEX = `a${"́".repeat(48)}`;
const RAISED = "\\raisebox{-1000000em}{X}";
const CAP = 400;
const ask = {
  askId: "snapshot-edit-widgets-s1t2",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: {
        ...plan.props,
        items: [
          kanbanItem(),
          timelineItem(),
          LATEX_FIXTURE_ITEM,
          latexItem("x", "complex"),
          latexItem("y", "raised"),
        ],
      },
    },
  ],
} as const;

/** The block with the id, cut out by the text rule. */
const blockOf = <T>(page: string, id: string): T => {
  const opening = `id="${id}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as T;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot of a board answered with the LaTeX, the Kanban and the Timeline`, () => {
    const { start } = useEngine(engine);

    test(
      "each widget shows its answered value read-only with its change highlight, the fonts and the OFL notice are inline, nothing can be edited or moved, and the file inlines the three chunks, dnd among them",
      async () => {
        const run = await start({ ...lifecycleScenario(ask, dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        const source = (id: string) =>
          board.view
            .locator(`[data-latex-source]`)
            .nth(["formula", "complex", "raised"].indexOf(id));
        await beginDrag(board, cardOf(board, "a"));
        await dragOver(board, columnOf(board, "doing"));
        await release(board);
        await eventually(
          async () => (await cardOf(board, "a").getAttribute("data-change")) === "moved",
          "a to be moved",
        );
        await entryOf(board, "launch").focus();
        await board.view
          .getByRole("toolbar", { name: "Timeline tools" })
          .getByRole("button", { name: "Move later", exact: true })
          .click();
        await eventually(
          async () => (await entryOf(board, "launch").getAttribute("data-change")) === "moved",
          "launch to be moved",
        );
        // A range moves too: `checkout` goes a week later, and the Snapshot keeps both its ends.
        await entryOf(board, "checkout").focus();
        await board.view
          .getByRole("toolbar", { name: "Timeline tools" })
          .getByRole("button", { name: "Move later", exact: true })
          .click();
        await eventually(
          async () => (await entryOf(board, "checkout").getAttribute("data-change")) === "moved",
          "checkout to be moved",
        );
        await source("formula").fill("a^2+b^2=c^2");
        await source("complex").fill(COMPLEX);
        await source("raised").fill(RAISED);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = blockOf<SnapshotData>(html, SNAPSHOT_DATA_ELEMENT);
        expect(validateSnapshotData(data).ok).toBe(true);

        // The chunks `assemble` selects for the three types are in the file, whole.
        const selected = selectChunks(data.document, dist.manifest, targetOf(data));
        for (const name of ["latex", "kanban", "timeline", "dnd"]) {
          expect(selected.map(({ name: found }) => found)).toContain(name);
        }
        for (const { name, chunk } of selected) {
          const text = dist.files.get(chunk.script.path);
          expect({ name, inlined: text !== undefined && html.includes(text) }).toEqual({
            name,
            inlined: true,
          });
        }
        // KaTeX's notice: the package's, version, licence and the OFL text.
        const notices = blockOf<
          { package: string; version: string; licence: string; text: string }[]
        >(html, SNAPSHOT_LICENCES_ELEMENT);
        const katex = notices.filter((notice) => notice.package === "katex");
        expect(katex).toHaveLength(1);
        expect(katex[0]).toMatchObject({ version: "0.19.1", licence: "MIT AND OFL-1.1" });
        expect(katex[0]?.text).toContain("SIL OPEN FONT LICENSE");
        // The fonts travel inside the file: every url() in its styles is a data URL.
        expect(html).toMatch(/@font-face/);
        expect(html).toMatch(/url\(data:font\//);
        expect(html).not.toMatch(/url\((?!data:|["']?data:)[^)]*\.(woff2?|ttf)/);

        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({ offline: true });
          await context.addInitScript(() => {
            document.addEventListener("securitypolicyviolation", (event) => {
              console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
            });
          });
          const page = await context.newPage();
          const violations: string[] = [];
          const requests: string[] = [];
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          page.on("request", (request) => requests.push(request.url()));
          await page.goto(`file://${taken.path}`);
          const sources = page.locator("[data-latex-source]");
          await sources.first().waitFor({ timeout: STEP_TIMEOUT_MS });
          await eventually(
            async () => (await page.locator("[data-kanban-card]").count()) === 3,
            "cards",
          );

          // The LaTeX: the answer's value, read-only, highlighted, drawn.
          expect(await sources.nth(0).inputValue()).toBe("a^2+b^2=c^2");
          for (const at of [0, 1, 2]) {
            expect(await sources.nth(at).getAttribute("readonly")).not.toBeNull();
          }
          expect(await sources.nth(0).getAttribute("data-change")).toBe("edited");
          expect(await page.locator("[data-latex-preview]").nth(0).locator(".katex").count()).toBe(
            1,
          );
          // Too complex to preview: the source, the field error, no drawn node.
          expect(await sources.nth(1).inputValue()).toBe(COMPLEX);
          expect(
            await page.locator("[data-latex]").nth(1).locator("[data-latex-error]").textContent(),
          ).toContain("This expression is too complex to preview.");
          expect(await page.locator("[data-latex-preview]").nth(1).locator("*").count()).toBe(0);
          // Raised a million em down: the preview holds within its cap.
          const preview = await page.locator("[data-latex-preview]").nth(2).boundingBox();
          if (preview === null) throw new Error("the preview has no box");
          expect(preview.height).toBeLessThanOrEqual(CAP + 4);
          expect(await page.locator("[data-latex-preview]").nth(2).locator(".katex").count()).toBe(
            1,
          );

          // The Kanban: a in doing, highlighted, nothing draggable.
          expect(
            await page
              .locator('[data-kanban-column="doing"] [data-kanban-card]')
              .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-kanban-card"))),
          ).toEqual(["a"]);
          expect(await page.locator('[data-kanban-card="a"]').getAttribute("data-change")).toBe(
            "moved",
          );
          expect(await page.locator('[data-kanban-card][draggable="true"]').count()).toBe(0);
          // The Timeline: launch a week later, highlighted.
          expect(
            await page.locator('[data-timeline-entry="launch"]').getAttribute("data-date"),
          ).toBe("2026-02-09");
          expect(
            await page.locator('[data-timeline-entry="launch"]').getAttribute("data-change"),
          ).toBe("moved");
          // The moved range: both ends and the highlight.
          const checkout = page.locator('[data-timeline-entry="checkout"]');
          expect({
            start: await checkout.getAttribute("data-start"),
            end: await checkout.getAttribute("data-end"),
            change: await checkout.getAttribute("data-change"),
          }).toEqual({ start: "2026-01-12", end: "2026-01-16", change: "moved" });

          // Nothing can be edited or moved.
          await sources.nth(0).click({ force: true });
          await page.keyboard.type("zz");
          const card = await page.locator('[data-kanban-card="c"]').boundingBox();
          const doing = await page.locator('[data-kanban-column="done"]').boundingBox();
          if (card === null || doing === null) throw new Error("no box");
          await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
          await page.mouse.down();
          await page.mouse.move(doing.x + doing.width / 2, doing.y + doing.height - 12, {
            steps: 10,
          });
          await page.mouse.up();
          const shape = await page
            .locator('[data-timeline-entry="checkout"] [data-timeline-shape]')
            .boundingBox();
          if (shape === null) throw new Error("no box");
          await page.mouse.move(shape.x + shape.width / 2, shape.y + shape.height / 2);
          await page.mouse.down();
          await page.mouse.move(shape.x + shape.width / 2 + 120, shape.y + shape.height / 2, {
            steps: 8,
          });
          await page.mouse.up();
          for (const tool of ["Move to…", "Move earlier", "Move later", "Move to lane…"]) {
            for (const button of await page
              .getByRole("button", { name: tool, exact: true })
              .all()) {
              expect(await button.getAttribute("aria-disabled")).toBe("true");
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          expect(await sources.nth(0).inputValue()).toBe("a^2+b^2=c^2");
          expect(
            await page
              .locator('[data-kanban-column="todo"] [data-kanban-card]')
              .evaluateAll((cards) => cards.map((found) => found.getAttribute("data-kanban-card"))),
          ).toEqual(["c"]);
          expect({
            start: await checkout.getAttribute("data-start"),
            end: await checkout.getAttribute("data-end"),
          }).toEqual({ start: "2026-01-12", end: "2026-01-16" });

          // No request but the file itself, so no font was fetched, and no CSP violation.
          expect(
            requests.filter((url) => !url.startsWith("file:") && !url.startsWith("data:")),
          ).toEqual([]);
          expect(violations).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
