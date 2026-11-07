// The hover and focus audit of the board's controls, in each engine, on the widget host
// (widget-editing-plus task 7.1; spec, "Hover and focus feedback", "Hover cursors and looks" and
// "No hover feedback where nothing responds"), on the controls this change added and the ones the
// shared layer of task 1.1 could miss: a button, an editable cell, a disabled control, the drag
// handle, the column edge and a Gantt bar, in the light and the dark scheme, and the read-only
// widgets; and, since approval-scale-ranking (task 6.7), the controls of the Approval, the Scale
// and the Ranking. `hover-layer.browser.ts` holds the first layer's own scenarios.

import { describe, expect, test } from "bun:test";
import { ganttPlanBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewDocument } from "../../src/view-document.ts";
import type { ViewUpdate } from "../../src/view-protocol.ts";
import { approvalDocument } from "./fixtures/approval-documents.ts";
import { chooseWeek, planGantt } from "./fixtures/gantt-plan.ts";
import { ganttOf } from "./fixtures/gantt-view.ts";
import { rankingDocument } from "./fixtures/ranking-documents.ts";
import { scaleDocument } from "./fixtures/scale-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import { eventually, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { tokenColor } from "./harness/design-colors.ts";
import { enginesFrom } from "./harness/engines.ts";
import { tabIntoGroup } from "./harness/tab-stops.ts";
import { handleOf } from "./harness/tree-drag.ts";
import { enabledTools, pressIn, treeGridOf } from "./harness/tree-grid.ts";
import { focusPortal, readyIn, typeIn } from "./harness/tree-steps.ts";
import { openStateOf, readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();
const ADJUST = "Adjust by %…";

/** The computed cursor and hover look of an element. */
const lookOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      cursor: style.cursor,
      background: style.backgroundColor,
      border: style.borderTopColor,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });

