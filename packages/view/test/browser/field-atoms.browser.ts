// The TextField and the Toggle in each engine (atoms, task 5.3; view-and-widgets spec: Input atoms
// fill the draft only, The Toggle's unset state, Atoms read-only and in Snapshots, Atom strings):
// typing fills the draft and sends nothing, the cap counts code points, a multiline field keeps its
// line breaks, a Toggle goes unset, on, off and back to unset by Space, click and "Clear", an
// answer returns the values by item ID and the atoms are read-only once the ask closes.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/field-atoms.browser.ts

import { describe, expect, test } from "bun:test";
import { atomAsk, atomDocument } from "./fixtures/atom-documents.ts";
import {
  eventually,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard, sentDrafts } from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const NAME = { type: "text-field", id: "name", props: { label: "Name", maxLength: 3 } };
const NOTES = {
  type: "text-field",
  id: "notes",
  props: { label: "Notes", description: "Anything to add.", multiline: true },
};
const NOTIFY = {
  type: "toggle",
  id: "notify",
  props: { label: "Notify me", description: "One message." },
};
const ITEMS = [NAME, NOTES, NOTIFY];

const holding = (run: WidgetHostRun, itemId: string, expected: unknown, what: string) =>
  eventually(() => draftHolds(run.drafts, "plan", itemId, expected), what);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the TextField`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "labels are visible and name the controls, the description under its label; nothing shows as set and Answer is disabled",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const { view } = run.board;
        expect(await view.getByLabel("Name", { exact: true }).inputValue()).toBe("");
        expect(await view.getByLabel("Notes", { exact: true }).inputValue()).toBe("");
        expect(await view.getByText("Anything to add.").isVisible()).toBe(true);
        expect(await view.getByLabel("Notes").getAttribute("aria-describedby")).toBe(
          "notes:description",
        );
        expect(
          await view.getByRole("switch", { name: "Notify me" }).getAttribute("aria-checked"),
        ).toBe("false");
        expect(await run.board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "typing and leaving the field puts the text in the draft and sends nothing; emptying it removes the result",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const field = run.board.view.getByLabel("Name", { exact: true });
        await field.fill("Ad");
        await field.blur();
        await holding(run, "name", "Ad", "the draft to hold Ad");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        await field.fill("");
        await holding(run, "name", undefined, "the draft to hold no result");
        expect(await run.board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the cap counts code points: three astral characters fit a maxLength of 3, a fourth is cut, never half of one",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const field = run.board.view.getByLabel("Name", { exact: true });
        await field.fill("😀😀😀😀");
        await holding(run, "name", "😀😀😀", "three emoji in the draft");
        expect(await field.inputValue()).toBe("😀😀😀");
        await field.fill("😀a😀b");
        await holding(run, "name", "😀a😀", "the first three code points");
        expect(await field.getAttribute("maxlength")).toBeNull();
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a multiline field keeps its line breaks",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        const field = run.board.view.getByLabel("Notes", { exact: true });
        expect(await field.evaluate((el) => el.tagName)).toBe("TEXTAREA");
        await field.fill("first line\nsecond line");
        await holding(run, "notes", "first line\nsecond line", "the line break in the draft");
        expect(await field.inputValue()).toBe("first line\nsecond line");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a label is text, never markup, and a field has the focus ring and the input border",
      async () => {
        const run = await host(
          dist,
          atomDocument([{ type: "text-field", id: "x", props: { label: "<b>Name</b>" } }]),
        );
        await readyIn(run);
        const { view } = run.board;
        expect(await view.locator('[data-askboard-field="x"] label').textContent()).toBe(
          "<b>Name</b>",
        );
        expect(await view.locator('[data-askboard-field="x"] b').count()).toBe(0);
        const field = view.getByLabel("<b>Name</b>", { exact: true });
        await field.focus();
        const [outline, border, cursor] = await field.evaluate((el) => {
          const style = getComputedStyle(el);
          return [style.outlineStyle, style.borderTopStyle, style.cursor];
        });
        expect([outline, border]).toEqual(["solid", "solid"]);
        // A text input shows the text cursor by default: `auto` in WebKit, `text` in the others.
        expect(["auto", "text"]).toContain(cursor);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Toggle`, () => {
    const { host } = useWidgetHost(engine);
    const state = (run: WidgetHostRun) => run.board.view.locator('[id="notify:state"]');
    const switchOf = (run: WidgetHostRun) =>
      run.board.view.getByRole("switch", { name: "Notify me" });

    test(
      "unset it is drawn off with Not set beside it and holds no result; two presses of Space give Off and false",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        expect(await state(run).textContent()).toBe("Not set");
        expect(await run.board.view.getByRole("button", { name: "Clear" }).count()).toBe(0);
        await switchOf(run).focus();
        await run.board.page.keyboard.press("Space");
        await eventually(
          async () => (await state(run).textContent()) === "On",
          "On after the first press",
        );
        await holding(run, "notify", true, "the draft to hold true");
        await run.board.page.keyboard.press("Space");
        await eventually(
          async () => (await state(run).textContent()) === "Off",
          "Off after the second",
        );
        await holding(run, "notify", false, "the draft to hold false");
        expect(await switchOf(run).getAttribute("aria-checked")).toBe("false");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click sets it on, Clear returns it to unset, removes its result and disables Answer again",
      async () => {
        const run = await host(dist, atomDocument(ITEMS));
        await readyIn(run);
        await switchOf(run).click();
        await eventually(async () => (await state(run).textContent()) === "On", "On");
        await holding(run, "notify", true, "the draft to hold true");
        expect(await switchOf(run).getAttribute("aria-checked")).toBe("true");
        await run.board.view.getByRole("button", { name: "Clear" }).click();
        await eventually(async () => (await state(run).textContent()) === "Not set", "Not set");
        await holding(run, "notify", undefined, "the draft to hold no result");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await switchOf(run).getAttribute("aria-checked")).toBe("false");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "in Italian: Non impostato, Attivo, Disattivo and Cancella",
      async () => {
        const run = await host(dist, atomDocument(ITEMS, "it-IT"));
        await readyIn(run);
        expect(await state(run).textContent()).toBe("Non impostato");
        await switchOf(run).click();
        await eventually(async () => (await state(run).textContent()) === "Attivo", "Attivo");
        await run.board.view.getByRole("button", { name: "Cancella" }).waitFor();
        await switchOf(run).click();
        await eventually(async () => (await state(run).textContent()) === "Disattivo", "Disattivo");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the fields after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "the answer returns the values by item ID, and once the ask closes both atoms are read-only with the answer's values",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([NAME, NOTES, NOTIFY]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("Name", { exact: true }).fill("Ada");
        await board.view.getByLabel("Notes", { exact: true }).fill("one\ntwo");
        await board.view.getByRole("switch", { name: "Notify me" }).click();
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "notify", true),
          "the draft to hold the switch",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ name: "Ada", notes: "one\ntwo", notify: true });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        // Delivered, the question stays open to a revision: the fields show the logged values.
        expect(await board.view.getByLabel("Name", { exact: true }).inputValue()).toBe("Ada");
        expect(await board.view.locator('[id="notify:state"]').textContent()).toBe("On");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          async () =>
            (await board.view.getByLabel("Name", { exact: true }).getAttribute("readonly")) !==
            null,
          "the field to be read-only",
        );
        expect(
          await board.view.getByLabel("Notes", { exact: true }).getAttribute("readonly"),
        ).not.toBeNull();
        expect(await board.view.getByRole("switch", { name: "Notify me" }).isDisabled()).toBe(true);
        expect(await board.view.getByRole("button", { name: "Clear" }).count()).toBe(0);
        const drafts = sentDrafts(run).length;
        await board.view.getByRole("switch", { name: "Notify me" }).click({ force: true });
        await board.view
          .getByLabel("Name", { exact: true })
          .press("x", { noWaitAfter: true })
          .catch(() => undefined);
        await Bun.sleep(QUIET_MS);
        expect(await board.view.getByLabel("Name", { exact: true }).inputValue()).toBe("Ada");
        expect(await board.view.locator('[id="notify:state"]').textContent()).toBe("On");
        expect(sentDrafts(run).length).toBe(drafts);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
