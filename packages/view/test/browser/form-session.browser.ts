// A Form on the real board page and the session process, in each engine (form-widget, task 4.1;
// view-and-widgets spec: Forms end to end, A field check blocks Answer; core spec: Answers of
// PickFields): the intake Form, a question of every field type in two tabs, answered with one
// answer whose `results` hold each field by item ID and no layout key, the remount check (every
// field filled in both tabs, a reload, each field's shown value and state and the draft record
// compared, then the answer sent), a required field and a pattern not met blocking "Answer" across a
// reload, `fetch` of the PickField, and Enter sending nothing.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/form-session.browser.ts

import { describe, expect, test } from "bun:test";
import { FORM_QUESTION, FORM_RESULTS } from "@askboard/contract/fixtures";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const QUESTION = FORM_QUESTION.id;
// The fixture's results with the Budget as the field sends it: the amount to the currency's cents.
const EXPECTED = { ...FORM_RESULTS, "form-budget": { amount: "1200.00", currency: "EUR" } };
const ask = () => ({
  askId: "form-intake-k3m7",
  title: "Intake",
  items: [FORM_QUESTION],
});

const tab = (board: Board, name: string | RegExp) => board.view.getByRole("tab", { name });
// A field by its label, with or without the required mark the label then ends with.
const field = (board: Board, label: string) =>
  board.view.getByLabel(new RegExp(`^${label}( \\(required\\))?$`));
const radio = (board: Board, name: string) => board.view.getByRole("radio", { name, exact: true });
const box = (board: Board, name: string) => board.view.getByRole("checkbox", { name, exact: true });
const errorOf = (board: Board, itemId: string) => board.view.locator(`[id="${itemId}:error"]`);
const holding = (run: Parameters<typeof sentDrafts>[0], itemId: string, value: unknown) =>
  eventually(
    () => draftHolds(sentDrafts(run), QUESTION, itemId, value),
    `the draft to hold ${itemId}`,
  );

// The text that describes "Answer" while a field blocks it (an sr-only element the button names).
const hintOf = async (board: Board): Promise<string | undefined> => {
  const id = await answerOf(board, QUESTION).getAttribute("aria-describedby");
  return id === null
    ? undefined
    : ((await board.view.locator(`[id="${id}"]`).textContent()) ?? undefined);
};

const fillContact = async (board: Board) => {
  await field(board, "Name").fill(FORM_RESULTS["form-name"]);
  await field(board, "Ticket").fill(FORM_RESULTS["form-ticket"]);
  await field(board, "Start date").fill("3/2/2026");
};
const fillPreferences = async (board: Board) => {
  await field(board, "Seats").fill("4");
  await field(board, "Budget").fill("1200.00");
  await radio(board, "Europe").click();
  await box(board, "Email").click();
  await box(board, "Chat").click();
  await board.view.getByRole("switch", { name: "Notify me" }).click();
};

// Each field's shown value and state, tab by tab: what a user would compare before and after a
// reload (the controls' text and checked state, the required and invalid marks, the field error).
const shownState = async (board: Board) => {
  const read = () =>
    board.view.locator("[data-askboard-field]").evaluateAll((fields) =>
      fields.map((element) => ({
        field: element.getAttribute("data-askboard-field"),
        controls: [
          ...element.querySelectorAll(
            'input:not([aria-hidden="true"]), textarea, [role="radio"], [role="checkbox"], [role="switch"]',
          ),
        ].map((control) => ({
          role: control.getAttribute("role") ?? control.tagName.toLowerCase(),
          name: control.getAttribute("aria-label") ?? control.id,
          value: (control as HTMLInputElement).value ?? "",
          checked: control.getAttribute("aria-checked"),
          required: control.getAttribute("aria-required"),
          invalid: control.getAttribute("aria-invalid"),
        })),
        error: element.querySelector('[id$=":error"]')?.textContent ?? null,
      })),
    );
  // Both tabs' panels are in the page, the hidden one not shown: each tab is visited, as a user
  // would, and every field is read from the page.
  await tab(board, /^Preferences/).click();
  await field(board, "Seats").waitFor({ timeout: STEP_TIMEOUT_MS });
  await tab(board, /^Contact/).click();
  await field(board, "Name").waitFor({ timeout: STEP_TIMEOUT_MS });
  return read();
};

