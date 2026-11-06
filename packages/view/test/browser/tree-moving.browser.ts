// The Tree's moving scenarios, in each engine, on the widget host (tree-widget design decision 6;
// proposal, open questions 9 and 13; spec, "Tree moving nodes" and "Tree keyboard"): each move
// by its Alt+Shift key and by its tool carries the branch, the focus following, the page never
// navigating; the edges and the depth limit change nothing.

import { describe, expect, test } from "bun:test";
import type { TreeNode } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import { plan, tallBranchTreeDocument, wbs, withBuild } from "./fixtures/tree-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  enabledTools,
  type FocusAt,
  pressIn,
  pressTool,
  recordedKeys,
  recordKeys,
  shiftTabToAddNode,
  tabIntoTree,
  tabStops,
  treeGridOf,
  treeStop,
} from "./harness/tree-grid.ts";
import {
  allPlaces,
  expectSteps,
  expectToolSteps,
  expectUnchanged,
  FIXTURE_IDS,
  focusPortal,
  pageOf,
  placeOf,
  readyIn,
  shownIds,
  TOOL_LABELS,
} from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's moves`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "each move by its Alt+Shift key carries the branch, the focus following, and the page neither navigates nor adds history",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const page = await pageOf(run);
        await recordKeys(board);
        const move = async (key: string): Promise<FocusAt> => {
          const at = await pressIn(board, key);
          expect({ key, page: await pageOf(run) }).toEqual({ key, page });
          expect(await tabStops(tree.grid)).toBe(1);
          return at;
        };
        // The spec's "Moving with the keyboard only": to `billing` by the arrows, then up.
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        await expectSteps(
          run,
          tree,
          ["ux", "architecture", "prototype", "build", "portal", "billing"].map(
            (nodeId) => ["ArrowDown", { nodeId }] as const,
          ),
        );
        expect(await move("Alt+Shift+ArrowUp")).toEqual({ nodeId: "billing" });
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 5),
          "billing",
          "portal",
          "reporting",
        ]);
        expect(await move("Alt+Shift+ArrowDown")).toEqual({ nodeId: "billing" });
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // The spec's "Indenting": `billing` becomes `portal`'s last child, and `portal` opens.
        expect(await move("Alt+Shift+ArrowRight")).toEqual({ nodeId: "billing" });
        expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
        expect(await tree.row("portal").getAttribute("aria-expanded")).toBe("true");
        // Into a collapsed node, which expands: `reporting` under `portal`, closed first.
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "portal" });
        expect(await pressIn(board, "ArrowLeft")).toEqual({ nodeId: "portal" });
        expect(await shownIds(tree)).toEqual([...FIXTURE_IDS.slice(0, 6), "reporting"]);
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "reporting" });
        expect(await move("Alt+Shift+ArrowRight")).toEqual({ nodeId: "reporting" });
        expect(await tree.row("portal").getAttribute("aria-expanded")).toBe("true");
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await placeOf(tree, "reporting")).toEqual(["3", "2", "2"]);
        // Outdenting puts `reporting` right after its parent `portal`, under `build`.
        expect(await move("Alt+Shift+ArrowLeft")).toEqual({ nodeId: "reporting" });
        expect(await placeOf(tree, "reporting")).toEqual(["2", "2", "2"]);
        // The branch goes with its node, and the focus keeps its cell: `portal`, with `billing`.
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "billing" });
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "portal" });
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "portal", cell: 0 }],
          ["ArrowRight", { nodeId: "portal", cell: 1 }],
        ]);
        expect(await move("Alt+Shift+ArrowDown")).toEqual({ nodeId: "portal", cell: 1 });
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 5),
          "reporting",
          "portal",
          "billing",
        ]);
        expect(await placeOf(tree, "billing")).toEqual(["3", "1", "1"]);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        // "Answer" sends the moved nodes, each with its fields.
        await board.answer.click({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => run.messages.length > 1, "the answer message");
        const [, answer] = run.messages;
        const values = answer?.type === "answer" ? answer.values : undefined;
        const [portal, billing, reporting] = wbs.props.nodes[1]?.children ?? [];
        expect(values).toEqual({
          [wbs.id]: withBuild(() => [
            reporting as TreeNode,
            { ...(portal as TreeNode), children: [billing as TreeNode] },
          ]),
        });
        expect(validateTreeProps(values?.[wbs.id], "edited").ok).toBe(true);
        expect(await pageOf(run)).toEqual(page);
        // The Tree kept the browser from acting on each of its keys.
        expect(
          (await recordedKeys(board)).filter((key) => key.startsWith("Alt+Shift+Arrow")),
        ).toEqual(
          ["Up", "Down", "Right", "Right", "Left", "Down"].map(
            (arrow) => `Alt+Shift+Arrow${arrow} prevented`,
          ),
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "each move by its tool, the focus staying on the tool; outdenting portal leaves billing and reporting under build",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const page = await pageOf(run);
        await focusPortal(run, tree);
        // On `portal`, a first child: "Move up" and "Indent" are disabled.
        expect(await enabledTools(tree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move down",
          "Outdent",
          "Delete",
        ]);
        expect(await shiftTabToAddNode(board)).toBe("Add node");
        await expectToolSteps(run, tree, [
          ["ArrowRight", "Add child"],
          ["ArrowRight", "Move down"],
        ]);
        expect(await pressTool(board, "Enter")).toBe("Move down");
        expect(await shownIds(tree)).toEqual([
          ...FIXTURE_IDS.slice(0, 5),
          "billing",
          "portal",
          "reporting",
        ]);
        expect(await treeStop(tree)).toEqual({ nodeId: "portal" });
        expect(await pressTool(board, "Enter")).toBe("Move down");
        const last = [...FIXTURE_IDS.slice(0, 5), "billing", "reporting", "portal"];
        expect(await shownIds(tree)).toEqual(last);
        // At the end "Move down" turns disabled under the focus, which stays; Enter does nothing.
        expect(await tree.tool("Move down").isDisabled()).toBe(true);
        expect(await pressTool(board, "Enter")).toBe("Move down");
        expect(await shownIds(tree)).toEqual(last);
        // "Move up", by Space, back to the first place.
        expect(await pressTool(board, "ArrowLeft")).toBe("Move up");
        expect(await pressTool(board, "Space")).toBe("Move up");
        expect(await pressTool(board, "Space")).toBe("Move up");
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await treeStop(tree)).toEqual({ nodeId: "portal" });
        // The spec's "Outdenting": `portal` follows `build` at the top level, and `billing` and
        // `reporting` stay under `build`.
        expect(await pressTool(board, "End")).toBe("Select all");
        expect(await pressTool(board, "ArrowLeft")).toBe("Delete");
        expect(await pressTool(board, "ArrowLeft")).toBe("Outdent");
        expect(await pressTool(board, "Enter")).toBe("Outdent");
        expect(await shownIds(tree)).toEqual(last);
        expect(await placeOf(tree, "portal")).toEqual(["1", "3", "3"]);
        expect(await placeOf(tree, "billing")).toEqual(["2", "1", "2"]);
        expect(await placeOf(tree, "reporting")).toEqual(["2", "2", "2"]);
        expect(await treeStop(tree)).toEqual({ nodeId: "portal" });
        // "Indent": `portal` becomes `build`'s last child; the tree's focus followed it.
        expect(await pressTool(board, "ArrowLeft")).toBe("Indent");
        expect(await pressTool(board, "Enter")).toBe("Indent");
        expect(await placeOf(tree, "portal")).toEqual(["2", "3", "3"]);
        expect(await pressIn(board, "Tab")).toEqual({ nodeId: "portal" });
        expect(await pageOf(run)).toEqual(page);
        expect(await board.answer.isEnabled()).toBe(true);
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the disabled edges and the depth limit change nothing, by key or by tool",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const page = await pageOf(run);
        const places = await allPlaces(tree);
        await recordKeys(board);
        const pressNothing = async (key: string, at: FocusAt): Promise<void> => {
          expect({ key, at: await pressIn(board, key) }).toEqual({ key, at });
          expect({ key, places: await allPlaces(tree) }).toEqual({ key, places });
          expect({ key, page: await pageOf(run) }).toEqual({ key, page });
        };
        // `design`, the first top-level node: "Move up", "Indent" and "Outdent".
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "Home")).toEqual({ nodeId: "design" });
        expect(await enabledTools(tree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move down",
          "Delete",
        ]);
        for (const key of ["Alt+Shift+ArrowUp", "Alt+Shift+ArrowRight", "Alt+Shift+ArrowLeft"]) {
          await pressNothing(key, { nodeId: "design" });
        }
        // `ux`, a first child: "Move up" and "Indent".
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "ux" });
        expect(await enabledTools(tree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move down",
          "Outdent",
          "Delete",
        ]);
        await pressNothing("Alt+Shift+ArrowUp", { nodeId: "ux" });
        await pressNothing("Alt+Shift+ArrowRight", { nodeId: "ux" });
        // `reporting`, the last node: "Move down".
        expect(await pressIn(board, "End")).toEqual({ nodeId: "reporting" });
        expect(await enabledTools(tree.tools)).toEqual(
          TOOL_LABELS.filter((label) => label !== "Move down"),
        );
        await pressNothing("Alt+Shift+ArrowDown", { nodeId: "reporting" });
        // A disabled tool's click changes nothing either.
        await tree.tool("Move down").dispatchEvent("click");
        expect(await allPlaces(tree)).toEqual(places);
        // The Tree kept the browser from acting on its keys, the refused ones too.
        expect(
          (await recordedKeys(board)).filter((key) => key.startsWith("Alt+Shift+Arrow")),
        ).toEqual(
          ["Up", "Right", "Left", "Up", "Right", "Down"].map(
            (arrow) => `Alt+Shift+Arrow${arrow} prevented`,
          ),
        );
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);

        // The depth limit: `b1`'s branch spans 8 levels, so it cannot go under `leaf`.
        const tall = await host(dist, tallBranchTreeDocument);
        await readyIn(tall);
        const tallTree = treeGridOf(tall.board);
        const tallPlaces = await allPlaces(tallTree);
        expect(await tabIntoTree(tall.board, plan.props.text)).toEqual({ nodeId: "leaf" });
        expect(await pressIn(tall.board, "ArrowDown")).toEqual({ nodeId: "b1" });
        expect(await enabledTools(tallTree.tools)).toEqual([
          "Add node",
          "Add child",
          "Move up",
          "Delete",
        ]);
        expect(await pressIn(tall.board, "Alt+Shift+ArrowRight")).toEqual({ nodeId: "b1" });
        await tallTree.tool("Indent").dispatchEvent("click");
        expect(await allPlaces(tallTree)).toEqual(tallPlaces);
        await expectUnchanged(tall);
        expect(tall.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
