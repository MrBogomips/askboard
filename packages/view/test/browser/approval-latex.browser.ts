// A LaTeX beside an Approval, in each engine, on the widget host (latex-kanban-timeline, task 5.4;
// spec view-and-widgets: The Approval summary of a whole-field change): editing the expression
// gives the summary one line titled "1 change" naming the LaTeX's widget and its `expression`, the
// agent's expression struck through before the new one, both cut at 80 characters; "Approve" is
// then disabled; an edit back to the agent's expression empties the summary; an Italian board
// words it in Italian. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import { latexApprovalDocument, SENT_EXPRESSION } from "./fixtures/latex-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const source = (board: Board) => board.view.locator("[data-latex-source]");
const title = (board: Board) => board.view.locator("[data-summary-title]");
const lines = (board: Board) => board.view.locator("[data-summary-line]");
const approve = (board: Board, name: string) =>
  board.view.getByRole("radio", { name, exact: true });

const titleText = async (board: Board): Promise<string> =>
  ((await title(board).textContent()) ?? "").trim();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a LaTeX beside an Approval`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "an edited expression is one summary line naming the LaTeX and its expression, the agent's expression struck through before the new one",
      async () => {
        const run = await host(dist, latexApprovalDocument());
        await readyIn(run);
        const { board } = run;
        expect(await titleText(board)).toBe("No changes");
        await source(board).fill(`${SENT_EXPRESSION}=c^2`);
        await eventually(async () => (await titleText(board)) === "1 change", "the title 1 change");
        expect(await lines(board).count()).toBe(1);
        const line = lines(board).first();
        expect(((await line.textContent()) ?? "").startsWith("LaTeX")).toBe(true);
        expect(await line.locator("span").nth(1).textContent()).toBe("LaTeX");
        expect(await line.locator("span").nth(2).textContent()).toBe("expression");
        expect(await line.locator("del").textContent()).toBe(SENT_EXPRESSION);
        expect(await line.locator("ins").textContent()).toBe(`${SENT_EXPRESSION}=c^2`);
        expect(await approve(board, "Approve").isDisabled()).toBe(true);
        expect(await approve(board, "Approve with changes").isEnabled()).toBe(true);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a long expression shows cut at 80 characters with an ellipsis, and an edit back to the agent's expression empties the summary",
      async () => {
        const run = await host(dist, latexApprovalDocument());
        await readyIn(run);
        const { board } = run;
        await source(board).fill("x".repeat(100));
        await eventually(async () => (await titleText(board)) === "1 change", "the title 1 change");
        expect(await lines(board).first().locator("ins").textContent()).toBe(`${"x".repeat(80)}…`);
        await source(board).fill(SENT_EXPRESSION);
        await eventually(async () => (await titleText(board)) === "No changes", "No changes");
        expect(await lines(board).count()).toBe(0);
        expect(await approve(board, "Approve").isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board words the line in Italian: the title, the LaTeX's name and the field",
      async () => {
        const run = await host(dist, latexApprovalDocument("it-IT"));
        await readyIn(run);
        const { board } = run;
        await source(board).fill(`${SENT_EXPRESSION}=c^2`);
        await eventually(async () => (await titleText(board)) === "1 modifica", "1 modifica");
        const line = lines(board).first();
        expect(await line.locator("span").nth(1).textContent()).toBe("LaTeX");
        expect(await line.locator("ins").textContent()).toBe(`${SENT_EXPRESSION}=c^2`);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
