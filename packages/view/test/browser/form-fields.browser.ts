// The input atoms' required mark and field checks in each engine (form-widget, task 3.2;
// view-and-widgets spec: Required fields, A TextField's checks as the user types, A field check
// blocks Answer, Answer names the field to fix, A tab holding a field that fails a check, Form
// strings): a text outside `minLength` or `pattern` shows its field error as typed and keeps the
// text in the draft, an empty required field shows no error and still blocks "Answer", Enter sends
// nothing from any field, a hidden tab holding a failing field carries the mark and an empty
// required field none, an Italian board reads Italian, and on the session process a reload restores
// the text with its error. At DESIGN's 1,280-pixel floor, each act through the keyboard.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/form-fields.browser.ts

import { describe, expect, test } from "bun:test";
import type { FrameLocator, Locator } from "playwright";
import { atomAsk, atomDocument } from "./fixtures/atom-documents.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const KEY = "^[A-Z]{2}-\\d{4}$";
const ticket = (extra: Record<string, unknown> = {}) => ({
  type: "text-field",
  id: "ticket",
  props: { label: "Ticket", pattern: KEY, ...extra },
});
const notify = { type: "toggle", id: "notify", props: { label: "Notify me" } };
const panel = (id: string, title: string, ...items: unknown[]) => ({ id, title, items });

