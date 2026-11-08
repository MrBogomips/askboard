// A Snapshot of an answered Table, in each engine (table-widget, task 7.2; spec view-and-widgets: A
// Table read-only and in Snapshots): the agent takes the Snapshot after the user's answer, the
// session process exits, and the file opens from `file://` offline. The Table shows the edited rows
// with their marks and the totals of the edited values, opens no editor, shows no toolbar tool,
// reads from the keyboard, and the page makes no request but its own file. The session process
// serves this test whatever the target.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/table-snapshot.browser.ts

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { tableAsk } from "./fixtures/table-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { actsDone, answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import {
  cellOf,
  cellText,
  counterText,
  type TableGrid,
  tableGridOf,
  toolOf,
  totalText,
  typeInCell,
} from "./harness/table-grid.ts";
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
  describe(`${engine}: a Snapshot of an answered Table`, () => {
    const { start } = useEngine(engine);

    test(
      "the file shows the edited rows with their marks and the totals, opens no editor, shows no tool, reads from the keyboard and makes no request",
      async () => {
        const run = await start({ ...lifecycleScenario(tableAsk(), dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        const live = tableGridOf(board);
        await typeInCell(board, live, "pm", "rate", "Rate, row 1", "960.00");
        await cellOf(live, "pm", "role").click();
        await toolOf(live, "Add row").click();
        await typeInCell(board, live, "u-1", "role", "Role, row 2", "QA");
        await typeInCell(board, live, "u-1", "days", "Days, row 2", "10");
        await typeInCell(board, live, "u-1", "rate", "Rate, row 2", "500");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
        expect(chunks.map((chunk) => chunk.name)).toContain("table");
        for (const { name, chunk } of chunks) {
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
          const requests: string[] = [];
          page.on("request", (request) => requests.push(request.url()));
          await page.goto(`file://${taken.path}`);
          const frame = page.locator('[data-askboard-item="costs"]');
          const table: TableGrid = {
            frame,
            grid: frame.getByRole("grid"),
            rows: frame.locator("tbody > tr[data-row-id]"),
            tools: frame.locator("[data-table-tools]"),
            counter: frame.locator("[data-counter]"),
          };
          await table.grid.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await table.rows.count()).toBe(3);
          expect(await cellText(table, "pm", "rate")).toBe("$960.00");
          expect(await cellOf(table, "pm", "rate").getAttribute("data-change")).toBe("field");
          expect(await cellOf(table, "pm", "role").getAttribute("data-change")).toBeNull();
          expect(await cellText(table, "u-1", "role")).toBe("QA");
          expect(
            await table.frame.locator('tr[data-row-id="u-1"]').getAttribute("data-change"),
          ).toBe("added");
          expect(await cellText(table, "pm", "amount")).toBe("$17,280.00");
          expect(await totalText(table, "days")).toBe("100");
          expect(await totalText(table, "amount")).toBe("$74,120.00");
          expect(await counterText(table)).toBe("Your changes: 2");
          // Nothing edits: no tool, and no editor from Enter, F2 or a double click.
          expect(await frame.getByRole("button").count()).toBe(0);
          await cellOf(table, "pm", "rate").focus();
          await page.keyboard.press("Enter");
          await page.keyboard.press("F2");
          await cellOf(table, "pm", "rate").dblclick();
          expect(await frame.getByRole("textbox").count()).toBe(0);
          expect(await cellText(table, "pm", "rate")).toBe("$960.00");
          // Readable from the keyboard: the arrow keys move the current cell.
          await cellOf(table, "pm", "role").focus();
          await page.keyboard.press("ArrowRight");
          await eventually(
            async () => (await cellOf(table, "pm", "days").getAttribute("tabindex")) === "0",
            "the days cell to be the current cell",
          );
          await page.keyboard.press("ArrowDown");
          await eventually(
            async () => (await cellOf(table, "u-1", "days").getAttribute("tabindex")) === "0",
            "the next row's days cell to be the current cell",
          );
          expect(violations).toEqual([]);
          expect(requests.filter((url) => !url.startsWith("file://"))).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
