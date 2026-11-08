// The Table in each engine, on the widget host (table-widget, tasks 6.1 and 6.2; spec view-and-widgets:
// The Table's grid, Typed cells in the ask's locale, Editing a cell, Cell entries block "Answer",
// Cell entries in the draft, Totals and formula columns on the board, Formula errors on the board,
// Changes shown apart, The Table's answer from the board, Adding and deleting rows, A Table
// read-only, An agent's change to a Table, Agent and user text wraps in a Table): the grid shows
// the roles with their formats, totals and marks; a cell is edited in the ask's locale with its echo
// and an unreadable text stays as an entry that blocks "Answer"; the totals and computed cells
// follow each edit; "Answer" sends the edited value with the derived values; no formula or text is
// ever an element's `style`, and no Content Security Policy violation or request occurs.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/table.browser.ts

import { describe, expect, test } from "bun:test";
import type { ViewDocument } from "../../src/view-document.ts";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { atomDocument } from "./fixtures/atom-documents.ts";
import {
  draftCell,
  draftCellEntries,
  draftTable,
  longWord,
  ROLES,
  rolesWith,
  tableDocument,
  tableItem,
  withFormula,
} from "./fixtures/table-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, isFocused, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  cellOf,
  cellText,
  counterText,
  echoOf,
  editorOf,
  gridStops,
  openEditor,
  tableGridOf,
  toolOf,
  totalText,
  typeInCell,
} from "./harness/table-grid.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const RATE_PM = "Rate, row 1";
const DAYS_DEV = "Days, row 2";

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Table grid`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the Table of roles shows its caption, four headers with Amount marked computed, its rows and a Total row; it is ready once, with no style attribute, CSP report or request",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const table = tableGridOf(run.board);
        expect(((await table.grid.locator("caption").textContent()) ?? "").trim()).toBe("Roles");
        const headers = await table.grid
          .locator("thead th")
          .evaluateAll((all) => all.map((th) => th.textContent?.trim()));
        expect(headers).toEqual(["Role", "Days", "Rate", "AmountComputed[@days] * [@rate]"]);
        expect(await table.grid.locator("thead th [data-computed]").count()).toBe(1);
        expect(await table.rows.count()).toBe(2);
        expect(await cellText(table, "pm", "role")).toBe("Project manager");
        expect(await cellText(table, "pm", "days")).toBe("18");
        expect(await cellText(table, "pm", "rate")).toBe("$1,040.00");
        expect(await cellText(table, "pm", "amount")).toBe("$18,720.00");
        expect(await cellText(table, "dev", "amount")).toBe("$51,840.00");
        expect(await totalText(table, "days")).toBe("90");
        expect(await totalText(table, "amount")).toBe("$70,560.00");
        expect(await table.frame.locator("[data-total-row]").textContent()).toContain("Total");
        expect(await counterText(table)).toBe("No changes");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await table.frame.locator("[style]").count()).toBe(0);
        // Numbers and money read from the right, in the code face.
        const align = await cellOf(table, "pm", "rate").evaluate((el) => {
          const css = getComputedStyle(el);
          return [css.textAlign, css.fontFamily.includes("mono")];
        });
        expect(align[0]).toBe("right");
        await eventually(() => run.messages.length > 0, "the ready message");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.requests).toHaveLength(1);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the grid is one Tab stop, the second Tab leaving it for the toolbar",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const table = tableGridOf(run.board);
        expect(await gridStops(table)).toBe(1);
        await cellOf(table, "pm", "role").focus();
        await run.board.page.keyboard.press("Tab");
        await eventually(
          async () =>
            (await table.tools
              .getByRole("button", { name: "Add row" })
              .evaluate((el) => el === el.ownerDocument.activeElement)) === true,
          "the focus on the toolbar's first tool",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the formula of a computed column is shown as text in the header's description, in no element's style",
      async () => {
        const hostile = "<b>x</b> ;} [@days]";
        const run = await host(dist, tableDocument(withFormula(hostile)));
        await readyIn(run);
        const table = tableGridOf(run.board);
        const header = table.grid.locator("thead th").nth(3);
        expect(await header.getAttribute("title")).toBe(hostile);
        const describedBy = await header.getAttribute("aria-describedby");
        expect(describedBy).not.toBeNull();
        expect(await run.board.view.locator(`[id="${describedBy}"]`).textContent()).toBe(hostile);
        expect(await table.frame.locator("b").count()).toBe(0);
        expect(await table.frame.locator("[style]").count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an it-IT ask shows the roles in Italian formats, and an empty toggle as unset",
      async () => {
        const withToggle = rolesWith({
          columns: [...ROLES.columns, { field: "billable", label: "Fatturabile", type: "toggle" }],
          rows: [
            { ...(ROLES.rows[0] as object), id: "pm", billable: true },
            { ...(ROLES.rows[1] as object), id: "dev" },
          ] as never,
        });
        const run = await host(dist, tableDocument(withToggle, "it-IT"));
        await readyIn(run);
        const table = tableGridOf(run.board);
        expect(await cellText(table, "pm", "rate")).toBe("$ 1.040,00");
        expect(await totalText(table, "days")).toBe("90");
        expect(await totalText(table, "amount")).toBe("$ 70.560,00");
        expect(await cellText(table, "pm", "billable")).toBe("Attivo");
        expect(await cellText(table, "dev", "billable")).toBe("Non impostato");
        expect(await cellOf(table, "dev", "billable").getAttribute("aria-checked")).toBe("mixed");
        expect(await cellOf(table, "pm", "billable").getAttribute("aria-checked")).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: editing a Table cell`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a rate typed in Italian echoes while the editor is open, reads in the cell after Enter and goes in the draft; totals and the amount follow",
      async () => {
        const run = await host(dist, tableDocument(ROLES, "it-IT"));
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        const editor = await openEditor(board, table, "pm", "rate", RATE_PM);
        expect(await editor.inputValue()).toBe("1.040,00");
        await editor.fill("960,00");
        await eventually(
          async () => (await echoOf(table).textContent()) === "= 960,00 USD",
          "the echo",
        );
        await board.page.keyboard.press("Enter");
        await editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await cellText(table, "pm", "rate")).toBe("$ 960,00");
        await eventually(
          () => draftCell(run, "pm", "rate") === "960.00",
          "the draft to hold 960.00",
        );
        expect(await cellText(table, "pm", "amount")).toBe("$ 17.280,00");
        expect(await totalText(table, "amount")).toBe("$ 69.120,00");
        // The cell takes the change highlight, the amount and its total the derived mark, and the
        // counter counts the one change.
        expect(await cellOf(table, "pm", "rate").getAttribute("data-change")).toBe("field");
        expect(await cellOf(table, "pm", "amount").getAttribute("data-derived")).toBe("");
        expect(
          await table.frame.locator('td[data-total="amount"]').getAttribute("data-derived"),
        ).toBe("");
        expect(
          await table.frame.locator('td[data-total="days"]').getAttribute("data-derived"),
        ).toBeNull();
        expect(await counterText(table)).toBe("Le tue modifiche: 1");
        expect(await board.answer.count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape restores the cell and leaves the draft; Enter on a computed cell opens no editor",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        const editor = await openEditor(board, table, "dev", "days", DAYS_DEV);
        await editor.fill("500");
        await board.page.keyboard.press("Escape");
        await editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await cellText(table, "dev", "days")).toBe("72");
        expect(run.drafts).toEqual([]);
        await cellOf(table, "pm", "amount").click();
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.press("F2");
        expect(await table.frame.getByRole("textbox").count()).toBe(0);
        expect(await board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an unreadable number stays in its cell as an entry with the parser's error under its row; the draft keeps the value, Answer is disabled and described, and clearing the entry releases it",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        await typeInCell(board, table, "dev", "days", DAYS_DEV, "1.234,5");
        // Enter keeps the editor open on the entry, with its error.
        const editor = editorOf(table, DAYS_DEV);
        await eventually(
          async () => (await editor.getAttribute("aria-invalid")) === "true",
          "the editor to show its error",
        );
        expect(await table.frame.locator("[data-row-error]").count()).toBe(1);
        // Leaving keeps the text in the cell.
        await cellOf(table, "pm", "role").click();
        await editor.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        expect(await cellText(table, "dev", "days")).toBe("1.234,5");
        expect(await cellOf(table, "dev", "days").getAttribute("data-entry")).toBe("");
        expect(await table.frame.locator("[data-row-error]").count()).toBe(1);
        expect(await table.frame.locator("[data-row-error]").textContent()).toContain("Days:");
        await eventually(
          () => draftCellEntries(run)?.["dev.days"] === "1.234,5",
          "the draft to mirror the entry",
        );
        expect(draftTable(run)).toBeUndefined();
        expect(await totalText(table, "days")).toBe("90");
        expect(await board.answer.isDisabled()).toBe(true);
        const describedBy = await board.answer.getAttribute("aria-describedby");
        expect(await board.view.locator(`[id="${describedBy}"]`).textContent()).toContain(
          "Correct Roles first.",
        );
        // Clearing the entry releases Answer, and the cell is emptied.
        await typeInCell(board, table, "dev", "days", DAYS_DEV, "");
        await eventually(
          async () => (await table.frame.locator("[data-entry]").count()) === 0,
          "the entry to go",
        );
        expect(draftCellEntries(run)).toBeUndefined();
        expect(await cellText(table, "dev", "days")).toBe("");
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a value out of its column's bounds is an entry with the NumberField's error and disables Answer; a text of 501 characters is an entry too",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "days", "Days, row 1", "-1");
        await eventually(
          async () =>
            ((await table.frame.locator("[data-row-error]").textContent()) ?? "").includes(
              "At least 0.",
            ),
          "the bound's error",
        );
        await cellOf(table, "dev", "role").click();
        expect(await cellText(table, "pm", "days")).toBe("-1");
        expect(await board.answer.isDisabled()).toBe(true);
        // Correcting it releases Answer.
        await typeInCell(board, table, "pm", "days", "Days, row 1", "20");
        await eventually(
          async () => (await table.frame.locator("[data-entry]").count()) === 0,
          "the entry to go",
        );
        expect(await board.answer.isEnabled()).toBe(true);
        await typeInCell(board, table, "dev", "role", "Role, row 2", "x".repeat(501));
        await eventually(
          async () => (await table.frame.locator("[data-entry]").count()) === 1,
          "the text entry",
        );
        expect(draftCell(run, "dev", "role")).toBe("Developer");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a formula that reads a field the row lacks shows one problem over the grid naming Amount, every amount cell reads — and Answer stays enabled after an edit",
      async () => {
        const run = await host(dist, tableDocument(withFormula("[@rte]")));
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        const problems = table.frame.locator("[data-table-problems] p");
        expect(await problems.count()).toBe(1);
        expect(await problems.textContent()).toContain("Amount");
        expect(await cellText(table, "pm", "amount")).toBe("—");
        expect(await cellText(table, "dev", "amount")).toBe("—");
        expect(await totalText(table, "amount")).toContain("—");
        expect(await table.frame.locator("[data-row-error]").count()).toBe(0);
        await typeInCell(board, table, "pm", "days", "Days, row 1", "19");
        await eventually(() => draftCell(run, "pm", "days") === 19, "the draft");
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a division by zero in one row shows under that row naming the column, the other row keeps its value",
      async () => {
        const perDay = rolesWith({
          columns: [
            ...ROLES.columns,
            {
              field: "perDay",
              label: "Per day",
              type: "number",
              formula: "[@amount] / [@days]",
            },
          ],
        });
        const run = await host(dist, tableDocument(perDay));
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        expect(await cellText(table, "pm", "perDay")).toBe("1,040");
        await typeInCell(board, table, "dev", "days", DAYS_DEV, "0");
        await eventually(
          async () => (await table.frame.locator("[data-row-error]").count()) === 1,
          "the row error",
        );
        expect(await table.frame.locator("[data-row-error]").textContent()).toContain("Per day");
        expect(await cellText(table, "dev", "perDay")).toBe("—");
        expect(await cellText(table, "pm", "perDay")).toBe("1,040");
        expect(await board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Answer sends the edited rows and the derived values of the totals and the moved cells, and the Table turns read-only",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", RATE_PM, "960.00");
        await eventually(() => draftCell(run, "pm", "rate") === "960.00", "the draft");
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.some((m) => m.type === "answer"), "the answer message");
        const answer = run.messages.find((m) => m.type === "answer") as unknown as {
          values: { costs: { rows: { id: string; rate?: string }[] } };
          derived: Record<string, unknown>;
        };
        expect(answer.values.costs.rows.map((row) => [row.id, row.rate])).toEqual([
          ["pm", "960.00"],
          ["dev", "720.00"],
        ]);
        expect(answer.derived).toEqual({
          "costs.days": 90,
          "costs.amount": "69120.00",
          "costs.pm.amount": "17280.00",
        });
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Table's rows, read-only state, agent changes and long words`, () => {
    const { host } = useWidgetHost(engine);

    const rowIds = (table: ReturnType<typeof tableGridOf>) =>
      table.rows.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-row-id")));

    test(
      "Add row adds an empty row after the current row and makes its first input cell current; the row is filled, counted once and in the draft; Delete row removes the current row and the next becomes current",
      async () => {
        const run = await host(dist, tableDocument());
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        // No row is current at open: Delete row waits.
        expect(await toolOf(table, "Delete row").getAttribute("aria-disabled")).toBe("true");
        await cellOf(table, "pm", "role").click();
        await toolOf(table, "Add row").click();
        await eventually(
          async () => (await rowIds(table)).join() === "pm,u-1,dev",
          "the new row after pm",
        );
        expect(await cellOf(table, "u-1", "role").getAttribute("tabindex")).toBe("0");
        expect(await table.frame.getByRole("textbox").count()).toBe(0);
        expect(await table.frame.locator('tr[data-row-id="u-1"]').getAttribute("data-change")).toBe(
          "added",
        );
        await typeInCell(board, table, "u-1", "role", "Role, row 2", "QA engineer");
        await eventually(
          () => draftCell(run, "u-1", "role") === "QA engineer",
          "the draft to hold the role",
        );
        expect(draftTable(run)?.rows.map((row) => row.id)).toEqual(["pm", "u-1", "dev"]);
        expect(await counterText(table)).toBe("Your changes: 1");
        // Delete the row `dev`: it leaves, the totals drop, and the row before it becomes current.
        await cellOf(table, "dev", "role").click();
        await toolOf(table, "Delete row").click();
        await eventually(async () => (await rowIds(table)).join() === "pm,u-1", "dev to leave");
        expect(await totalText(table, "days")).toBe("18");
        expect(await totalText(table, "amount")).toBe("$18,720.00");
        expect(
          await table.frame.locator('tr[aria-current="true"]').getAttribute("data-row-id"),
        ).toBe("u-1");
        expect(await counterText(table)).toBe("Your changes: 2");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Table with fixed rows has neither tool; at 200 rows Add row refuses beside the toolbar and in the live region",
      async () => {
        const fixed = await host(dist, tableDocument(rolesWith({ fixedRows: true })));
        await readyIn(fixed);
        const fixedTable = tableGridOf(fixed.board);
        expect(await fixedTable.frame.getByRole("button", { name: /row$/ }).count()).toBe(0);
        const rows = Array.from({ length: 200 }, (_, at) => ({ id: `r${at}`, role: `Role ${at}` }));
        const run = await host(
          dist,
          tableDocument({
            label: "Many",
            columns: [{ field: "role", label: "Role", type: "text" }],
            rows,
          }),
        );
        await readyIn(run);
        const table = tableGridOf(run.board);
        await cellOf(table, "r0", "role").click();
        await toolOf(table, "Add row").click();
        await eventually(
          async () =>
            ((await table.frame.locator("[data-refusal]").textContent()) ?? "").includes(
              "at most 200",
            ),
          "the refusal beside the toolbar",
        );
        expect(await table.frame.locator("[role=status]").textContent()).toContain("at most 200");
        expect(await table.rows.count()).toBe(200);
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a locked Table stays readable and navigable: no editor, no toggle, no tools, its marks kept",
      async () => {
        const toggled = rolesWith({
          columns: [...ROLES.columns, { field: "billable", label: "Billable", type: "toggle" }],
        });
        const document = tableDocument(toggled);
        const run = await host(dist, document);
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", RATE_PM, "960.00");
        await eventually(() => draftCell(run, "pm", "rate") === "960.00", "the draft");
        await run.update({
          type: "state",
          state: openStateOf(document),
          lock: "moved",
        } as ViewUpdate);
        await eventually(async () => (await table.tools.count()) === 0, "the tools to go");
        await cellOf(table, "pm", "rate").click();
        await board.page.keyboard.press("Enter");
        await board.page.keyboard.press("F2");
        await cellOf(table, "pm", "billable").click();
        await board.page.keyboard.press("Space");
        expect(await table.frame.getByRole("textbox").count()).toBe(0);
        expect(await cellOf(table, "pm", "billable").getAttribute("aria-checked")).toBe("mixed");
        expect(await cellText(table, "pm", "rate")).toBe("$960.00");
        expect(await cellOf(table, "pm", "rate").getAttribute("data-change")).toBe("field");
        await board.page.keyboard.press("ArrowDown");
        await eventually(
          () => isFocused(cellOf(table, "dev", "billable")),
          "the focus to move down",
        );
        expect(await counterText(table)).toBe("Your changes: 1");
      },
      TEST_TIMEOUT_MS,
    );

    // The agent revises the question: a document at revision 2 and the board state naming it.
    const revise = (document: ViewDocument, props: unknown): ViewUpdate => {
      const revised = {
        ...document,
        items: [{ ...plan, rev: 2, props: { ...plan.props, items: [tableItem(props as never)] } }],
      } as unknown as ViewDocument;
      return { type: "state", state: openStateOf(revised), document: revised };
    };

    test(
      "after the agent changes only rows, Keep mine keeps the user's edit; after it drops a column, Keep mine drops the draft with its cell entries and the Table shows the agent's revision; Reload drops both",
      async () => {
        const document = tableDocument();
        const run = await host(dist, document);
        await readyIn(run);
        const { board } = run;
        const table = tableGridOf(board);
        await typeInCell(board, table, "pm", "rate", RATE_PM, "960.00");
        await typeInCell(board, table, "dev", "days", DAYS_DEV, "oops");
        await cellOf(table, "pm", "role").click();
        await eventually(() => draftCellEntries(run)?.["dev.days"] === "oops", "the entry");
        // The agent changes a row's role only.
        const rows = ROLES.rows.map((row) =>
          row.id === "dev" ? { ...row, role: "Engineer" } : row,
        );
        await run.update(revise(document, rolesWith({ rows })));
        const notice = board.view.locator('[data-askboard-notice="agent-change"]');
        await notice.waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice.getByRole("button", { name: "Keep mine" }).click();
        await eventually(async () => (await notice.count()) === 0, "the notice to settle");
        expect(await cellText(table, "pm", "rate")).toBe("$960.00");
        expect(await cellText(table, "dev", "days")).toBe("oops");
        // The agent drops the rate column: the draft and its entries go.
        const lessRate = rolesWith({
          columns: ROLES.columns.filter(
            (column) => column.field !== "rate" && column.field !== "amount",
          ),
        });
        await run.update(revise(document, lessRate));
        await notice.waitFor({ timeout: STEP_TIMEOUT_MS });
        await notice.getByRole("button", { name: "Keep mine" }).click();
        await eventually(
          async () => (await table.frame.locator("[data-entry]").count()) === 0,
          "the entries to go",
        );
        expect(await table.grid.locator("thead th").count()).toBe(2);
        expect(await counterText(table)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Table inside a Group is edited, and a caption, a header and a text cell of 200 characters wrap inside the frame at 1,280 pixels without a horizontal scroll",
      async () => {
        const word = longWord(200);
        const props = {
          label: word,
          columns: [
            { field: "role", label: word, type: "text" },
            { field: "days", label: "Days", type: "number" },
          ],
          rows: [{ id: "a", role: word, days: 1 }],
        } as never;
        const group = {
          type: "group",
          id: "box",
          props: { title: "Box", items: [tableItem(props)] },
        };
        const run = await host(dist, atomDocument([group]));
        await readyIn(run);
        const { board } = run;
        await board.page.setViewportSize({ width: 1280, height: 800 });
        const table = tableGridOf(board);
        await typeInCell(board, table, "a", "days", "Days, row 1", "5");
        await eventually(() => draftCell(run, "a", "days") === 5, "the nested Table's draft");
        const fits = await table.frame.evaluate((frame) => {
          const box = frame.getBoundingClientRect();
          const wide = [...frame.querySelectorAll("caption, th, td")].filter(
            (element) => element.getBoundingClientRect().right > box.right + 1,
          );
          const page = frame.ownerDocument.documentElement;
          return { wide: wide.length, scrolls: page.scrollWidth > page.clientWidth };
        });
        expect(fits).toEqual({ wide: 0, scrolls: false });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
