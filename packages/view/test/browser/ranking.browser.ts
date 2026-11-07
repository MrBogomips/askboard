// The Ranking, in each engine, on the widget host and, for the read-only scenario, on the session
// process (approval-scale-ranking, task 5.3; spec view-and-widgets: Ranking reorder, Ranking at the
// keyboard, Result widgets read-only, The three widgets' strings): an untouched Ranking gives no
// result; "Keep this order" accepts the order as sent; a real mouse drag of a row's handle onto
// either half of another row reorders, Escape cancelling it; a drop from a Tree in the same
// question is refused; "Move up" and "Move down" from the keyboard keep the moved row current, and
// a disabled tool keeps the focus; moved rows are marked and counted; an answered Ranking is
// read-only; an Italian board shows it in Italian. No Content Security Policy violation occurs.

import { describe, expect, test } from "bun:test";
import {
  rankingAsk,
  rankingDocument,
  SENT_ORDER,
  treeAndRankingDocument,
} from "./fixtures/ranking-documents.ts";
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
import {
  beginDrag,
  dragOver,
  expectDrop,
  HALF,
  handleOf,
  orderShown,
  release,
  rowOf,
} from "./harness/ranking-drag.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const counter = (board: Board) => board.view.locator("[data-ranking-counter]");
const tool = (board: Board, name: string) =>
  board.view
    .getByRole("toolbar", { name: /Ranking tools|Strumenti della classifica/ })
    .getByRole("button", { name, exact: true });

const counterText = async (board: Board): Promise<string> =>
  ((await counter(board).textContent()) ?? "").trim();

