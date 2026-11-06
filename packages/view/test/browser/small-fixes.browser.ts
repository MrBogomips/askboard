// Small fixes from the design review (widget-editing-plus, task 1.10): the Tree's value headers on
// one line (F-22), rows of the Tree and the Gantt on the density tokens (F-23), cells that are not
// edited taking no text selection (F-05), and the option's note line holding its place (F-27). The
// image frame, the excerpt's action and the editor hint are in the context scenarios.

import { describe, expect, test } from "bun:test";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import { ganttOf, rowLines } from "./fixtures/gantt-view.ts";
import { singleAsk } from "./fixtures/lifecycle-asks.ts";
import { wbsPlan } from "./fixtures/wbs-documents.ts";
import {
  eventually,
  LOAD_TIMEOUT_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { lifecycleScenario, openBoard, optionOf } from "./harness/lifecycle-test.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** The UJ-2 question, once its Tree and its plan's Gantt have drawn their rows. */
const opened = async (host: ReturnType<typeof useWidgetHost>["host"]) => {
  const run = await host(dist, uj2ExpandedBoardDocument);
  await treeGridOf(run.board).rows.first().waitFor({ timeout: LOAD_TIMEOUT_MS });
  await ganttOf(run.board, wbsPlan.id).bars.first().waitFor({ timeout: LOAD_TIMEOUT_MS });
  return run;
};

const setComfortable = (board: Board, on: boolean) =>
  board.view
    .locator("html")
    .evaluate((root, value) => root.classList.toggle("comfortable", value), on);

/** The computed `user-select` of an element, the prefixed one where WebKit has only that. */
const selectOf = (cell: ReturnType<ReturnType<typeof treeGridOf>["cell"]>) =>
  cell.evaluate((el) => {
    const style = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string };
    return style.userSelect || style.webkitUserSelect || "";
  });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the small fixes of the design review`, () => {
    const { host } = useWidgetHost(engine);
    const { start } = useEngine(engine);

    test(
      "the Tree's value headers fit on one line and carry the full name as their tip (F-22)",
      async () => {
        const run = await opened(host);
        const tree = treeGridOf(run.board);
        const heights = await tree.headers.evaluateAll((cells) =>
          cells.map((cell) => Math.round(cell.getBoundingClientRect().height)),
        );
        expect(new Set(heights).size).toBe(1);
        expect(heights[0]).toBe(32);
        expect(await tree.headers.nth(4).getAttribute("title")).toBe("Expected effort");
        expect((await tree.headers.nth(4).textContent())?.trim()).toBe("Expected");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the rows of the Tree and of the Gantt are 32px compact and 40px comfortable, the chart following (F-23)",
      async () => {
        const run = await opened(host);
        const tree = treeGridOf(run.board);
        const gantt = ganttOf(run.board, wbsPlan.id);
        const heights = async () => ({
          tree: await tree.rows.evaluateAll((rows) => [
            ...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height))),
          ]),
          gantt: (await rowLines(gantt))?.rows.map(([, height]) => height),
        });
        const compact = await heights();
        expect(compact.tree).toEqual([32]);
        expect(new Set(compact.gantt)).toEqual(new Set([32]));
        await setComfortable(run.board, true);
        await eventually(
          async () => (await heights()).tree.join() === "40",
          "the Tree's rows at the comfortable height",
          STEP_TIMEOUT_MS,
        );
        const comfortable = await heights();
        expect(new Set(comfortable.gantt)).toEqual(new Set([40]));
        // The chart's rows follow the grid's: an axis and a row each as tall as the density says.
        const chart = await gantt.root
          .locator("svg")
          .evaluate((svg) => Math.round(svg.getBoundingClientRect().height));
        expect(chart).toBe(40 * (1 + (comfortable.gantt?.length ?? 0)));
        await setComfortable(run.board, false);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a cell that is not edited takes no text selection, an edited one does (F-05)",
      async () => {
        const run = await opened(host);
        const tree = treeGridOf(run.board);
        expect(await selectOf(tree.cell("ux", 0))).toBe("none");
        expect(await selectOf(tree.cell("ux", 1))).toBe("none");
        const gantt = ganttOf(run.board, wbsPlan.id);
        expect(await selectOf(gantt.cell("ux", "task"))).toBe("none");
        expect(await selectOf(gantt.cell("ux", "duration"))).toBe("none");
        await tree.cell("ux", 1).dblclick();
        await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await selectOf(tree.cell("ux", 1))).not.toBe("none");
        await run.board.page.keyboard.press("Escape");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an option's note line shows on hover and on focus, and the options below stay where they were (F-27)",
      async () => {
        const run = await start(lifecycleScenario(singleAsk, dist));
        const board = await openBoard(run, ["database"]);
        const add = board.view
          .locator('[data-askboard-question="database"]')
          .getByRole("button", { name: "+ Add your note to this option" });
        const tops = async () =>
          Promise.all(
            ["PostgreSQL", "SQLite", "DynamoDB"].map(async (label) =>
              Math.round((await optionOf(board, "database", label).boundingBox())?.y ?? -1),
            ),
          );
        const before = await tops();
        await optionOf(board, "database", "SQLite").hover();
        await add.first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await tops()).toEqual(before);
        await board.page.mouse.move(0, 0);
        await optionOf(board, "database", "DynamoDB").focus();
        await add.first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await tops()).toEqual(before);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
