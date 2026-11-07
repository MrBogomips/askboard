// A Snapshot of a board answered with every input atom, in each engine (atoms, task 6.2; spec
// view-and-widgets: Atoms read-only and in Snapshots): the agent takes the Snapshot after the user's
// answer, the session process exits, and the file opens from `file://` offline with no CSP
// violation. Each input atom shows the answer's value read-only, formatted in the ask's locale,
// with no echo and no field error, the Markdown Text keeps its link as an anchor that opens in a new
// tab with `rel="noopener noreferrer"`, and nothing in the file can be changed. The session process
// serves this test whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { atomAsk, MARKDOWN_SOURCE } from "./fixtures/atom-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { actsDone, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

const INTRO = { type: "text", id: "intro", props: { text: MARKDOWN_SOURCE, format: "markdown" } };
const NAME = { type: "text-field", id: "name", props: { label: "Name" } };
const NOTES = { type: "text-field", id: "notes", props: { label: "Notes", multiline: true } };
const NOTIFY = { type: "toggle", id: "notify", props: { label: "Notify me" } };
const DAYS = {
  type: "number-field",
  id: "days",
  props: { label: "Days", min: 0, max: 20, step: 0.5 },
};
const START = { type: "date-field", id: "start", props: { label: "Start" } };
const FEE = { type: "money-field", id: "fee", props: { label: "Fee", currency: "EUR", min: "0" } };
const ITEMS = [INTRO, NAME, NOTES, NOTIFY, DAYS, START, FEE];

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

/** Each language's typed forms of the answer's values, and how the read-only atoms show them. */
const CASES = [
  {
    language: "en-US",
    typed: { days: "3.5", start: "3/2/2026", fee: "1234.50" },
    shown: { days: "3.5", start: "Mon, Mar 2, 2026", fee: "€1,234.50" },
  },
  {
    language: "it-IT",
    typed: { days: "3,5", start: "02/03/2026", fee: "1234,50" },
    shown: { days: "3,5", start: "lun 2 mar 2026", fee: "€ 1.234,50" },
  },
] as const;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const { language, typed, shown } of CASES) {
    describe(`${engine}: a Snapshot of a board answered with every input atom, ${language}`, () => {
      const { start } = useEngine(engine);

      test(
        "each atom shows its value read-only with no echo or error, the Markdown link is an anchor for a new tab, and nothing can be changed",
        async () => {
          const run = await start({
            ...lifecycleScenario(atomAsk(ITEMS, { language }), dist),
            asker: ASKER,
          });
          const board = await openBoard(run, ["plan"]);
          await board.view.getByLabel("Name", { exact: true }).fill("Ada");
          await board.view.getByLabel("Notes", { exact: true }).fill("one\ntwo");
          await board.view.getByRole("switch", { name: "Notify me" }).click();
          await board.view.getByLabel("Days", { exact: true }).fill(typed.days);
          await board.view.getByLabel("Start", { exact: true }).fill(typed.start);
          await board.view.getByLabel("Fee", { exact: true }).fill(typed.fee);
          await board.view
            .getByRole("button", {
              name: language === "it-IT" ? "Rispondi" : "Answer",
              exact: true,
            })
            .click({ timeout: STEP_TIMEOUT_MS });
          await actsDone(run, 1);
          const taken = await run.session.snapshot();
          await run.session.exit();
          const html = await Bun.file(taken.path).text();
          const data = dataBlockOf(html);
          expect(validateSnapshotData(data).ok).toBe(true);
          const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
          for (const name of ["text", "text-field", "toggle", "number-field", "date-field"]) {
            expect(chunks.map((chunk) => chunk.name)).toContain(name);
          }
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
            await page.goto(`file://${taken.path}`);
            const field = (label: string) => page.getByLabel(label, { exact: true });
            await field("Name").waitFor({ timeout: STEP_TIMEOUT_MS });
            const values = async () => ({
              name: await field("Name").inputValue(),
              notes: await field("Notes").inputValue(),
              days: await field("Days").inputValue(),
              start: await field("Start").inputValue(),
              fee: await field("Fee").inputValue(),
              notify: await page.locator('[id="notify:state"]').textContent(),
            });
            const expected = {
              name: "Ada",
              notes: "one\ntwo",
              ...shown,
              notify: language === "it-IT" ? "Attivo" : "On",
            };
            expect(await values()).toEqual(expected);
            // Read-only: the fields refuse text, the switch is disabled, the calendar has no button.
            for (const label of ["Name", "Notes", "Days", "Start", "Fee"]) {
              expect({ label, readonly: await field(label).getAttribute("readonly") }).not.toEqual({
                label,
                readonly: null,
              });
            }
            expect(await page.getByRole("switch", { name: "Notify me" }).isDisabled()).toBe(true);
            expect(
              await page.getByRole("button", { name: /Choose a date|Scegli una data/ }).count(),
            ).toBe(0);
            // No echo and no field error on a read-only atom.
            for (const id of ["days", "start", "fee"]) {
              expect(await page.locator(`[id="${id}:note"]`).count()).toBe(0);
              expect(await page.locator(`[id="${id}:error"]`).count()).toBe(0);
            }
            // The Markdown Text: an anchor for a new tab.
            const link = page.getByRole("link", { name: "docs" });
            expect(await link.getAttribute("target")).toBe("_blank");
            expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
            // Nothing can be changed.
            await field("Name")
              .press("x", { noWaitAfter: true })
              .catch(() => undefined);
            await page.getByRole("switch", { name: "Notify me" }).click({ force: true });
            await field("Days")
              .press("9", { noWaitAfter: true })
              .catch(() => undefined);
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(await values()).toEqual(expected);
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
}
