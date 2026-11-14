// A Snapshot of a board answered with a Document review, in each engine (document-review, task 7.2;
// spec view-and-widgets: A Document review read-only and in Snapshots; design decision 14): the user
// comments on a word, suggests an edit and comments on a passage that ends in link text, answers,
// the agent takes the Snapshot, the session process exits, and the file opens from `file://`
// offline. The marks and pins show, a pin opens its card read-only (no toolbar, "Edit" or
// "Delete"), a link carries `target="_blank"` and `rel="noopener noreferrer"` and opens a new page,
// a click on the pin of the passage that ends in link text opens no page (the pin stands outside the
// link, review U-1 of 6.5), no Content Security Policy violation occurs, no request but the file
// is made, and the file inlines the `markdown` chunk once. The session process serves this test
// whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { atomAsk } from "./fixtures/atom-documents.ts";
import { NOTES, reviewItem } from "./fixtures/document-review-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard, sentDrafts } from "./harness/lifecycle-test.ts";
import { annotationsHeld, DOCUMENT, openCardOn, selectAcross } from "./harness/review-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot of a board answered with a Document review`, () => {
    const { start } = useEngine(engine);

    test(
      "opened offline from file://, the marks and pins show, a pin opens its card read-only, a link opens a new tab with no opener, the pin of a passage ending in link text opens no page, and the markdown chunk is inlined once",
      async () => {
        const ask = atomAsk([reviewItem(NOTES, "Release notes")]);
        const run = await start({ ...lifecycleScenario(ask, dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        const comment = await openCardOn(view, "remembers", "Comment");
        await comment.getByLabel("Your comment").fill("How long?");
        await comment.getByRole("button", { name: "Done" }).click();
        await comment.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        const edit = await openCardOn(view, "drafts", "Suggest edit");
        await edit.getByLabel("Replace with").fill("unsent answers");
        await edit.getByRole("button", { name: "Done" }).click();
        await edit.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        // A passage that ends in the text of the link.
        if (!(await selectAcross(view, "See the", "docs"))) throw new Error("no passage to select");
        await view
          .getByRole("toolbar")
          .getByRole("button", { name: "Comment", exact: true })
          .click();
        const third = view.getByRole("dialog");
        await third.waitFor({ timeout: STEP_TIMEOUT_MS });
        await third.getByLabel("Your comment").fill("Link it.");
        await third.getByRole("button", { name: "Done" }).click();
        await third.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => annotationsHeld(sentDrafts(run)).length === 3,
          "three annotations mirrored",
          STEP_TIMEOUT_MS,
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        // The `markdown` chunk is among those `assemble` selects, and its script is in the file once.
        const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
        expect(chunks.map(({ name }) => name)).toContain("markdown");
        for (const { name, chunk } of chunks) {
          const text = dist.files.get(chunk.script.path);
          expect({
            name,
            inlined: text !== undefined && html.includes(text),
            once: text !== undefined && html.split(text).length === 2,
          }).toEqual({ name, inlined: true, once: true });
        }

        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({
            offline: true,
            viewport: { width: 1280, height: 800 },
          });
          await context.addInitScript(() => {
            document.addEventListener("securitypolicyviolation", (event) => {
              console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
            });
          });
          const page = await context.newPage();
          const violations: string[] = [];
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          const requests: string[] = [];
          page.on("request", (request) => requests.push(request.url()));
          await page.goto(`file://${taken.path}`);
          await page.locator(DOCUMENT).waitFor({ timeout: STEP_TIMEOUT_MS });
          // The marks and the pins, with no toolbar.
          const marks = page.locator("[data-review-mark]");
          await eventually(async () => (await marks.count()) === 4, "the marks");
          // The passage that ends in the link's text is marked in two pieces, the link's own last.
          expect(await marks.allTextContents()).toEqual([
            "remembers",
            "drafts",
            "See the ",
            "docs",
          ]);
          const pin = (name: string) => page.getByRole("button", { name, exact: true });
          for (const name of ["Comment 1", "Suggested edit 2", "Comment 3"]) {
            expect({ name, pins: await pin(name).count() }).toEqual({ name, pins: 1 });
          }
          expect(await page.getByRole("toolbar").count()).toBe(0);
          // A pin opens its card read-only.
          await pin("Comment 1").click();
          const card = page.getByRole("dialog");
          await card.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await card.textContent()).toContain("How long?");
          expect(await card.getByRole("button", { name: "Edit" }).count()).toBe(0);
          expect(await card.getByRole("button", { name: "Delete" }).count()).toBe(0);
          expect(await card.getByLabel("Your comment").count()).toBe(0);
          await page.keyboard.press("Escape");
          await card.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
          await pin("Suggested edit 2").click();
          await card.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await card.textContent()).toContain("unsent answers");
          expect(await card.getByRole("button", { name: "Edit" }).count()).toBe(0);
          expect(await card.getByRole("button", { name: "Delete" }).count()).toBe(0);
          await page.keyboard.press("Escape");
          await card.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
          // The pin of the passage that ends in link text stands outside the link: no page opens.
          const link = page.getByRole("link", { name: "docs", exact: true });
          expect(await link.getAttribute("target")).toBe("_blank");
          expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
          expect(await pin("Comment 3").evaluate((el) => el.closest("a") === null)).toBe(true);
          const pages = context.pages().length;
          let popups = 0;
          page.on("popup", () => {
            popups += 1;
          });
          await pin("Comment 3").click();
          await card.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await card.textContent()).toContain("Link it.");
          await new Promise((resolve) => setTimeout(resolve, 750));
          expect({ popups, pages: context.pages().length }).toEqual({ popups: 0, pages });
          await page.keyboard.press("Escape");
          // A link opens a new page, whatever its target does offline.
          const opened = page.waitForEvent("popup", { timeout: STEP_TIMEOUT_MS });
          await link.click();
          await opened;
          expect(violations).toEqual([]);
          expect(
            requests.filter((url) => !url.startsWith("file://") && !url.includes("example.com")),
          ).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
