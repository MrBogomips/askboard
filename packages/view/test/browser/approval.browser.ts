// The Approval, in each engine, on the widget host and, for the read-only scenario, on the session
// process (approval-scale-ranking, task 5.1; spec view-and-widgets: Approval decisions, Approving
// a question that holds changes, The Approval summary, A reason the answer requires, Result
// widgets read-only, The three widgets' strings): a decision only selects and a second press
// clears it; the arrow keys move between the decisions as one Tab stop; an edit of the Tree beside
// it disables "Approve" and clears a held one; the summary lists the changes; the open prompt's
// label follows the decision and keeps its text; after an answer the decisions are read-only; an
// Italian board shows the Approval in Italian.

import { describe, expect, test } from "bun:test";
import { approvalAsk, approvalDocument } from "./fixtures/approval-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { enterField, expectSteps, focusPortal, readyIn, typeIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const decision = (board: Board, name: string) =>
  board.view.getByRole("radio", { name, exact: true });
const summary = (board: Board) => board.view.locator("[data-approval-summary]");
const summaryTitle = (board: Board) => board.view.locator("[data-summary-title]");
const prompt = (board: Board, label: string) =>
  board.view.getByRole("textbox", { name: label, exact: true });

const pressed = async (board: Board, name: string): Promise<boolean> =>
  (await decision(board, name).getAttribute("aria-checked")) === "true";

// Renames `portal` with the keyboard alone, from the Tree's first row.
const renamePortal = async (run: WidgetHostRun, name: string): Promise<void> => {
  const tree = treeGridOf(run.board);
  await focusPortal(run, tree);
  await typeIn(run, tree, "Enter", name);
  expect(await pressIn(run.board, "Enter")).toEqual({ nodeId: "portal" });
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Approval`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a decision only selects, shows pressed with a check, and the selected one pressed again clears it, with no error",
      async () => {
        const run = await host(dist, approvalDocument());
        await readyIn(run);
        const { board } = run;
        expect(await board.answer.isDisabled()).toBe(true);
        await decision(board, "Reject").click();
        await eventually(() => pressed(board, "Reject"), "Reject to show pressed");
        expect(await decision(board, "Reject").textContent()).toContain("✓");
        expect(await board.answer.isEnabled()).toBe(true);
        // Selecting sends nothing: the question's `ready` is the one view message.
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        await decision(board, "Reject").click();
        await eventually(async () => !(await pressed(board, "Reject")), "Reject to clear");
        expect(await decision(board, "Reject").textContent()).not.toContain("✓");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await board.view.getByRole("alert").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the decisions are one Tab stop: the right arrow key moves to the next one and Space selects it",
      async () => {
        const run = await host(dist, approvalDocument());
        await readyIn(run);
        const { board } = run;
        await decision(board, "Approve").focus();
        await board.page.keyboard.press("ArrowRight");
        await eventually(
          () => isFocused(decision(board, "Approve with changes")),
          "focus on Approve with changes",
        );
        await board.page.keyboard.press("Space");
        await eventually(() => pressed(board, "Approve with changes"), "the decision to select");
        const stops = await board.view
          .getByRole("group", { name: "Approval" })
          .getByRole("radio")
          .evaluateAll((radios) => radios.filter((radio) => radio.tabIndex === 0).length);
        expect(stops).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an edit of the Tree disables Approve and clears a held one; renaming back enables it again",
      async () => {
        const run = await host(dist, approvalDocument());
        await readyIn(run);
        const { board } = run;
        await decision(board, "Approve").click();
        await eventually(() => pressed(board, "Approve"), "Approve to show pressed");
        expect(await summaryTitle(board).textContent()).toBe("No changes");
        await renamePortal(run, "Customer portal: accounts");
        await eventually(() => decision(board, "Approve").isDisabled(), "Approve to be disabled");
        expect(await pressed(board, "Approve")).toBe(false);
        expect(await decision(board, "Approve with changes").isEnabled()).toBe(true);
        expect(await decision(board, "Reject").isEnabled()).toBe(true);
        expect(await summaryTitle(board).textContent()).toBe("1 change");
        // Nothing is held for the Approval: the answer is the Tree's alone.
        await decision(board, "Approve with changes").click();
        await eventually(() => pressed(board, "Approve with changes"), "the decision to select");
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await typeIn(run, tree, "Enter", "Customer portal");
        await pressIn(board, "Enter");
        await eventually(() => decision(board, "Approve").isEnabled(), "Approve enabled again");
        expect(await summaryTitle(board).textContent()).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the summary lists a renamed node and a changed field, the field's previous value struck through before the new one",
      async () => {
        const run = await host(dist, approvalDocument());
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await enterField(run, tree, "10", { nodeId: "portal", cell: 1 });
        await eventually(
          async () => (await summaryTitle(board).textContent()) === "1 change",
          "the summary to count one change",
        );
        const line = summary(board).locator("[data-summary-line]");
        expect(await line.count()).toBe(1);
        expect(await line.textContent()).toContain("Customer portal");
        expect(await line.locator("del").textContent()).toBe("8");
        expect(await line.locator("ins").textContent()).toBe("10");
        expect(
          await line.locator("del").evaluate((el) => getComputedStyle(el).textDecorationLine),
        ).toContain("line-through");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the open prompt reads Reason for the changes while Approve with changes is selected, and keeps its text when it switches back",
      async () => {
        const run = await host(dist, approvalDocument());
        await readyIn(run);
        const { board } = run;
        await prompt(board, "Note for the agent (optional)").fill("because");
        await decision(board, "Approve with changes").click();
        await prompt(board, "Reason for the changes (required)").waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        // Pressed with no reason: nothing is sent and the field error shows under the prompt.
        await prompt(board, "Reason for the changes (required)").fill("");
        await board.answer.click();
        await board.view
          .getByText("Add the reason for your changes.", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await isFocused(prompt(board, "Reason for the changes (required)"))).toBe(true);
        await prompt(board, "Reason for the changes (required)").fill("because");
        await decision(board, "Reject").click();
        await prompt(board, "Note for the agent (optional)").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await prompt(board, "Note for the agent (optional)").inputValue()).toBe("because");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board shows the Approval in Italian, with Nessuna modifica and a count of one modifica",
      async () => {
        const run = await host(dist, approvalDocument("it-IT"));
        await readyIn(run);
        const { board } = run;
        await board.view.getByText("Approvazione", { exact: true }).first().waitFor();
        for (const name of ["Approva", "Approva con modifiche", "Respingi"]) {
          expect(await decision(board, name).count()).toBe(1);
        }
        expect(await summaryTitle(board).textContent()).toBe("Nessuna modifica");
        await renamePortal(run, "Portale clienti");
        await eventually(
          async () => (await summaryTitle(board).textContent()) === "1 modifica",
          "the summary to count one modifica",
        );
        await decision(board, "Approva con modifiche").click();
        await prompt(board, "Motivo delle modifiche (obbligatorio)").waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Approval after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "the answered Approval shows its decision read-only, with the Tree's summary",
      async () => {
        const run = await start(lifecycleScenario(approvalAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await decision(board, "Reject").click();
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        for (const name of ["Approve", "Approve with changes", "Reject"]) {
          expect(await decision(board, name).isDisabled()).toBe(true);
        }
        expect(await pressed(board, "Reject")).toBe(true);
        expect(await summaryTitle(board).textContent()).toBe("No changes");
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ verdict: { decision: "reject" } });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
