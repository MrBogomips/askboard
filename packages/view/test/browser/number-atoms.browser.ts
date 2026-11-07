// The NumberField and the MoneyField in each engine (atoms, task 5.4; view-and-widgets spec: Number,
// amount and date entry in the fields, An entry blocks Answer, Input atoms fill the draft only, Atoms
// read-only and in Snapshots): text read in the ask's locale, each bound and step error, a value
// within bounds as the result and anything else as an entry that disables "Answer" and survives a
// reload, the echo in both locales, a currency picked from `currencies` by keyboard, an amount typed
// before a currency being an entry, the read-only formatting, and Select recommended and Submit
// never carrying a held answer past an entry (task 4.5).
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/number-atoms.browser.ts

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { atomAsk, atomDocument } from "./fixtures/atom-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  answerOf,
  barButton,
  lifecycleScenario,
  openBoard,
  optionOf,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const DAYS = {
  type: "number-field",
  id: "days",
  props: { label: "Days", min: 0, max: 20, step: 0.5, unit: "days" },
};
const SEATS = { type: "number-field", id: "seats", props: { label: "Seats", integer: true } };
const FEE = { type: "money-field", id: "fee", props: { label: "Fee", currency: "EUR", min: "0" } };
const PRICE = {
  type: "money-field",
  id: "price",
  props: { label: "Price", currencies: ["EUR", "USD", "JPY"] },
};
const ITEMS = [DAYS, SEATS, FEE, PRICE];

const holding = (run: WidgetHostRun, itemId: string, expected: unknown, what: string) =>
  eventually(() => draftHolds(run.drafts, "plan", itemId, expected), what);

// The latest draft record's entries for the question, as the view mirrored it.
// The "Answer" button in Italian, which the board's own locator names in English.
const answerButton = (run: WidgetHostRun): Locator =>
  run.board.view.getByRole("button", { name: "Rispondi", exact: true });

const entriesOf = (run: WidgetHostRun): unknown => {
  const latest = run.drafts.at(-1) as {
    record?: { questions?: Record<string, { entries?: unknown }> };
  };
  return latest?.record?.questions?.plan?.entries;
};

const fieldOf = (run: WidgetHostRun, label: string): Locator =>
  run.board.view.getByLabel(label, { exact: true });
const errorOf = (run: WidgetHostRun, id: string): Locator =>
  run.board.view.locator(`[id="${id}:error"]`);
