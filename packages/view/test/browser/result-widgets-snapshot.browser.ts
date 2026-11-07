// A Snapshot of a board answered with the three result widgets, in each engine (approval-scale-
// ranking, task 6.3; spec view-and-widgets: Result widgets read-only, The drag library in a shared
// chunk): the agent takes the Snapshot after the user's answer ("Approve with changes" with a
// reason, a rating of 4, a Ranking reordered, a Tree node renamed), the session process exits, and
// the file opens from `file://` offline with no CSP violation. Each widget shows its result
// read-only, the Approval's summary comes from the answer, nothing can be selected, set or moved,
// and the file inlines the chunks `assemble` selects for the three types, `dnd` and `radix` among
// them. The session process serves this test whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { RANKING_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser, Page } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { VERDICT } from "./fixtures/approval-asks.ts";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import { decisionOf, isPressed, promptOf, REASON, renameNode } from "./harness/approval-board.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, card, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { beginDrag, dragOver, expectDrop, HALF, handleOf, rowOf } from "./harness/ranking-drag.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };
const MOOD = {
  type: "scale",
  id: "mood",
  props: { min: 1, max: 5, display: "rating", minLabel: "Low", maxLabel: "High" },
} as const;
const ask = {
  askId: "snapshot-widgets-s1t2",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [wbs, MOOD, RANKING_FIXTURE_ITEM, VERDICT] },
    },
  ],
} as const;
const ORDER = ["comfort", "speed", "cost"];
const UX = "UX design, reviewed";

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

const orderIn = (page: Page): Promise<(string | null)[]> =>
  page
    .locator("[data-ranking-row]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-ranking-row")));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot of a board answered with the three result widgets`, () => {
    const { start } = useEngine(engine);

    test(
      "each widget shows its result read-only, the summary comes from the answer, nothing can be selected, set or moved, and the file inlines the chunks of the three, the drag library and Radix among them",
      async () => {
        const run = await start({ ...lifecycleScenario(ask, dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        await renameNode(board, "ux", UX);
        await card(board, "plan")
          .getByRole("radio", { name: "4", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await beginDrag(board, handleOf(board, "comfort"));
        await dragOver(board, rowOf(board, "speed"), HALF.top);
        await expectDrop(board, "speed", "before");
        await board.page.mouse.up();
        await decisionOf(board, "plan", "Approve with changes").click();
        await promptOf(board, "plan", REASON).fill("Show the training as an extra");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.header.getByText("Answered").waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        // The chunks `assemble` selects for the three types are in the file, whole.
        const names = selectChunks(data.document, dist.manifest, targetOf(data)).map(
          ({ name }) => name,
        );
        for (const name of ["approval", "scale", "ranking", "dnd", "radix"]) {
          expect(names).toContain(name);
        }
        for (const { name, chunk } of selectChunks(data.document, dist.manifest, targetOf(data))) {
          const text = dist.files.get(chunk.script.path);
          expect({ name, inlined: text !== undefined && html.includes(text) }).toEqual({
            name,
            inlined: true,
          });
        }

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
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          await page.goto(`file://${taken.path}`);
          const radios = (name: string) => page.getByRole("radio", { name, exact: true });
          await radios("Approve with changes").waitFor({ timeout: STEP_TIMEOUT_MS });
          // The Approval: its decision pressed and disabled, its summary from the answer.
          await eventually(() => isPressed(radios("Approve with changes")), "the decision shown");
          for (const name of ["Approve", "Approve with changes", "Reject"]) {
            expect(await radios(name).isDisabled()).toBe(true);
          }
          expect(await page.locator("[data-summary-title]").textContent()).toBe("1 change");
          expect(await page.locator("[data-summary-line]").count()).toBe(1);
          expect(await page.locator("[data-summary-line]").textContent()).toContain("UX design");
          // The Scale's rating: 4 pressed, every step disabled.
          const rating = page.locator("[data-scale]").getByRole("radio");
          expect(await rating.count()).toBe(5);
          expect(
            await page
              .locator("[data-scale]")
              .getByRole("radio", { name: "4" })
              .getAttribute("aria-checked"),
          ).toBe("true");
          for (const step of await rating.all()) expect(await step.isDisabled()).toBe(true);
          // The Ranking: the answered order, moved rows marked, its tools and handles inert.
          expect(await orderIn(page)).toEqual(ORDER);
          expect(await page.locator('[data-change="moved"]').count()).toBe(3);
          expect(await page.locator("[data-ranking-counter]").textContent()).toContain("3 moved");
          // Nothing can be selected, set or moved.
          await radios("Reject").click({ force: true });
          await radios("Approve").click({ force: true });
          await rating.first().click({ force: true });
          await rating.nth(1).focus();
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("Space");
          // A read-only row has no handle; a drag from the row itself moves nothing.
          expect(await page.locator("[data-drag-handle]").count()).toBe(0);
          const box = await page.locator('[data-ranking-row="cost"]').boundingBox();
          const target = await page.locator('[data-ranking-row="comfort"]').boundingBox();
          if (box === null || target === null) throw new Error("a Ranking row has no box");
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(target.x + target.width / 2, target.y + 2, { steps: 10 });
          await page.mouse.up();
          for (const tool of ["Move up", "Move down", "Keep this order"]) {
            const button = page
              .getByRole("toolbar", { name: "Ranking tools" })
              .getByRole("button", { name: tool, exact: true });
            expect(await button.getAttribute("aria-disabled")).toBe("true");
            await button.click({ force: true });
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          expect(await isPressed(radios("Approve with changes"))).toBe(true);
          expect(await isPressed(radios("Approve"))).toBe(false);
          expect(await isPressed(radios("Reject"))).toBe(false);
          expect(
            await page
              .locator("[data-scale]")
              .getByRole("radio", { name: "4" })
              .getAttribute("aria-checked"),
          ).toBe("true");
          expect(await orderIn(page)).toEqual(ORDER);
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
