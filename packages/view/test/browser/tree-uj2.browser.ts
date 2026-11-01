// UJ-2 on the Tree, end to end, in each engine, on the widget host (tree-widget task 6.8; spec,
// "The UJ-2 edits by keyboard"; AD-10, AD-20): with the keyboard only, the user makes the approved
// UJ-2 answer's `wbs` edits on the fixture Tree and presses "Answer". Nothing leaves the view
// before it; after it, one answer message carries the Tree's full edited value, which validates as
// an edited value and whose diff against the fixture's Tree is the approved answer's `changes`.

import { describe, expect, test } from "bun:test";
import { elementChanges, TREE_SHAPE } from "@askboard/contract";
import { treeAnswer, treeBoardDocument, treeEditedValue } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import { plan, wbs } from "./fixtures/tree-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  type FocusAt,
  pressIn,
  pressTool,
  type TreeGrid,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import { expectNewNode, expectSteps, readyIn, typeIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

/** How many presses of Tab may pass before the focus must have reached its target. */
const MAX_TABS = 6;

/** Tabs from the host page into the view until the focus is in the tree, with no click. */
const tabIntoTreeByKeys = async (run: WidgetHostRun): Promise<FocusAt> => {
  for (let presses = 0; presses < MAX_TABS; presses += 1) {
    await run.board.page.keyboard.press("Tab");
    const at = await treeFocus(run.board);
    if (at !== undefined) return at;
  }
  throw new Error(`${MAX_TABS} presses of Tab never reached the Tree`);
};

/** Edits the focused field: F2, the text over the field's, then Enter, the focus staying put. */
const enterField = async (
  run: WidgetHostRun,
  tree: TreeGrid,
  text: string,
  at: FocusAt,
): Promise<void> => {
  await typeIn(run, tree, "F2", text);
  expect({ text, at: await pressIn(run.board, "Enter") }).toEqual({ text, at });
  expect(await tree.editor.count()).toBe(0);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: UJ-2 on the Tree`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "with the keyboard only, the approved UJ-2 edits and Answer send one answer whose Tree diffs to the approved changes",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTreeByKeys(run)).toEqual({ nodeId: "design" });
        // `ux`: the most likely estimate, 5 to 4.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowRight", { nodeId: "ux", cell: 0 }],
          ["ArrowRight", { nodeId: "ux", cell: 1 }],
          ["ArrowRight", { nodeId: "ux", cell: 2 }],
        ]);
        await enterField(run, tree, "4", { nodeId: "ux", cell: 2 });
        // `portal`: renamed, and its three estimates halved.
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "architecture", cell: 2 }],
          ["ArrowDown", { nodeId: "prototype", cell: 2 }],
          ["ArrowDown", { nodeId: "build", cell: 2 }],
          ["ArrowDown", { nodeId: "portal", cell: 2 }],
          ["Home", { nodeId: "portal", cell: 0 }],
        ]);
        // Enter opens the name, as F2 opens each field: both open the focused cell.
        await typeIn(run, tree, "Enter", "Customer portal: accounts");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "portal", cell: 0 });
        for (const [cell, text] of [
          [1, "4"],
          [2, "6"],
          [3, "10"],
        ] as const) {
          expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "portal", cell });
          await enterField(run, tree, text, { nodeId: "portal", cell });
        }
        // `u-1`, split off after `portal` from the toolbar's "Add node", named, then estimated.
        expect(await pressTool(board, "Shift+Tab")).toBe("Add node");
        await board.page.keyboard.press("Enter");
        await expectNewNode(tree, "u-1");
        await board.page.keyboard.type("Customer portal: dashboards");
        expect(await pressIn(board, "Enter")).toEqual({ nodeId: "u-1", cell: 0 });
        for (const [cell, text] of [
          [1, "4"],
          [2, "7"],
          [3, "12"],
        ] as const) {
          expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "u-1", cell });
          await enterField(run, tree, text, { nodeId: "u-1", cell });
        }
        // `billing`: the pessimistic estimate, 15 to 21.
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "billing", cell: 3 });
        await enterField(run, tree, "21", { nodeId: "billing", cell: 3 });
        expect(await tree.counter.textContent()).toBe("Your changes: 4");
        // Nothing has left the view yet.
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // Tab on to "Answer", then Enter: the answer's `when` is the time of that act.
        expect(await board.answer.isEnabled()).toBe(true);
        for (let presses = 0; !(await isFocused(board.answer)); presses += 1) {
          if (presses === MAX_TABS)
            throw new Error(`${MAX_TABS} presses of Tab never reached Answer`);
          await board.page.keyboard.press("Tab");
        }
        const pressed = Date.now();
        await board.page.keyboard.press("Enter");
        await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
        const received = Date.now();
        await Bun.sleep(QUIET_MS);
        const answers = run.messages.filter((message) => message.type === "answer");
        expect(run.messages).toHaveLength(2);
        expect(answers).toHaveLength(1);
        const [answer] = answers;
        expect(answer).toEqual({
          type: "answer",
          itemId: plan.id,
          rev: plan.rev,
          values: { [wbs.id]: treeEditedValue },
          when: expect.any(String),
        });
        const when = Date.parse(answer?.type === "answer" ? answer.when : "");
        expect(when).toBeGreaterThanOrEqual(pressed);
        expect(when).toBeLessThanOrEqual(received);
        // The Tree's value validates as an edited value, and the contract's diff of the sent and
        // the edited value is the approved answer's `changes`, in the diff's order.
        const checked = validateTreeProps(
          answer?.type === "answer" ? answer.values?.[wbs.id] : undefined,
          "edited",
        );
        expect(checked.ok).toBe(true);
        const approved = treeAnswer.changes ?? [];
        expect(approved.length).toBeGreaterThan(0);
        if (checked.ok) {
          expect(elementChanges(wbs.id, wbs.props, checked.value, TREE_SHAPE)).toEqual(approved);
        }
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