const noteOf = (run: WidgetHostRun, id: string): Locator =>
  run.board.view.locator(`[id="${id}:note"]`);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the NumberField`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a value within the bounds is the result with its echo; clearing the field removes the result and the entry; the unit is an affix",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        expect(await fieldOf(run, "Days").getAttribute("type")).toBe("text");
        expect(
          await run.board.view
            .locator('[data-askboard-field="days"]')
            .getByText("days", { exact: true })
            .count(),
        ).toBe(1);
        expect(await run.board.answer.isDisabled()).toBe(true);
        await fieldOf(run, "Days").fill("3.5");
        await holding(run, "days", 3.5, "the draft to hold 3.5");
        expect(await noteOf(run, "days").textContent()).toBe("= 3.5");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        await fieldOf(run, "Days").fill("");
        await holding(run, "days", undefined, "the draft to hold no result");
        expect(entriesOf(run)).toBeUndefined();
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await noteOf(run, "days").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "each bound and step error is worded in the ask's locale, kept as an entry, and disables Answer until corrected",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const cases: [string, string, string][] = [
          ["Days", "21", "At most 20."],
          ["Days", "-1", "At least 0."],
          ["Days", "3.25", "A multiple of 0.5 from 0."],
          ["Seats", "2.5", "A whole number."],
        ];
        for (const [label, typed, error] of cases) {
          const id = label === "Days" ? "days" : "seats";
          await fieldOf(run, label).fill(typed);
          await eventually(async () => (await errorOf(run, id).textContent()) === error, error);
          expect(await fieldOf(run, label).getAttribute("aria-invalid")).toBe("true");
          expect(await fieldOf(run, label).inputValue()).toBe(typed);
          expect(await run.board.answer.isDisabled()).toBe(true);
          await holding(run, id, undefined, `no result for ${typed}`);
          await fieldOf(run, label).fill("");
        }
        // Corrected, the entry goes and Answer is enabled.
        await fieldOf(run, "Days").fill("21");
        await eventually(async () => (await errorOf(run, "days").count()) === 1, "the error");
        await fieldOf(run, "Days").fill("20");
        await holding(run, "days", 20, "the draft to hold 20");
        expect(await errorOf(run, "days").count()).toBe(0);
        expect(await run.board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an English habit in an Italian field gives the parser's reason, no result, and Answer disabled; in it-IT 3,5 is read",
      async () => {
        const run = await host(dist, atomDocument([SEATS, DAYS], "it-IT"));
        await readyIn(run);
        await fieldOf(run, "Days").fill("1.23");
        await eventually(
          async () =>
            (await errorOf(run, "days").textContent())?.includes("Usa i punti solo tra gruppi") ===
            true,
          "the Italian reason",
        );
        await holding(run, "days", undefined, "no result");
        expect(await answerButton(run).isDisabled()).toBe(true);
        await fieldOf(run, "Days").fill("3,5");
        await holding(run, "days", 3.5, "the draft to hold 3.5");
        expect(await noteOf(run, "days").textContent()).toBe("= 3,5");
        await fieldOf(run, "Days").fill("21");
        await eventually(
          async () => (await errorOf(run, "days").textContent()) === "Al massimo 20.",
          "Al massimo 20.",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a trailing zero typed on the way to a value is not lost: 10.05 can be typed through 10.0",
      async () => {
        const run = await host(
          dist,
          atomDocument([{ type: "number-field", id: "free", props: { label: "Free" } }]),
        );
        await readyIn(run);
        const field = fieldOf(run, "Free");
        await field.pressSequentially("10.05", { delay: 20 });
        expect(await field.inputValue()).toBe("10.05");
        await holding(run, "free", 10.05, "the draft to hold 10.05");
        await field.fill("10.0");
        expect(await field.inputValue()).toBe("10.0");
        await holding(run, "free", 10, "the draft to hold 10");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the MoneyField`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an Italian amount: 1.234,5 in EUR echoes = 1234,50 EUR and the draft holds the decimal string",
      async () => {
        const run = await host(dist, atomDocument(ITEMS, "it-IT"));
        await readyIn(run);
        await fieldOf(run, "Fee").fill("1.234,5");
        await holding(
          run,
          "fee",
          { amount: "1234.50", currency: "EUR" },
          "the amount in the draft",
        );
        expect(await noteOf(run, "fee").textContent()).toBe("= 1234,50 EUR");
        await fieldOf(run, "Fee").fill("12,345");
        await eventually(async () => (await errorOf(run, "fee").count()) === 1, "the error");
        expect(await noteOf(run, "fee").count()).toBe(0);
        await holding(run, "fee", undefined, "no result for an entry");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "en-US echoes = 1234.50 EUR; a decimal past the currency's units is an entry naming it",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        await fieldOf(run, "Fee").fill("1,234.5");
        await holding(
          run,
          "fee",
          { amount: "1234.50", currency: "EUR" },
          "the amount in the draft",
        );
        expect(await noteOf(run, "fee").textContent()).toBe("= 1234.50 EUR");
        await fieldOf(run, "Fee").fill("12.345");
        await eventually(
          async () =>
            (await errorOf(run, "fee").textContent()) ===
            "EUR takes at most 2 decimals, as in 12.50.",
          "the decimals error",
        );
        await fieldOf(run, "Fee").fill("-1");
        await eventually(
          async () => (await errorOf(run, "fee").textContent()) === "At least €0.00.",
          "At least €0.00.",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a currency is picked from the list by keyboard; an amount typed before it is an entry that Pick a currency. explains, and picking makes it the result",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const group = run.board.view.getByRole("radiogroup", { name: "Currency" });
        const codes = group.getByRole("radio");
        expect(await codes.count()).toBe(3);
        for (let at = 0; at < 3; at += 1)
          expect(await codes.nth(at).getAttribute("aria-checked")).toBe("false");
        await fieldOf(run, "Price").fill("12,5".replace(",", "."));
        await eventually(
          async () => (await errorOf(run, "price").textContent()) === "Pick a currency.",
          "Pick a currency.",
        );
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(entriesOf(run)).toEqual({ price: "12.5" });
        await holding(run, "price", undefined, "no result yet");
        // The keyboard: focus the group, move to USD, press Space.
        await codes.first().focus();
        await run.board.page.keyboard.press("ArrowRight");
        // The roving focus moves to USD on its own turn: Space goes to the item that has it.
        await eventually(() => isFocused(codes.nth(1)), "the focus on USD");
        await run.board.page.keyboard.press("Space");
        await eventually(
          async () => (await codes.nth(1).getAttribute("aria-checked")) === "true",
          "USD pressed",
        );
        await holding(run, "price", { amount: "12.50", currency: "USD" }, "the amount in USD");
        expect(await errorOf(run, "price").count()).toBe(0);
        expect(await noteOf(run, "price").textContent()).toBe("= 12.50 USD");
        expect(entriesOf(run)).toBeUndefined();
        expect(await run.board.answer.isEnabled()).toBe(true);
        // Switching to JPY, which takes no decimals, makes the amount an entry again.
        await codes.nth(2).click();
        await eventually(
          async () =>
            (await errorOf(run, "price").textContent())?.includes("JPY takes no decimals") === true,
          "the JPY error",
        );
        await holding(run, "price", undefined, "no result for JPY");
        await fieldOf(run, "Price").fill("1500");
        await holding(run, "price", { amount: "1500", currency: "JPY" }, "the amount in JPY");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: entries across a reload, answers and Select recommended`, () => {
    const { start } = useEngine(engine);

    test(
      "an entry is restored after a reload with its error, and Answer stays disabled until the user corrects it",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([DAYS]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Days", { exact: true }).fill("21");
        await eventually(
          () =>
            sentDrafts(run).some((record) =>
              JSON.stringify(record).includes('"entries":{"days":"21"}'),
            ),
          "the entry mirrored to the board page",
        );
        await reloadBoard(board, run, () =>
          board.view.getByLabel("Days", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS }),
        );
        const field = board.view.getByLabel("Days", { exact: true });
        await eventually(async () => (await field.inputValue()) === "21", "the entry restored");
        await eventually(
          async () =>
            (await board.view.locator('[id="days:error"]').textContent()) === "At most 20.",
          "the field error restored",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await field.fill("20");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the answer returns the number and the amount by item ID; read-only once the ask closes, in the ask's locale",
      async () => {
        const run = await start(
          lifecycleScenario(atomAsk([DAYS, FEE, PRICE], { language: "it-IT" }), dist),
        );
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Days", { exact: true }).fill("3,5");
        await board.view.getByLabel("Fee", { exact: true }).fill("1.234,5");
        await board.view.getByLabel("Price", { exact: true }).fill("99");
        await board.view.getByRole("radio", { name: "USD" }).click();
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "price", { amount: "99.00", currency: "USD" }),
          "the amounts in the draft",
        );
        await board
          .question("plan")
          .getByRole("button", { name: "Rispondi", exact: true })
          .click({ timeout: STEP_TIMEOUT_MS });
        await board.view
          .getByText("inviata", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({
          days: 3.5,
          fee: { amount: "1234.50", currency: "EUR" },
          price: { amount: "99.00", currency: "USD" },
        });
        await run.session.update([{ action: "close" }]);
        await board.banner(/chius/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
        const days = board.view.getByLabel("Days", { exact: true });
        await eventually(async () => (await days.getAttribute("readonly")) !== null, "read-only");
        expect(await days.inputValue()).toBe("3,5");
        expect(await board.view.getByLabel("Fee", { exact: true }).inputValue()).toMatch(
          /1\.234,50/,
        );
        expect(await board.view.getByLabel("Price", { exact: true }).inputValue()).toMatch(/99,00/);
        expect(await board.view.getByRole("radio", { name: "USD" }).count()).toBe(0);
        expect(await board.view.locator('[id="days:note"]').count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended in submitted delivery selects the option but holds nothing while a field holds an entry; Submit then waits",
      async () => {
        const ask = {
          askId: "entry-submit-c3d4",
          title: "Entry and Submit",
          delivery: "submitted",
          items: [
            {
              type: "question",
              id: "region",
              props: {
                text: "Which region?",
                options: [{ label: "EU", recommended: true }, { label: "US" }],
                items: [DAYS],
              },
            },
            {
              type: "question",
              id: "cache",
              props: { text: "Cache reads?", options: [{ label: "Yes" }, { label: "No" }] },
            },
          ],
        };
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["region", "cache"]);
        await board.view.getByLabel("Days", { exact: true }).fill("21");
        await eventually(
          async () => (await board.view.locator('[id="days:error"]').count()) === 1,
          "the error",
        );
        await barButton(board, "Select recommended").click();
        await eventually(() => optionOf(board, "region", "EU").isChecked(), "EU selected");
        await Bun.sleep(QUIET_MS);
        expect(await answerOf(board, "region").getAttribute("aria-pressed")).not.toBe("true");
        expect(await barButton(board, "Submit").isDisabled()).toBe(true);
        expect(sentActs(run)).toEqual([]);
        // Corrected, the question can be marked ready, and Submit then sends the answer with the field.
        await board.view.getByLabel("Days", { exact: true }).fill("5");
        await answerOf(board, "region").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => barButton(board, "Submit").isEnabled(), "Submit to be enabled");
        await barButton(board, "Submit").click();
        // `collect` hands each event over once: keep what the polling got.
        const events: { results?: unknown }[] = [];
        await eventually(async () => {
          events.push(...(await run.session.collect()).events);
          return events.length > 0;
        }, "the answer");
        expect(events[0]?.results).toEqual({ days: 5 });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