const expectOrder = (board: Board, order: readonly string[]): Promise<void> =>
  eventually(
    async () => JSON.stringify(await orderShown(board)) === JSON.stringify(order),
    `the order ${order.join(", ")}`,
  );

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Ranking`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "untouched, it shows the agent's order with no result, no mark and Answer disabled",
      async () => {
        const run = await host(dist, rankingDocument());
        await readyIn(run);
        const { board } = run;
        expect(await orderShown(board)).toEqual(SENT_ORDER);
        expect(await board.view.locator("[data-position]").allTextContents()).toEqual([
          "1",
          "2",
          "3",
        ]);
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.browser.violations).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Keep this order accepts the order as it stands: Answer is enabled and no row is marked",
      async () => {
        const run = await host(dist, rankingDocument());
        await readyIn(run);
        const { board } = run;
        await tool(board, "Keep this order").click();
        await eventually(async () => (await counterText(board)) === "Order kept", "Order kept");
        expect(await board.answer.isEnabled()).toBe(true);
        expect(await orderShown(board)).toEqual(SENT_ORDER);
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a drag of the third row onto the top half of the first puts it first, and its bottom half puts it second; the moved rows are marked and counted",
      async () => {
        for (const [half, order, moved] of [
          [HALF.top, ["comfort", "speed", "cost"], "Your changes: 3 moved"],
          [HALF.bottom, ["speed", "comfort", "cost"], "Your changes: 2 moved"],
        ] as const) {
          const run = await host(dist, rankingDocument());
          await readyIn(run);
          const { board } = run;
          await beginDrag(board, handleOf(board, "comfort"));
          await dragOver(board, rowOf(board, "speed"), half);
          await expectDrop(board, "speed", half === HALF.top ? "before" : "after");
          await release(board);
          await expectOrder(board, order);
          expect(await counterText(board)).toBe(moved);
          expect(await board.view.locator('[data-change="moved"]').count()).toBe(
            Number(moved.replace(/\D/g, "")),
          );
          expect(await board.answer.isEnabled()).toBe(true);
          expect(run.browser.violations).toEqual([]);
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape during a drag moves nothing and leaves no result",
      async () => {
        const run = await host(dist, rankingDocument());
        await readyIn(run);
        const { board } = run;
        await beginDrag(board, handleOf(board, "comfort"));
        await dragOver(board, rowOf(board, "speed"), HALF.top);
        await expectDrop(board, "speed", "before");
        await board.page.keyboard.press("Escape");
        await release(board);
        await eventually(
          async () => (await rowOf(board, "comfort").getAttribute("data-dragging")) === null,
          "the drag to end",
        );
        expect(await orderShown(board)).toEqual(SENT_ORDER);
        expect(await counterText(board)).toBe("No changes");
        expect(await board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a row dragged from a Tree in the same question is not taken by the Ranking",
      async () => {
        const run = await host(dist, treeAndRankingDocument);
        await readyIn(run);
        const { board } = run;
        const grip = board.view.locator('[data-node-id="portal"] [data-drag-handle]');
        await beginDrag(board, grip);
        await dragOver(board, rowOf(board, "speed"), HALF.top);
        await Bun.sleep(QUIET_MS / 3);
        expect(await rowOf(board, "speed").getAttribute("data-drop")).toBeNull();
        await release(board);
        expect(await orderShown(board)).toEqual(SENT_ORDER);
        expect(await counterText(board)).toBe("No changes");
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "from the keyboard the arrow keys move the current row, and Move down twice puts the row third, still current, with its tool disabled but focused",
      async () => {
        const run = await host(dist, rankingDocument());
        await readyIn(run);
        const { board } = run;
        const current = (id: string) => rowOf(board, id).getAttribute("aria-current");
        await rowOf(board, "speed").focus();
        await board.page.keyboard.press("ArrowDown");
        await eventually(async () => (await current("cost")) === "true", "cost to be current");
        await board.page.keyboard.press("ArrowUp");
        await eventually(async () => (await current("speed")) === "true", "speed to be current");
        // The list is one Tab stop, and the toolbar another.
        expect(await board.view.locator('[data-ranking-row][tabindex="0"]').count()).toBe(1);
        // Shift+Tab from the list lands on the toolbar's stop, "Move down" ("Move up" is off).
        await board.page.keyboard.press("Shift+Tab");
        await eventually(() => isFocused(tool(board, "Move down")), "focus on Move down");
        await board.page.keyboard.press("Enter");
        await expectOrder(board, ["cost", "speed", "comfort"]);
        await board.page.keyboard.press("Enter");
        await expectOrder(board, ["cost", "comfort", "speed"]);
        expect(await current("speed")).toBe("true");
        expect(await counterText(board)).toBe("Your changes: 3 moved");
        // The last row: "Move down" is disabled and keeps the focus.
        expect(await tool(board, "Move down").getAttribute("aria-disabled")).toBe("true");
        expect(await isFocused(tool(board, "Move down"))).toBe(true);
        await board.page.keyboard.press("Enter");
        await expectOrder(board, ["cost", "comfort", "speed"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an Italian board shows the tools, the counter and the handles in Italian",
      async () => {
        const run = await host(dist, rankingDocument("it-IT"));
        await readyIn(run);
        const { board } = run;
        for (const name of ["Sposta su", "Sposta giù", "Mantieni quest'ordine"]) {
          expect(await tool(board, name).count()).toBe(1);
        }
        expect(await counterText(board)).toBe("Nessuna modifica");
        expect(await handleOf(board, "speed").getAttribute("aria-label")).toBe("Trascina Speed");
        await tool(board, "Mantieni quest'ordine").click();
        await eventually(async () => (await counterText(board)) === "Ordine mantenuto", "kept");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the Ranking after an answer`, () => {
    const { start } = useEngine(engine);

    test(
      "the answered Ranking shows its order read-only, with its moved rows marked, and nothing can move",
      async () => {
        const run = await start(lifecycleScenario(rankingAsk, dist));
        const board = await openBoard(run, ["plan"]);
        await rowOf(board, "comfort").focus();
        await tool(board, "Move up").click({ timeout: STEP_TIMEOUT_MS });
        await expectOrder(board, ["speed", "comfort", "cost"]);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await orderShown(board)).toEqual(["speed", "comfort", "cost"]);
        expect(await board.view.locator('[data-change="moved"]').count()).toBe(2);
        for (const name of ["Move up", "Move down", "Keep this order"]) {
          expect(await tool(board, name).getAttribute("aria-disabled")).toBe("true");
        }
        expect(await board.view.locator("[data-drag-handle]").count()).toBe(0);
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({
          priorities: { order: ["speed", "comfort", "cost"] },
        });
      },
      TEST_TIMEOUT_MS,
    );
  });
}