const hovered = async (locator: Locator) => {
  await locator.hover();
  return lookOf(locator);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme: a disabled "Adjust by %…" shows not-allowed and no change, an enabled one the pointer and the hover pair, the drag handle grab, the column edge col-resize with the strong outline, and a bar grab`,
        async () => {
          const run = await host(dist, ganttPlanBoardDocument, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const tree = treeGridOf(board);
          const gantt = ganttOf(board, planGantt.id);
          await chooseWeek(gantt);
          // A disabled control: nothing selected, so the adjustment is not offered.
          const resting = await lookOf(tree.tool(ADJUST));
          const disabled = await hovered(tree.tool(ADJUST));
          expect(disabled.cursor).toBe("not-allowed");
          expect(disabled.background).toBe(resting.background);
          expect(disabled.border).toBe(resting.border);
          // The same button, enabled by a selection: the pointer, the strong border, the card fill.
          await tree.row("portal").locator("[data-select]").click();
          const button = await hovered(tree.tool(ADJUST));
          expect(button.cursor).toBe("pointer");
          expect(button.border).toBe(tokenColor("border-strong", scheme));
          expect(button.background).toBe(tokenColor("card", scheme));
          // The drag handle shows on the row's hover, with the grab cursor.
          await tree.row("billing").hover();
          expect((await lookOf(handleOf(tree, "billing"))).cursor).toBe("grab");
          // The column edge: the resize cursor and the hover outline; the focus ring is not its hover.
          const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
          const edgeLook = await hovered(edge);
          expect(edgeLook.cursor).toBe("col-resize");
          expect(edgeLook.outline).toBe(`1px solid ${tokenColor("border-strong", scheme)}`);
          // A bar of a plan takes the grab cursor, and its end the horizontal resize one.
          expect((await hovered(gantt.bar("portal"))).cursor).toBe("grab");
          const grip = gantt.root.locator('[data-gantt-handle="portal"]');
          expect((await hovered(grip)).cursor).toBe("ew-resize");
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a read-only plan and Tree show no handle, no grab on a bar, no text cursor on a cell and no hover change on a tool; the column edge still resizes",
      async () => {
        const run = await host(dist, ganttPlanBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const gantt = ganttOf(board, planGantt.id);
        await chooseWeek(gantt);
        const update: ViewUpdate = { type: "state", state: openStateOf(ganttPlanBoardDocument) };
        await run.update({ ...update, lock: "moved" });
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "every tool disabled",
        );
        expect(await tree.grid.locator("[data-drag-handle]").count()).toBe(0);
        expect(await gantt.root.locator("[data-gantt-handle]").count()).toBe(0);
        expect((await hovered(gantt.bar("portal"))).cursor).not.toBe("grab");
        const cell = await hovered(tree.cell("portal", 1));
        expect(cell.cursor).not.toBe("text");
        expect(cell.outline).not.toContain("1px solid");
        const tool = await hovered(tree.tool("Move down"));
        expect(tool.cursor).toBe("not-allowed");
        const edge = gantt.root.getByRole("separator", { name: "Resize the Task column" });
        expect((await hovered(edge)).cursor).toBe("col-resize");
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// A control that responds: the pointer cursor, `border-strong` and the `card` fill while hovered,
// and no focus ring from hover alone. Returns nothing; the look is the layer's, not the widget's.
const expectResponds = async (control: Locator, scheme: "light" | "dark") => {
  const look = await hovered(control);
  expect(look.cursor).toBe("pointer");
  expect(look.border).toBe(tokenColor("border-strong", scheme));
  expect(look.background).toBe(tokenColor("card", scheme));
  expect(look.outline).not.toContain("2px solid");
};

// A control that does not respond: not-allowed, and no change of look under the pointer.
const expectInert = async (run: WidgetHostRun, control: Locator, cursor = true) => {
  await run.board.page.mouse.move(0, 0);
  const resting = await lookOf(control);
  const look = await hovered(control);
  if (cursor) expect(look.cursor).toBe("not-allowed");
  expect(look.background).toBe(resting.background);
  expect(look.border).toBe(resting.border);
  expect(look.outline).toBe(resting.outline);
};

// The control holds the keyboard focus and shows the ring, which hover alone never gives.
const expectRing = async (control: Locator) => {
  expect(await control.evaluate((el) => el === el.ownerDocument.activeElement)).toBe(true);
  expect((await lookOf(control)).outline).toContain("2px solid");
};

// The widget host's state for the document with the lock the board page sends (`moved`).
const lock = (run: WidgetHostRun, document: ViewDocument) =>
  run.update({ type: "state", state: openStateOf(document), lock: "moved" } as ViewUpdate);

const decisionIn = (run: WidgetHostRun, name: string) =>
  run.board.view.getByRole("radio", { name, exact: true });

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the hover and focus audit of the Approval, the Scale and the Ranking`, () => {
    const { host } = useWidgetHost(engine);

    for (const scheme of ["light", "dark"] as const) {
      test(
        `in the ${scheme} scheme, the Approval's decisions respond, a disabled one and a locked board's do not, and the keyboard focus shows the ring`,
        async () => {
          const document = approvalDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          // An edit beside the Approval disables "Approve", whose hover changes nothing.
          const tree = treeGridOf(board);
          await focusPortal(run, tree);
          await typeIn(run, tree, "Enter", "Customer portal: accounts");
          await pressIn(board, "Enter");
          await eventually(() => decisionIn(run, "Approve").isDisabled(), "Approve to be disabled");
          await expectInert(run, decisionIn(run, "Approve"));
          await board.page.mouse.move(0, 0);
          await expectResponds(decisionIn(run, "Approve with changes"), scheme);
          await expectResponds(decisionIn(run, "Reject"), scheme);
          // Tab into the group: the first enabled decision takes the ring.
          await board.page.mouse.move(0, 0);
          const group = board.view.locator("[data-approval]").getByRole("radiogroup");
          await tabIntoGroup(board, plan.props.text, group);
          await expectRing(decisionIn(run, "Approve with changes"));
          // A locked board: every decision disabled, none responding.
          await lock(run, document);
          for (const name of ["Approve", "Approve with changes", "Reject"]) {
            await eventually(() => decisionIn(run, name).isDisabled(), `${name} to be disabled`);
            await expectInert(run, decisionIn(run, name));
          }
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the Scale's rating steps respond and the slider's unset track points, its thumb takes the ring from the keyboard, and a locked board's show nothing`,
        async () => {
          const rating = scaleDocument({ min: 1, max: 5, display: "rating" });
          const run = await host(dist, rating, { colorScheme: scheme });
          await readyIn(run);
          const step = (name: string) => decisionIn(run, name);
          await expectResponds(step("3"), scheme);
          await lock(run, rating);
          await eventually(() => step("3").isDisabled(), "the steps to be disabled");
          for (const name of ["1", "3", "5"]) await expectInert(run, step(name));

          const slider = scaleDocument({ min: 0, max: 100, step: 5 });
          const other = await host(dist, slider, { colorScheme: scheme });
          await readyIn(other);
          const track = other.board.view.locator("[data-scale-unset]");
          expect((await hovered(track)).cursor).toBe("pointer");
          await track.focus();
          await other.board.page.keyboard.press("End");
          const thumb = other.board.view.getByRole("slider").first();
          await eventually(
            () => thumb.evaluate((el) => el === el.ownerDocument.activeElement),
            "focus on the thumb",
          );
          await expectRing(thumb);
          // The thumb is a drag handle: grab on an open board (task 6.11).
          expect((await hovered(thumb)).cursor).toBe("grab");
          await lock(other, slider);
          await eventually(
            async () => (await thumb.getAttribute("data-disabled")) !== null,
            "the thumb to be disabled",
          );
          // A locked board's thumb is disabled: not-allowed, and no look change.
          await expectInert(other, thumb);
          expect(run.browser.errors).toEqual([]);
          expect(other.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      test(
        `in the ${scheme} scheme, the Ranking's tools respond or stay inert, its handle grabs, its list takes the ring from the keyboard, and a locked board's show no handle and inert tools`,
        async () => {
          const document = rankingDocument();
          const run = await host(dist, document, { colorScheme: scheme });
          await readyIn(run);
          const { board } = run;
          const row = (id: string) => board.view.locator(`[data-ranking-row="${id}"]`);
          const tool = (name: string) =>
            board.view
              .getByRole("toolbar", { name: "Ranking tools" })
              .getByRole("button", { name, exact: true });
          await expectResponds(tool("Keep this order"), scheme);
          // The first row is current, so it cannot move up: that tool is disabled and inert.
          await expectInert(run, tool("Move up"));
          await board.view.locator('[data-ranking-row="cost"]').hover();
          expect(
            (await lookOf(board.view.locator('[data-ranking-row="cost"] [data-drag-handle]')))
              .cursor,
          ).toBe("grab");
          // A row is an option row: the pointer cursor from the shared layer (spec review U-2).
          expect((await hovered(row("speed"))).cursor).toBe("pointer");
          await board.page.mouse.move(0, 0);
          const list = board.view.getByRole("listbox");
          await tabIntoGroup(board, plan.props.text, list);
          await expectRing(board.view.locator('[data-ranking-row="speed"]'));
          await lock(run, document);
          await eventually(
            async () => (await board.view.locator("[data-drag-handle]").count()) === 0,
            "the handles to go",
          );
          for (const name of ["Move up", "Move down", "Keep this order"]) {
            await expectInert(run, tool(name));
          }
          // A locked board's row still answers the pointer by becoming the current row, which is
          // view state and no edit: its pointer cursor is honest, and nothing else changes.
          expect((await hovered(row("speed"))).cursor).toBe("pointer");
          await row("speed").click();
          await eventually(
            async () => (await row("speed").getAttribute("aria-current")) === "true",
            "the pressed row to become current",
          );
          expect(run.browser.errors).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );
    }
  });
}
