// UJ-2 on the expanded question, end to end, in each engine, on the widget host (molecules task
// 10.5; view spec, "Answering a work breakdown question"; AD-10, AD-20, FR-12, F7): with the
// keyboard only, the user makes the approved answer's `wbs` edits in the work breakdown, `u-1`'s
// predecessors following from the split (F20), and presses "Answer". Nothing but `ready` leaves the
// view before it; after it, one answer message carries the full edited value of the Tree and of the
// plan and the derived values of both as they stand, which are the approved answer's under the
// expanded IDs; the question is then read-only. With task 4.3, which maps those fixtures to the
// approved answer through `ask-core`, this checks UJ-2 end to end.

import { describe, expect, test } from "bun:test";
import {
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
} from "@askboard/contract/fixtures";
import { wbsQuestion } from "./fixtures/wbs-documents.ts";
import {
  eventually,
  isFocused,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { enabledTools, pressIn, pressTool, treeFocus, treeGridOf } from "./harness/tree-grid.ts";
import {
  enterField,
  expectNewNode,
  expectSteps,
  readyIn,
  tabUntil,
  typeIn,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: UJ-2 on the work breakdown`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "with the keyboard only, the approved wbs edits then Answer send one answer holding both items' edited values and the approved derived values, and the question turns read-only",
      async () => {
        const run = await host(dist, uj2ExpandedBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        await tabUntil(board, async () => (await treeFocus(board)) !== undefined, "the Tree");
        expect(await treeFocus(board)).toEqual({ nodeId: "design" });
        // `ux`: most likely, 5 to 4.
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
        // `u-1`, split off after `portal` from the toolbar's "Add node", named, which gives it the
        // portal's predecessors in the plan (F20), then estimated.
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
        // Nothing but `ready` has left the view yet.
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: wbsQuestion.id }]);
        // Tab on to "Answer", then Enter.
        expect(await board.answer.isEnabled()).toBe(true);
        await tabUntil(board, () => isFocused(board.answer), "Answer");
        await board.page.keyboard.press("Enter");
        await eventually(() => run.messages.length > 1, "the answer message", STEP_TIMEOUT_MS);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toHaveLength(2);
        const answers = run.messages.filter((message) => message.type === "answer");
        expect(answers).toHaveLength(1);
        const [answer]: unknown[] = answers;
        expect(answer).toEqual({
          type: "answer",
          itemId: wbsQuestion.id,
          rev: uj2ExpandedBoardDocument.items[0].rev,
          values: uj2ExpandedEditedValues,
          derived: uj2ExpandedDerived,
          when: expect.any(String),
        });
        // The question is read-only: the Tree's tools are all disabled.
        await eventually(
          async () => (await enabledTools(tree.tools)).length === 0,
          "the Tree to turn read-only",
        );
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
