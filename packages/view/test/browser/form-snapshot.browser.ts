// A Snapshot of a Form, in each engine and in en-US and it-IT (form-widget, task 4.2; spec
// view-and-widgets: Forms read-only and in Snapshots, Form strings): the agent takes the Snapshot
// after the user's answer, the session process exits, and the file opens from `file://` offline with
// no CSP violation. Each field shows its value read-only and formatted in the ask's language, the
// PickField's picks are checked and disabled with no filter and no "Clear", no field shows a required
// mark or a field error that asks for input, and the `pick-field` chunk is inlined. A Snapshot of an
// unanswered Form asks for nothing either. The session process serves this test whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { FORM_QUESTION } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser, Page } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import type { Asker } from "./harness/asker.ts";
import { STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { actsDone, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };
const QUESTION = FORM_QUESTION.id;

// The Region holds twelve options, more than the filter's threshold, so a board shows the filter and
// a Snapshot must not.
const EXTRA = Array.from({ length: 9 }, (_, at) => ({ id: `r${at}`, label: `Region ${at + 1}` }));
const withLongRegion = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(withLongRegion);
  if (typeof node !== "object" || node === null) return node;
  const record = node as Record<string, unknown>;
  const next = Object.fromEntries(Object.entries(record).map(([k, v]) => [k, withLongRegion(v)]));
  if (record.id !== "form-region") return next;
  const props = next.props as { options: unknown[] };
  return { ...next, props: { ...props, options: [...props.options, ...EXTRA] } };
};
const ask = (language: string) => ({
  askId: "form-snapshot-p4w8",
  title: "Intake",
  language,
  items: [withLongRegion(FORM_QUESTION)],
});

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

/** Each language's words, the typed forms of the values, and how the read-only fields show them. */
const CASES = [
  {
    language: "en-US",
    answer: "Answer",
    typed: { start: "3/2/2026", seats: "4", budget: "1200.00" },
    shown: { start: "Mon, Mar 2, 2026", seats: "4", budget: "€1,200.00", notify: "On" },
    words: { required: "(required)", clear: "Clear", filter: "Filter the options" },
  },
  {
    language: "it-IT",
    answer: "Rispondi",
    typed: { start: "02/03/2026", seats: "4", budget: "1200,00" },
    shown: { start: "lun 2 mar 2026", seats: "4", budget: "€ 1.200,00", notify: "Attivo" },
    words: { required: "(obbligatorio)", clear: "Cancella", filter: "Filtra le opzioni" },
  },
] as const;

/** Opens the Snapshot from `file://` in a new offline browser; the page and what to close. */
const openSnapshot = async (engine: Parameters<typeof launchEngine>[0], path: string) => {
  const browser: Browser = await launchEngine(engine);
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
  await page.goto(`file://${path}`);
  return { page, violations, close: () => browser.close() };
};

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
const box = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

