// The Table at its bounds on the board, in WebKit and Chromium (table-widget, task 6.4; spec
// view-and-widgets: A Table at its bounds on the board; design decision 13): a fresh page for each
// run of the worst form the bounds admit (200 rows, 10 columns, a number column and nine computed
// from it by formulas of 499 characters, every column totalled) shows the Table, takes one cell
// edit committed and painted, then one row deleted and one added back and painted, each within its gate: the Table
// visible 1,500 ms from the view's creation, an edit painted 100 ms after its Enter, a row added
// 250 ms after its click. The fan-out form (each formula reads `[worst.a]`, the total of the input
// column, so one edit recalculates 1,810 nodes) takes the same edit gate. "Painted" is the second
// animation frame after the change shows in the grid. Each run prints its figures as a line
// `table-bounds <form> <engine> {...}` for the task's note.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/table-bounds.browser.ts

import { describe, expect, test } from "bun:test";
import { TABLE_FORMULA_MAX_CHARS, type TableProps } from "@askboard/contract";
import { tableWorstForm } from "@askboard/contract/fixtures";
import type { Frame } from "playwright";
import { atomDocument } from "./fixtures/atom-documents.ts";
import { eventually, LOAD_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { cellOf, tableGridOf, toolOf } from "./harness/table-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** The gates of design decision 13, in milliseconds. */
const GATES = { visible: 1500, edit: 100, add: 250 } as const;

/** Runs of each form, each in a fresh page. */
const RUNS = 3;

const WORST_ID = "worst";

// The worst form with each formula reading the total of the input column, `[worst.a]`, as long as
// the limit allows: one edit of `a` recalculates every computed cell and total.
const fanOut = (): TableProps => {
  const worst = tableWorstForm();
  const term = `[${WORST_ID}.a]`;
  const count = Math.floor((TABLE_FORMULA_MAX_CHARS + 1) / (term.length + 1));
  const formula = Array.from({ length: count }, () => term).join("+");
  return {
    ...worst,
    columns: worst.columns.map((column) =>
      column.formula === undefined ? column : { ...column, formula },
    ),
  };
};

const documentOf = (props: TableProps) => atomDocument([{ type: "table", id: WORST_ID, props }]);

// Runs in the view's frame: installs the measurement, which resolves (through `window.__painted`)
// with the time of the second animation frame after `done` first holds, from the first `event` of the
// given kind (the Enter key or the click that causes the change), or from the frame's own start when
// none is given. Installed before the event so that nothing is missed.
const INSTALL = `
(({ selector, count, text, event }) => {
  let t0 = event === undefined ? 0 : undefined;
  if (event !== undefined) {
    document.addEventListener(event, () => { t0 ??= performance.now(); }, { capture: true, once: true });
  }
  const done = () => {
    const root = document.querySelector(selector);
    if (root === null) return false;
    if (count !== undefined) return root.querySelectorAll("tbody > tr[data-row-id]").length === count;
    return (root.textContent ?? "").trim() !== text;
  };
  window.__painted = new Promise((resolve) => {
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - (t0 ?? 0))));
    if (done()) return settle();
    const observer = new MutationObserver(() => {
      if (done()) {
        observer.disconnect();
        settle();
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
})
`;

type Figures = { visible: number; edit: number; add: number };

const watch = async (
  frame: Frame,
  args: Record<string, unknown>,
): Promise<() => Promise<number>> => {
  await frame.evaluate(`${INSTALL}(${JSON.stringify(args)})`);
  return () => frame.evaluate("window.__painted") as Promise<number>;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Table at its bounds`, () => {
    const { host } = useWidgetHost(engine);

    const forms: readonly [string, () => TableProps][] = [
      ["worst", tableWorstForm],
      ["fan-out", fanOut],
    ];
    for (const [name, props] of forms) {
      for (let run = 1; run <= RUNS; run += 1) {
        test(
          `the ${name} form, fresh page ${run}: visible, one cell edit painted, one row added painted, each within its gate`,
          async () => {
            const form = props();
            const page = await host(dist, documentOf(form), { colorScheme: "light" });
            await page.board.page.setViewportSize({ width: 1280, height: 900 });
            const table = tableGridOf(page.board, WORST_ID);
            const frame = await page.board.viewFrame();
            const root = `[data-askboard-item="${WORST_ID}"]`;
            const visible = await (
              await watch(frame, { selector: root, count: form.rows.length })
            )();
            await eventually(
              () => page.messages.some((message) => message.type === "ready"),
              "the ready message",
              LOAD_TIMEOUT_MS,
            );
            // One cell edit: the input of row 100 goes to 50, the first total follows.
            const cell = cellOf(table, "r100", "a");
            await cell.click();
            await page.board.page.keyboard.press("Enter");
            const editor = table.frame.getByRole("textbox", { name: "Input, row 100" });
            await editor.waitFor();
            await editor.fill("50");
            const before = (
              (await table.frame.locator('td[data-total="a"]').textContent()) ?? ""
            ).trim();
            const editing = await watch(frame, {
              selector: `${root} td[data-total="a"]`,
              text: before,
              event: "keydown",
            });
            await page.board.page.keyboard.press("Enter");
            const edit = await editing();
            // The worst form holds the most rows a Table may: one is deleted (the current row, r100)
            // so that "Add row" has a place, then one row is added after the current row.
            await toolOf(table, "Delete row").click();
            await eventually(
              async () => (await table.rows.count()) === form.rows.length - 1,
              "the row to be deleted",
              LOAD_TIMEOUT_MS,
            );
            const adding = await watch(frame, {
              selector: root,
              count: form.rows.length,
              event: "click",
            });
            await toolOf(table, "Add row").click();
            const add = await adding();
            const figures: Figures = {
              visible: Math.round(visible),
              edit: Math.round(edit),
              add: Math.round(add),
            };
            process.stdout.write(`table-bounds ${name} ${engine} ${JSON.stringify(figures)}\n`);
            expect(figures.visible).toBeLessThanOrEqual(GATES.visible);
            expect(figures.edit).toBeLessThanOrEqual(GATES.edit);
            expect(figures.add).toBeLessThanOrEqual(GATES.add);
            expect(page.browser.cspProblems()).toEqual([]);
          },
          TEST_TIMEOUT_MS,
        );
      }
    }
  });
}
