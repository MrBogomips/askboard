// The Tree's editing scenarios, in each engine, on the widget host (tree-widget design decision
// 6; spec, "Tree editing"): Enter and F2 edit the focused name or field, Enter and leaving the
// field commit, Escape restores; a number is read by the en-US parser with its echo, and an
// ambiguous one is refused; the edits fill the draft and send nothing until "Answer".

import { describe, expect, test } from "bun:test";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import { plan, wbs, withPortal } from "./fixtures/tree-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { pressIn, tabStops, treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import {
  expectNewNode,
  expectSteps,
  expectUnchanged,
  focusPortal,
  readyIn,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's editing`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Enter and F2 edit the focused name or field; Enter commits, Escape restores, and renaming back disables Answer",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        // Enter on a row edits its name, which the editor holds selected.
        await board.page.keyboard.press("Enter");
        await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.cell("portal", 0).getByRole("textbox").count()).toBe(1);
        expect(await tree.editor.inputValue()).toBe("Customer portal");
        expect(await isFocused(tree.editor)).toBe(true);
        await board.page.keyboard.type("Customer portal: accounts");
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal: accounts");
        expect(await board.answer.isEnabled()).toBe(true);
        // Renamed back to the agent's name, the Tree holds no draft value again.
        await typeIn(run, tree, "Enter", "Customer portal");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal");
        expect(await board.answer.isDisabled()).toBe(true);
        // F2 on a cell edits that field; Escape restores it and gives the focus back to the cell.
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await typeIn(run, tree, "F2", "99");
        expect(await tree.cell("portal", 1).getByRole("textbox").count()).toBe(1);
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 1).textContent()).toBe("8");
        // Enter on a cell edits it too, and the name's cell edits the name.
        await typeIn(run, tree, "Enter", "7");
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await pressIn(board, "Home")).toEqual({ nodeId: "portal", cell: 0 });
        await typeIn(run, tree, "F2", "Another name");
        expect(await tree.cell("portal", 0).getByRole("textbox").count()).toBe(1);
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "portal", cell: 0 });
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal");
        expect(await tabStops(tree.grid)).toBe(1);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "1,234.5 in a number field shows its echo, commits 1234.5 into the draft, and the answer carries it",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        await typeIn(run, tree, "F2", "1,234.5");
        await tree.row("portal").getByText("= 1234.5", { exact: true }).waitFor({
          timeout: STEP_TIMEOUT_MS,
        });
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 1).textContent()).toBe("1234.5");
        expect(await board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // The draft holds the change: "Answer" sends it as the Tree's full edited value.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        expect(values).toEqual({ [wbs.id]: withPortal({ optimistic: 1234.5 }) });
        expect(validateTreeProps(values?.[wbs.id], "edited").ok).toBe(true);
        expect(run.messages).toHaveLength(2);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "1,5 shows a message and keeps the focus and the draft; an empty name is not committed; leaving a field commits it",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        // An ambiguous number: a field error under the row, the focus kept, the draft unchanged.
        await typeIn(run, tree, "F2", "1,5");
        await board.page.keyboard.press("Enter");
        expect(await tree.editor.count()).toBe(1);
        expect(await isFocused(tree.editor)).toBe(true);
        expect(await tree.editor.getAttribute("aria-invalid")).toBe("true");
        const describedBy = (await tree.editor.getAttribute("aria-describedby")) ?? "";
        const message = board.view.locator(`[id="${describedBy}"]`);
        expect(await message.textContent()).toContain("commas");
        expect(await message.isVisible()).toBe(true);
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await pressIn(board, "Escape")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await tree.cell("portal", 1).textContent()).toBe("8");
        expect(await message.count()).toBe(0);
        // An empty name is not committed: the name stays as it was.
        expect(await pressIn(board, "Home")).toEqual({ nodeId: "portal", cell: 0 });
        await typeIn(run, tree, "Enter", "x");
        await board.page.keyboard.press("Backspace");
        expect(await tree.editor.inputValue()).toBe("");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 0 });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal");
        await expectUnchanged(run);
        // Leaving a field commits it.
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
          ["ArrowRight", { nodeId: "portal", cell: 2 }],
        ]);
        await typeIn(run, tree, "F2", "13");
        await board.view.getByRole("heading", { name: plan.props.text }).click();
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 2).textContent()).toBe("13");
        expect(await board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the window losing the focus is not leaving the field: the editor stays open, and Enter commits",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        // When the user switches windows, the input gets blur and focusout but stays its
        // document's focused element; a headless page cannot lose the window's focus, so the
        // events are sent as the browser sends them.
        await (await board.viewFrame()).evaluate(() => {
          const field = document.activeElement;
          field?.dispatchEvent(new FocusEvent("blur"));
          field?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        });
        await Bun.sleep(QUIET_MS);
        expect(await tree.editor.count()).toBe(1);
        expect(await tree.editor.inputValue()).toBe("Customer portal: accounts");
        expect(await isFocused(tree.editor)).toBe(true);
        expect(await board.answer.isDisabled()).toBe(true);
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal" });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal: accounts");
        expect(await board.answer.isEnabled()).toBe(true);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on another cell while a field is edited commits it, and the focus goes to the cell clicked",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await focusPortal(run, tree);
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        await tree.cell("billing", 2).click({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.editor.count()).toBe(0);
        expect(await tree.cell("portal", 0).textContent()).toBe("Customer portal: accounts");
        await Bun.sleep(QUIET_MS);
        expect(await treeFocus(board)).toEqual({ nodeId: "billing", cell: 2 });
        expect(await tabStops(tree.grid)).toBe(1);
        // A new node's name too: the node is added, and the focus goes to the cell clicked.
        await tree.tool("Add node").click({ timeout: STEP_TIMEOUT_MS });
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Billing: refunds");
        await tree.cell("design", 1).click({ timeout: STEP_TIMEOUT_MS });
        expect(await tree.cell("u-1", 0).textContent()).toBe("Billing: refunds");
        await Bun.sleep(QUIET_MS);
        expect(await treeFocus(board)).toEqual({ nodeId: "design", cell: 1 });
        expect(await tabStops(tree.grid)).toBe(1);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