const answerOfRun = (run: WidgetHostRun) => run.board.answer;
const errorOf = (view: FrameLocator, itemId: string) => view.locator(`[id="${itemId}:error"]`);
// The text that describes "Answer" while a field blocks it (an sr-only element the button names).
const hintOf = async (
  run: WidgetHostRun,
  button: Locator = answerOfRun(run),
): Promise<string | undefined> => {
  const id = await button.getAttribute("aria-describedby");
  return id === null
    ? undefined
    : ((await run.board.view.locator(`[id="${id}"]`).textContent()) ?? undefined);
};
const typeSlowly = async (run: WidgetHostRun, field: Locator, text: string) => {
  await field.focus();
  await run.board.page.keyboard.type(text);
};
const holding = (run: WidgetHostRun, itemId: string, expected: unknown, what: string) =>
  eventually(() => draftHolds(run.drafts, "plan", itemId, expected), what);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a TextField's checks as the user types`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a text shorter than minLength shows its field error under the input, keeps the text in the draft, and clears at the length",
      async () => {
        const code = { type: "text-field", id: "code", props: { label: "Code", minLength: 3 } };
        const run = await host(dist, atomDocument([code, notify]));
        await readyIn(run);
        const { view } = run.board;
        const field = view.getByLabel("Code", { exact: true });
        await typeSlowly(run, field, "ab");
        await holding(run, "code", "ab", "the draft to hold ab");
        expect(await errorOf(view, "code").textContent()).toBe("At least 3 characters.");
        expect(await field.getAttribute("aria-invalid")).toBe("true");
        expect(await field.getAttribute("aria-describedby")).toContain("code:error");
        expect(await answerOfRun(run).isDisabled()).toBe(true);
        await run.board.page.keyboard.type("c");
        await holding(run, "code", "abc", "the draft to hold abc");
        expect(await errorOf(view, "code").count()).toBe(0);
        expect(await field.getAttribute("aria-invalid")).toBeNull();
        expect(await answerOfRun(run).isEnabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a pattern not met: the error shows, Answer is disabled and described by the field, and the corrected text enables it; emptying clears both",
      async () => {
        const run = await host(
          dist,
          atomDocument([ticket({ description: "Two capitals, a dash, four digits." }), notify]),
        );
        await readyIn(run);
        const { view } = run.board;
        const field = view.getByLabel("Ticket", { exact: true });
        await typeSlowly(run, field, "ab-1234");
        await holding(run, "ticket", "ab-1234", "the draft to hold ab-1234");
        expect(await errorOf(view, "ticket").textContent()).toBe("Not in the expected form.");
        expect(await field.getAttribute("aria-describedby")).toBe(
          "ticket:description ticket:error",
        );
        expect(await answerOfRun(run).isDisabled()).toBe(true);
        expect(await hintOf(run)).toBe("Correct Ticket first.");
        await field.fill("AB-1234");
        await holding(run, "ticket", "AB-1234", "the draft to hold AB-1234");
        expect(await errorOf(view, "ticket").count()).toBe(0);
        expect(await answerOfRun(run).isEnabled()).toBe(true);
        expect(await answerOfRun(run).getAttribute("aria-describedby")).toBeNull();
        await field.fill("");
        await holding(run, "ticket", undefined, "the draft to hold no result");
        expect(await errorOf(view, "ticket").count()).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a field with a pattern holds at most 100 characters: the input keeps the first 100",
      async () => {
        const run = await host(dist, atomDocument([ticket({ pattern: "^[A-Z]+$" })]));
        await readyIn(run);
        const field = run.board.view.getByLabel("Ticket", { exact: true });
        await field.fill("A".repeat(120));
        await holding(run, "ticket", "A".repeat(100), "the first 100 characters in the draft");
        expect((await field.inputValue()).length).toBe(100);
        expect(await errorOf(run.board.view, "ticket").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Enter in a TextField, a NumberField and a DateField sends nothing and keeps the text",
      async () => {
        const items = [
          ticket(),
          { type: "number-field", id: "days", props: { label: "Days" } },
          { type: "date-field", id: "due", props: { label: "Due" } },
        ];
        const run = await host(dist, atomDocument(items));
        await readyIn(run);
        const { view, page } = run.board;
        for (const [label, text] of [
          ["Ticket", "ab-1234"],
          ["Days", "12"],
          ["Due", "2026-12-09"],
        ] as const) {
          const field = view.getByLabel(label, { exact: true });
          await typeSlowly(run, field, text);
          await page.keyboard.press("Enter");
          await Bun.sleep(QUIET_MS);
          expect(await field.inputValue()).toBe(text);
        }
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a required field`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "its label ends with (required), its control is marked required, no field error shows, and Answer stays disabled and described by it",
      async () => {
        const run = await host(dist, atomDocument([ticket({ required: true }), notify]));
        await readyIn(run);
        const { view, page } = run.board;
        const label = view.locator('[data-askboard-field="ticket"] label');
        expect((await label.textContent())?.replace(/\s+/g, " ")).toBe("Ticket (required)");
        const field = view.getByLabel("Ticket (required)", { exact: true });
        expect(await field.getAttribute("aria-required")).toBe("true");
        expect(await errorOf(view, "ticket").count()).toBe(0);
        await view.getByRole("switch", { name: "Notify me" }).focus();
        await page.keyboard.press("Space");
        await holding(run, "notify", true, "the draft to hold the switch");
        expect(await answerOfRun(run).isDisabled()).toBe(true);
        expect(await hintOf(run)).toBe("Complete Ticket first.");
        await typeSlowly(run, field, "AB-1234");
        await eventually(() => answerOfRun(run).isEnabled(), "Answer to be enabled");
        expect(await errorOf(view, "ticket").count()).toBe(0);
        await field.fill("");
        await eventually(() => answerOfRun(run).isDisabled(), "Answer to be disabled again");
        expect(await errorOf(view, "ticket").count()).toBe(0);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a required DateField and Toggle are marked too",
      async () => {
        const items = [
          { type: "date-field", id: "start", props: { label: "Start", required: true } },
          { type: "toggle", id: "agree", props: { label: "Agree", required: true } },
        ];
        const run = await host(dist, atomDocument(items));
        await readyIn(run);
        const { view } = run.board;
        const start = view.getByLabel("Start (required)", { exact: true });
        expect(await start.getAttribute("aria-required")).toBe("true");
        expect(
          (await view.locator('[data-askboard-field="start"] label').textContent())?.replace(
            /\s+/g,
            " ",
          ),
        ).toBe("Start (required)");
        expect(await errorOf(view, "start").count()).toBe(0);
        expect(
          await view.getByRole("switch", { name: /Agree/ }).getAttribute("aria-required"),
        ).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an agent's 200-character label and description with the mark stay inside the card at 1,280 pixels",
      async () => {
        const long = "x".repeat(200);
        const run = await host(
          dist,
          atomDocument([ticket({ required: true, label: long, description: long })]),
        );
        await readyIn(run);
        const box = await run.board.view
          .locator('[data-askboard-field="ticket"]')
          .evaluate((element) => ({
            scroll: element.scrollWidth,
            client: element.clientWidth,
            parent: element.parentElement?.clientWidth ?? 0,
          }));
        expect(box.scroll).toBeLessThanOrEqual(box.client);
        expect(box.client).toBeLessThanOrEqual(box.parent);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a tab holding a field that fails a check`, () => {
    const { host } = useWidgetHost(engine);
    const tabs = (...panels: unknown[]) => ({
      type: "tabs",
      id: "sections",
      props: { tabs: panels },
    });
    const tab = (view: FrameLocator, name: string | RegExp) => view.getByRole("tab", { name });

    test(
      "a pattern not met in a hidden tab marks it, an empty required field in another marks none, and fixing the text clears the mark",
      async () => {
        const arranged = tabs(
          panel("first", "First", {
            type: "text-field",
            id: "who",
            props: { label: "Who", required: true },
          }),
          panel("second", "Second", ticket()),
        );
        const run = await host(dist, atomDocument([arranged]));
        await readyIn(run);
        const { view } = run.board;
        expect(await tab(view, /needs a correction/).count()).toBe(0);
        await tab(view, "Second").click();
        await typeSlowly(run, view.getByLabel("Ticket", { exact: true }), "ab-1234");
        await holding(run, "ticket", "ab-1234", "the draft to hold ab-1234");
        await tab(view, "First").click();
        await eventually(
          async () => (await tab(view, "Second needs a correction").count()) === 1,
          "the second tab marked",
        );
        // The empty required field of the first tab adds no mark to it.
        expect(await tab(view, "First needs a correction").count()).toBe(0);
        await tab(view, "Second needs a correction").click();
        await view.getByLabel("Ticket", { exact: true }).fill("AB-1234");
        await eventually(
          async () => (await tab(view, "Second needs a correction").count()) === 0,
          "the mark cleared",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: an Italian board`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the mark, the field error and Answer's description are Italian",
      async () => {
        const run = await host(dist, atomDocument([ticket({ required: true }), notify], "it-IT"));
        await readyIn(run);
        const { view } = run.board;
        const rispondi = view.getByRole("button", { name: "Rispondi", exact: true });
        expect(
          (await view.locator('[data-askboard-field="ticket"] label').textContent())?.replace(
            /\s+/g,
            " ",
          ),
        ).toBe("Ticket (obbligatorio)");
        await view.getByRole("switch", { name: "Notify me" }).click();
        await holding(run, "notify", true, "the draft to hold the switch");
        expect(await hintOf(run, rispondi)).toBe("Completa prima Ticket.");
        await view.getByLabel("Ticket (obbligatorio)", { exact: true }).fill("ab-1234");
        await eventually(
          async () => (await errorOf(view, "ticket").textContent()) === "Non è nella forma attesa.",
          "the Italian field error",
        );
        expect(await hintOf(run, rispondi)).toBe("Correggi prima Ticket.");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a pattern not met is restored after a reload with its error, Answer stays disabled, and the corrected text is answered",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([ticket(), notify]), dist));
        const board = await openBoard(run, ["plan"]);
        const field = board.view.getByLabel("Ticket", { exact: true });
        await field.focus();
        await board.page.keyboard.type("ab-1234");
        await eventually(
          () => sentDrafts(run).some((record) => draftHolds([record], "plan", "ticket", "ab-1234")),
          "the text mirrored to the board page",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await reloadBoard(board, run, () =>
          board.view.getByLabel("Ticket", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS }),
        );
        const restored = board.view.getByLabel("Ticket", { exact: true });
        await eventually(
          async () => (await restored.inputValue()) === "ab-1234",
          "the text restored",
        );
        expect(await board.view.locator('[id="ticket:error"]').textContent()).toBe(
          "Not in the expected form.",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await restored.fill("AB-1234");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ ticket: "AB-1234" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
