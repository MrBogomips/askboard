// An it-IT board of every atom, in each engine (atoms, task 6.4; view-and-widgets spec: Atom
// strings): the unset Toggle reads "Non impostato", the field errors and the currency label are
// Italian, an open calendar has its Italian caption, navigation, weekday names and day names, and
// no English string of the atoms is left on the board, in text or in an accessible name. The
// agent's own labels and Markdown stay as sent.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/atoms-it.browser.ts

import { describe, expect, test } from "bun:test";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const ITEMS = [
  { type: "text", id: "intro", props: { text: "Plain **text** the agent sent." } },
  { type: "value", id: "total", props: { label: "Total", kind: "duration", days: 12 } },
  { type: "divider", id: "rule", props: {} },
  { type: "text-field", id: "name", props: { label: "Name" } },
  { type: "toggle", id: "notify", props: { label: "Notify" } },
  { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 20, step: 0.5 } },
  {
    type: "money-field",
    id: "price",
    props: { label: "Price", currencies: ["EUR", "USD"] },
  },
  {
    type: "date-field",
    id: "due",
    props: { label: "Due", min: "2026-12-01", max: "2026-12-31" },
  },
];

// The atoms' English strings, which an Italian board shows none of.
const ENGLISH = [
  "Not set",
  "Clear",
  "Choose a date",
  "Previous month",
  "Next month",
  "Month navigation",
  "Pick a currency",
  "At most",
  "At least",
  "Currency",
  "A whole number",
  "On or after",
  "days",
  "Answer",
];

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: an it-IT board of every atom`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Non impostato, Italian errors, currency label and calendar, and no English string of the atoms left in text or accessible names",
      async () => {
        const run = await host(dist, atomDocument(ITEMS as never, "it-IT"));
        await readyIn(run);
        const { view } = run.board;
        expect(await view.locator('[id="notify:state"]').textContent()).toBe("Non impostato");
        expect(await view.locator(`[aria-label="Valuta"]`).count()).toBe(1);
        // Errors: a number over its maximum, an amount before a currency.
        await view.getByLabel("Days", { exact: true }).fill("21");
        await eventually(
          async () => (await view.locator('[id="days:error"]').textContent()) === "Al massimo 20.",
          "the Italian maximum error",
        );
        await view.getByLabel("Price", { exact: true }).fill("5");
        await eventually(
          async () =>
            (await view.locator('[id="price:error"]').textContent()) === "Scegli una valuta.",
          "the Italian currency error",
        );
        // A set Toggle shows Attivo and Cancella.
        await view.getByRole("switch", { name: "Notify" }).click();
        await view.getByRole("button", { name: "Cancella", exact: true }).waitFor();
        expect(await view.locator('[id="notify:state"]').textContent()).toBe("Attivo");
        await view.getByRole("button", { name: "Cancella", exact: true }).click();
        expect(await view.locator('[id="notify:state"]').textContent()).toBe("Non impostato");
        // The calendar, open: caption, navigation, weekdays, a day.
        await view.getByRole("button", { name: "Scegli una data", exact: true }).click();
        await view.getByRole("button", { name: "Mese successivo", exact: true }).waitFor();
        expect(await view.getByText("dicembre 2026", { exact: true }).count()).toBeGreaterThan(0);
        expect(await view.locator('[aria-label="Navigazione tra i mesi"]').count()).toBeGreaterThan(
          0,
        );
        expect(await view.getByText("12 giorni").count()).toBeGreaterThan(0);
        expect((await view.locator("th").allTextContents()).map((text) => text.trim())).toEqual([
          "lun",
          "mar",
          "mer",
          "gio",
          "ven",
          "sab",
          "dom",
        ]);
        expect(
          await view.getByRole("button", { name: "mer 9 dic 2026", exact: true }).count(),
        ).toBe(1);
        // Nothing of the atoms is English: visible text, and every accessible name and title.
        const text = await view.locator("body").innerText();
        const names = await view
          .locator("[aria-label], [title]")
          .evaluateAll((els) =>
            els.map(
              (el) => `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`,
            ),
          );
        const everything = `${text}\n${names.join("\n")}`;
        // The agent's labels and text are as sent: "Days" and "Notify" stay, and are no atom string.
        const leftover = ENGLISH.filter((word) => new RegExp(`\\b${word}\\b`).test(everything));
        expect(leftover).toEqual([]);
        // The agent's Text is as sent.
        expect(await view.getByText("Plain", { exact: false }).count()).toBeGreaterThan(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