// Nothing in the file asks for input: no required mark, no field error, no filter, no "Clear", no
// control that can be changed.
const expectNothingAsked = async (page: Page, words: (typeof CASES)[number]["words"]) => {
  expect(await page.getByText(words.required, { exact: false }).count()).toBe(0);
  expect(await page.locator('[id$=":error"]').count()).toBe(0);
  expect(await page.locator('[aria-required="true"]').count()).toBe(0);
  expect(await page.getByRole("button", { name: words.clear, exact: true }).count()).toBe(0);
  expect(await page.getByLabel(words.filter).count()).toBe(0);
  expect(await page.getByRole("button", { name: /Choose a date|Scegli una data/ }).count()).toBe(0);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const { language, answer, typed, shown, words } of CASES) {
    describe(`${engine}: a Snapshot of an answered Form, ${language}`, () => {
      const { start } = useEngine(engine);

      test(
        "each field shows its value read-only, the picks are checked and disabled with no filter or Clear, nothing asks for input, the pick-field chunk is inlined, and no CSP problem is reported",
        async () => {
          const run = await start({ ...lifecycleScenario(ask(language), dist), asker: ASKER });
          const board = await openBoard(run, [QUESTION]);
          const live = (label: string) =>
            board.view.getByLabel(new RegExp(`^${label}( \\(${words.required.slice(1, -1)}\\))?$`));
          await live("Name").fill("Ada Lovelace");
          await live("Ticket").fill("AB-1234");
          await live("Start date").fill(typed.start);
          await board.view.getByRole("tab", { name: /^Preferences/ }).click();
          // The live board shows the filter the Snapshot must not.
          await board.view.getByLabel(words.filter).waitFor({ timeout: STEP_TIMEOUT_MS });
          await live("Seats").fill(typed.seats);
          await live("Budget").fill(typed.budget);
          await board.view.getByRole("radio", { name: "Europe", exact: true }).click();
          await board.view.getByRole("checkbox", { name: "Email", exact: true }).click();
          await board.view.getByRole("checkbox", { name: "Chat", exact: true }).click();
          await board.view.getByRole("switch", { name: "Notify me" }).click();
          await board.view
            .getByRole("button", { name: answer, exact: true })
            .click({ timeout: STEP_TIMEOUT_MS });
          await actsDone(run, 1);
          const taken = await run.session.snapshot();
          await run.session.exit();
          const html = await Bun.file(taken.path).text();
          const data = dataBlockOf(html);
          expect(validateSnapshotData(data).ok).toBe(true);
          const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
          for (const name of ["pick-field", "text-field", "date-field", "tabs", "group"]) {
            expect(chunks.map((chunk) => chunk.name)).toContain(name);
          }
          for (const { name, chunk } of chunks) {
            const text = dist.files.get(chunk.script.path);
            expect({ name, inlined: text !== undefined && html.includes(text) }).toEqual({
              name,
              inlined: true,
            });
          }

          const opened = await openSnapshot(engine, taken.path);
          try {
            const { page } = opened;
            await field(page, "Name").waitFor({ timeout: STEP_TIMEOUT_MS });
            const values = async () => ({
              name: await field(page, "Name").inputValue(),
              ticket: await field(page, "Ticket").inputValue(),
              start: await field(page, "Start date").inputValue(),
              seats: await field(page, "Seats").inputValue(),
              budget: await field(page, "Budget").inputValue(),
              notify: await page.locator('[id="form-notify:state"]').textContent(),
              europe: await radio(page, "Europe").getAttribute("aria-checked"),
              usa: await radio(page, "North America").getAttribute("aria-checked"),
              email: await box(page, "Email").getAttribute("aria-checked"),
              chat: await box(page, "Chat").getAttribute("aria-checked"),
              phone: await box(page, "Phone").getAttribute("aria-checked"),
            });
            const expected = {
              name: "Ada Lovelace",
              ticket: "AB-1234",
              start: shown.start,
              seats: shown.seats,
              budget: shown.budget,
              notify: shown.notify,
              europe: "true",
              usa: "false",
              email: "true",
              chat: "true",
              phone: "false",
            };
            // The Preferences tab is the one that shows these fields; the first tab holds the rest.
            await page.getByRole("tab", { name: "Preferences" }).click();
            await field(page, "Seats").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
            expect(await values()).toEqual(expected);
            for (const label of ["Name", "Ticket", "Start date", "Seats", "Budget"]) {
              expect({
                label,
                readonly: await field(page, label).getAttribute("readonly"),
              }).not.toEqual({ label, readonly: null });
            }
            for (const control of [
              radio(page, "Europe"),
              radio(page, "North America"),
              box(page, "Email"),
              box(page, "Phone"),
              page.getByRole("switch", { name: "Notify me" }),
            ]) {
              expect(await control.isDisabled()).toBe(true);
            }
            // The long Region list shows whole, with no filter.
            expect(
              await page.locator('[data-askboard-field="form-region"]').getByRole("radio").count(),
            ).toBe(12);
            await expectNothingAsked(page, words);
            // Nothing can be changed.
            await radio(page, "North America")
              .click({ force: true, noWaitAfter: true })
              .catch(() => undefined);
            await box(page, "Phone")
              .click({ force: true, noWaitAfter: true })
              .catch(() => undefined);
            await field(page, "Seats")
              .press("9", { noWaitAfter: true })
              .catch(() => undefined);
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(await values()).toEqual(expected);
            expect(opened.violations).toEqual([]);
          } finally {
            await opened.close();
          }
        },
        TEST_TIMEOUT_MS,
      );
    });
  }

  describe(`${engine}: a Snapshot of an unanswered Form`, () => {
    const { start } = useEngine(engine);

    test(
      "the empty fields carry no required mark, no field error and no control to fill them, and the picks are unchecked and disabled",
      async () => {
        const run = await start({ ...lifecycleScenario(ask("en-US"), dist), asker: ASKER });
        const board = await openBoard(run, [QUESTION]);
        // A pattern not met and an empty required field show on the board, none of it in the file.
        await board.view.getByLabel("Ticket", { exact: true }).fill("ab-1234");
        await board.view.locator('[id="form-ticket:error"]').waitFor({ timeout: STEP_TIMEOUT_MS });
        await board.view.getByLabel(/^Name \(required\)$/).waitFor({ timeout: STEP_TIMEOUT_MS });
        const taken = await run.session.snapshot();
        await run.session.exit();
        const opened = await openSnapshot(engine, taken.path);
        try {
          const { page } = opened;
          await field(page, "Name").waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await field(page, "Name").inputValue()).toBe("");
          await expectNothingAsked(page, CASES[0].words);
          await page.getByRole("tab", { name: "Preferences" }).click();
          await radio(page, "Europe").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
          for (const control of [radio(page, "Europe"), box(page, "Email")]) {
            expect(await control.getAttribute("aria-checked")).toBe("false");
            expect(await control.isDisabled()).toBe(true);
          }
          await expectNothingAsked(page, CASES[0].words);
          expect(opened.violations).toEqual([]);
        } finally {
          await opened.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