const reloaded = (board: Board, run: Parameters<typeof reloadBoard>[1]) =>
  reloadBoard(board, run, () => tab(board, /^Contact/).waitFor({ timeout: STEP_TIMEOUT_MS }));

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Form on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the Form is answered once: collect returns one answer whose results hold each field by item ID and no layout key, and fetch returns the PickField's pick",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, [QUESTION]);
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);
        await fillContact(board);
        await tab(board, /^Preferences/).click();
        await fillPreferences(board);
        await eventually(() => answerOf(board, QUESTION).isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        await answerOf(board, QUESTION).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: QUESTION });
        expect(events[0]?.results).toEqual(EXPECTED);
        for (const layout of ["form-tabs", "form-contact", "form-prefs"]) {
          expect(events[0]?.results).not.toHaveProperty(layout);
        }
        const region = checkedFetchItem(await run.session.fetch("form-region"));
        expect(region).toMatchObject({
          type: "pick-field",
          id: "form-region",
          questionId: QUESTION,
          state: "answered",
          result: "eu",
        });
        const channels = checkedFetchItem(await run.session.fetch("form-channels"));
        expect(channels).toMatchObject({ type: "pick-field", result: ["email", "chat"] });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the remount check: every field filled in both tabs, a reload, each field's shown value and state and the draft record are the same, and the answer then sent holds those values",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, [QUESTION]);
        await fillContact(board);
        await tab(board, /^Preferences/).click();
        await fillPreferences(board);
        for (const [itemId, value] of Object.entries(EXPECTED)) {
          await holding(run, itemId, value);
        }
        const before = await shownState(board);
        // Every field shows what was put in and none an error.
        expect(before.map((shown) => shown.field)).toEqual([
          "form-name",
          "form-ticket",
          "form-start",
          "form-seats",
          "form-budget",
          "form-region",
          "form-channels",
          "form-notify",
        ]);
        const checked = before.flatMap((shown) =>
          shown.controls.filter((control) => control.checked === "true"),
        );
        expect(checked).toHaveLength(4); // Europe, Email, Chat and the switch
        expect(before[0]?.controls[0]?.value).toBe("Ada Lovelace");
        expect(before.every((shown) => shown.error === null)).toBe(true);
        const recordBefore = sentDrafts(run).at(-1)?.questions[QUESTION];
        expect(recordBefore?.results).toEqual(EXPECTED);
        await eventually(() => answerOf(board, QUESTION).isEnabled(), "Answer to be enabled");

        await reloaded(board, run);
        await eventually(
          async () => (await field(board, "Name").inputValue()) === FORM_RESULTS["form-name"],
          "the text restored",
        );
        const after = await shownState(board);
        expect(after).toEqual(before);
        await eventually(() => answerOf(board, QUESTION).isEnabled(), "Answer to be enabled");
        // The draft record the restored page holds: a change and its undoing mirror it again.
        const switchOf = board.view.getByRole("switch", { name: "Notify me" });
        await tab(board, /^Preferences/).click();
        await switchOf.click();
        await holding(run, "form-notify", false);
        await switchOf.click();
        await holding(run, "form-notify", true);
        expect(sentDrafts(run).at(-1)?.questions[QUESTION]).toEqual(recordBefore);
        expect(sentActs(run)).toEqual([]);

        await answerOf(board, QUESTION).click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]?.results).toEqual(EXPECTED);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a required field and a pattern not met block Answer across a reload, each named by Answer's description, and sending waits for the corrections",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, [QUESTION]);
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);
        expect(await hintOf(board)).toBe("Complete Name first.");
        await field(board, "Name").fill("Ada Lovelace");
        await field(board, "Start date").fill("3/2/2026");
        // The first required field left empty is in the other tab.
        await eventually(
          async () => (await hintOf(board)) === "Complete Seats first.",
          "the hint to name Seats",
        );
        await field(board, "Ticket").fill("ab-1234");
        await holding(run, "form-ticket", "ab-1234");
        await eventually(
          async () => (await hintOf(board)) === "Correct Ticket first.",
          "the hint to name the Ticket",
        );
        expect(await errorOf(board, "form-ticket").textContent()).toBe("Not in the expected form.");
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);

        await reloaded(board, run);
        await eventually(
          async () => (await field(board, "Ticket").inputValue()) === "ab-1234",
          "the text restored",
        );
        expect(await errorOf(board, "form-ticket").textContent()).toBe("Not in the expected form.");
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);
        expect(await hintOf(board)).toBe("Correct Ticket first.");

        await field(board, "Ticket").fill("AB-1234");
        await eventually(
          async () => (await hintOf(board)) === "Complete Seats first.",
          "the hint to name Seats again",
        );
        await reloaded(board, run);
        await eventually(
          async () => (await field(board, "Ticket").inputValue()) === "AB-1234",
          "the corrected text restored",
        );
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);
        await tab(board, /^Preferences/).click();
        await field(board, "Seats").fill("4");
        await eventually(
          async () => (await hintOf(board)) === "Complete Region first.",
          "the hint to name Region",
        );
        await radio(board, "Europe").click();
        await eventually(() => answerOf(board, QUESTION).isEnabled(), "Answer to be enabled");
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Enter in a field sends nothing and keeps the draft",
      async () => {
        const run = await start(lifecycleScenario(ask(), dist));
        const board = await openBoard(run, [QUESTION]);
        await fillContact(board);
        await holding(run, "form-start", "2026-03-02");
        for (const label of ["Name", "Ticket", "Start date"]) {
          await field(board, label).focus();
          await board.page.keyboard.press("Enter");
        }
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expect(draftHolds(sentDrafts(run), QUESTION, "form-name", "Ada Lovelace")).toBe(true);
        expect(await field(board, "Name").inputValue()).toBe("Ada Lovelace");
        expect(await answerOf(board, QUESTION).isDisabled()).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
