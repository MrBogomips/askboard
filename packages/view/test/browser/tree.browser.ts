// The Tree's scenarios, in each engine, on the widget host (design decisions 6 and 9 of the
// tree-widget change), since the board page refuses a board document holding a Tree until the
// input format admits one. The fixture Tree's question counts as visible with no CSP violation,
// and a Tree whose props fail the contract's checks fails its question (AD-10). The Tree is a
// treegrid in the widget frame: its column names, one row per node, indented per level, with a
// chevron on a parent and numbers right-aligned; agent strings show as text (AD-8).

import { describe, expect, test } from "bun:test";
import { type TreeNode, type TreeProps, treePropsProblems } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import { validateTreeProps } from "@askboard/contract/validate";
import type { ViewDocument } from "../../src/view-document.ts";
import { MARKUP_LABEL } from "./fixtures/markup-document.ts";
import { MARKUP_NOTE, markupTreeDocument } from "./fixtures/markup-tree-document.ts";
import { largeTreeDocument, treeDocumentWith } from "./fixtures/tree-documents.ts";
import {
  eventually,
  isFocused,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
} from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  chevronAngle,
  type FocusAt,
  focusRing,
  nameLefts,
  pressIn,
  rightGaps,
  type TreeGrid,
  tabIntoTree,
  tabStops,
  treeFocus,
  treeGridOf,
} from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const [plan] = treeBoardDocument.items;
const [wbs] = plan.props.items;

const namesOf = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) => [node.label, ...namesOf(node.children ?? [])]);

// The fixture Tree with a node only the view may add: `u-` IDs are refused from the agent (design
// decision 11), so the Tree's own check fails it.
const refusedProps = {
  ...wbs.props,
  nodes: [...wbs.props.nodes, { id: "u-1", label: "Added by the agent" }],
};
const refusedTree: ViewDocument = treeDocumentWith(refusedProps);

// The fixture Tree's rows as the spec lays them out: level, place among siblings, and whether the
// row is an open parent.
const FIXTURE_ROWS = [
  { id: "design", level: "1", posinset: "1", setsize: "2", expanded: "true" },
  { id: "ux", level: "2", posinset: "1", setsize: "3", expanded: null },
  { id: "architecture", level: "2", posinset: "2", setsize: "3", expanded: null },
  { id: "prototype", level: "2", posinset: "3", setsize: "3", expanded: null },
  { id: "build", level: "1", posinset: "2", setsize: "2", expanded: "true" },
  { id: "portal", level: "2", posinset: "1", setsize: "3", expanded: null },
  { id: "billing", level: "2", posinset: "2", setsize: "3", expanded: null },
  { id: "reporting", level: "2", posinset: "3", setsize: "3", expanded: null },
];

/** DESIGN.md's focus ring: a 2px outline, offset by 1px. */
const RING = { style: "solid", width: "2px", offset: "1px" };

/** Waits for the question's first view message, which must be its `ready`. */
const readyIn = async (run: WidgetHostRun): Promise<void> => {
  await eventually(() => run.messages.length > 0, "the question's ready message", LOAD_TIMEOUT_MS);
  expect(run.messages[0]).toEqual({ type: "ready", itemId: plan.id });
};

/** Nothing has changed: "Answer" is disabled and no view message but `ready` left the view. */
const expectUnchanged = async (run: WidgetHostRun): Promise<void> => {
  expect(await run.board.answer.isDisabled()).toBe(true);
  await Bun.sleep(QUIET_MS);
  expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
};

/** The IDs of the rows the Tree shows, in order. */
const shownIds = (tree: TreeGrid): Promise<(string | null)[]> =>
  tree.rows.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-node-id")));

/** Presses each key in turn, expecting the focus where the step says, with one Tab stop. */
const expectSteps = async (
  run: WidgetHostRun,
  tree: TreeGrid,
  steps: readonly (readonly [string, FocusAt])[],
): Promise<void> => {
  for (const [key, at] of steps) {
    expect({ key, at: await pressIn(run.board, key) }).toEqual({ key, at });
    expect(await tabStops(tree.grid)).toBe(1);
  }
};

const FIXTURE_IDS = FIXTURE_ROWS.map((row) => row.id);

/** Tabs into the fixture Tree and moves the focus down to `portal`, the first child of `build`. */
const focusPortal = async (run: WidgetHostRun, tree: TreeGrid): Promise<void> => {
  expect(await tabIntoTree(run.board, plan.props.text)).toEqual({ nodeId: "design" });
  await expectSteps(
    run,
    tree,
    ["ux", "architecture", "prototype", "build", "portal"].map(
      (nodeId) => ["ArrowDown", { nodeId }] as const,
    ),
  );
};

/** Opens the editor with `key` and types `text` over the cell's text, which it selects. */
const typeIn = async (run: WidgetHostRun, tree: TreeGrid, key: string, text: string) => {
  await run.board.page.keyboard.press(key);
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  expect(await isFocused(tree.editor)).toBe(true);
  await run.board.page.keyboard.type(text);
};

/** The fixture Tree with `portal`'s fields or name changed, as the answer's value must hold it. */
const withPortal = (change: Readonly<Record<string, string | number>>): TreeProps => ({
  ...wbs.props,
  nodes: wbs.props.nodes.map((node) =>
    node.id === "build"
      ? {
          ...node,
          children: node.children?.map((child) =>
            child.id === "portal" ? { ...child, ...change } : child,
          ),
        }
      : node,
  ),
});

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the fixture Tree's question counts as visible, its ready message recorded, with no CSP violation",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await eventually(
          () => run.messages.length > 0,
          "the question's ready message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([{ type: "ready", itemId: plan.id }]);
        const card = run.board.question(plan.id);
        expect(await card.getAttribute("aria-busy")).toBe("false");
        expect(await card.getByRole("alert").count()).toBe(0);
        const shown = (await card.textContent()) ?? "";
        for (const name of namesOf(wbs.props.nodes)) expect(shown).toContain(name);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Tree whose props fail the contract's checks fails its question, with no Answer",
      async () => {
        const problems = treePropsProblems(refusedProps, "agent");
        expect(problems).toHaveLength(1);
        const [problem] = problems;
        const run = await host(dist, refusedTree);
        await eventually(
          () => run.messages.length > 0,
          "the Tree's item-error message",
          LOAD_TIMEOUT_MS,
        );
        await Bun.sleep(QUIET_MS);
        expect(run.messages).toEqual([
          {
            type: "item-error",
            itemId: wbs.id,
            error: expect.stringContaining(`${problem?.path}: ${problem?.message}`),
          },
        ]);
        const card = run.board.question(plan.id);
        expect(await card.getByRole("alert").count()).toBe(1);
        expect(await run.board.answer.count()).toBe(0);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the fixture Tree opens as a treegrid: column names, eight rows fully expanded, children one level in",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const tree = treeGridOf(run.board);
        expect(await tree.grid.getAttribute("aria-labelledby")).toBeTruthy();
        expect(await run.board.view.getByRole("treegrid", { name: plan.props.text }).count()).toBe(
          1,
        );
        expect(await tree.headers.allTextContents()).toEqual([
          "Name",
          ...(wbs.props.columns ?? []).map((column) => column.label),
        ]);
        const rows = await tree.rows.evaluateAll((elements) =>
          elements.map((row) => ({
            id: row.getAttribute("data-node-id"),
            level: row.getAttribute("aria-level"),
            posinset: row.getAttribute("aria-posinset"),
            setsize: row.getAttribute("aria-setsize"),
            expanded: row.getAttribute("aria-expanded"),
          })),
        );
        expect(rows).toEqual(FIXTURE_ROWS);
        expect(await tree.row("portal").getByRole("gridcell").allTextContents()).toEqual([
          "Customer portal",
          "8",
          "12",
          "20",
        ]);
        // An open chevron on each parent, pointing down, and none on a leaf.
        expect(await chevronAngle(tree.chevron("design"))).toBe(90);
        expect(await chevronAngle(tree.chevron("build"))).toBe(90);
        expect(await tree.grid.locator("[data-chevron]").count()).toBe(2);
        // Children one level in: `spacing.lg`, 16px, per level (DESIGN.md, Tree).
        const lefts = await nameLefts(run.board);
        for (const [parent, children] of [
          ["design", ["ux", "architecture", "prototype"]],
          ["build", ["portal", "billing", "reporting"]],
        ] as const) {
          for (const child of children) {
            expect(Math.round((lefts[child] ?? 0) - (lefts[parent] ?? 0))).toBe(16);
          }
        }
        // Numbers right-aligned in their cells.
        const numbers = tree.grid.locator('[data-cell]:not([data-cell="0"])');
        const gaps = await rightGaps(numbers);
        expect(gaps).toHaveLength(18);
        expect(gaps.every((gap) => gap === 0)).toBe(true);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "markup in a node's name, a column's label and a text field shows as text, and no element is made from it",
      async () => {
        const run = await host(dist, markupTreeDocument);
        await readyIn(run);
        const view = await run.board.viewFrame();
        // biome-ignore lint/performance/useDomNodeTextContent: the rendered text is what the user sees.
        const shown = await view.evaluate(() => document.body.innerText);
        expect(shown).toContain(MARKUP_LABEL);
        expect(shown).toContain(MARKUP_NOTE);
        // The header row is in upper case, so its text is read without the rendering's case.
        const tree = treeGridOf(run.board);
        expect(await tree.headers.allTextContents()).toEqual(["Name", MARKUP_LABEL]);
        expect(await tree.row("markup").getByRole("gridcell").allTextContents()).toEqual([
          MARKUP_LABEL,
          MARKUP_NOTE,
        ]);
        // No element made from the agent's markup; the data block holds it as JSON, not as code.
        const created = await view.evaluate(() =>
          [
            ...document.querySelectorAll('img[src="x"], [onerror]'),
            ...[...document.querySelectorAll("b")].filter((b) => b.textContent === "bold"),
            ...[...document.querySelectorAll('script:not([type="application/json"])')].filter(
              (script) => (script.textContent ?? "").includes("document.title='owned'"),
            ),
          ].map((element) => element.outerHTML.slice(0, 80)),
        );
        expect(created).toEqual([]);
        expect(await run.board.page.title()).not.toContain("owned");
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the tree is one Tab stop, and the arrow keys, Home and End move the focus with the focus ring",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await tabStops(tree.grid)).toBe(1);
        expect(await focusRing(board)).toEqual(RING);
        await expectSteps(run, tree, [
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowDown", { nodeId: "architecture" }],
          ["End", { nodeId: "reporting" }],
          ["ArrowDown", { nodeId: "reporting" }],
          ["ArrowUp", { nodeId: "billing" }],
          ["Home", { nodeId: "design" }],
          ["ArrowUp", { nodeId: "design" }],
          ["End", { nodeId: "reporting" }],
        ]);
        expect(await focusRing(board)).toEqual(RING);
        // Tab never lands on another row or cell: it leaves the tree, which the view's document
        // then no longer holds the focus in, except in Firefox, whose frame keeps its last focused
        // element when the focus leaves it, and wraps back to the tree's one Tab stop when the host
        // page has no other.
        const afterTab = await pressIn(board, "Tab");
        expect(afterTab === undefined ? "left the tree" : afterTab).toEqual(
          engine === "firefox" ? { nodeId: "reporting" } : "left the tree",
        );
        expect(await tabStops(tree.grid)).toBe(1);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(board.page.url()).toBe(url);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Right and Left expand and collapse a row, go to its parent, and move between the row and its cells",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        const url = board.page.url();
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        // Left collapses an open row, Right expands it again; the focus stays on the row.
        expect(await pressIn(board, "ArrowLeft")).toEqual({ nodeId: "design" });
        expect(await tree.row("design").getAttribute("aria-expanded")).toBe("false");
        expect(await chevronAngle(tree.chevron("design"))).toBe(0);
        expect(await shownIds(tree)).toEqual(["design", "build", "portal", "billing", "reporting"]);
        expect(await pressIn(board, "ArrowDown")).toEqual({ nodeId: "build" });
        expect(await pressIn(board, "ArrowUp")).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "ArrowRight")).toEqual({ nodeId: "design" });
        expect(await tree.row("design").getAttribute("aria-expanded")).toBe("true");
        expect(await chevronAngle(tree.chevron("design"))).toBe(90);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        // Right on an open row enters its cells; Left on the name goes back to the row.
        await expectSteps(run, tree, [
          ["ArrowRight", { nodeId: "design", cell: 0 }],
          ["ArrowRight", { nodeId: "design", cell: 1 }],
          ["End", { nodeId: "design", cell: 3 }],
          ["ArrowRight", { nodeId: "design", cell: 3 }],
          ["Home", { nodeId: "design", cell: 0 }],
          ["ArrowLeft", { nodeId: "design" }],
          // On a leaf, Right enters the cells, Up and Down keep the column, Left goes to the parent.
          ["ArrowDown", { nodeId: "ux" }],
          ["ArrowRight", { nodeId: "ux", cell: 0 }],
          ["ArrowRight", { nodeId: "ux", cell: 1 }],
          ["ArrowDown", { nodeId: "architecture", cell: 1 }],
        ]);
        expect(await focusRing(board)).toEqual(RING);
        await expectSteps(run, tree, [
          ["ArrowLeft", { nodeId: "architecture", cell: 0 }],
          ["ArrowLeft", { nodeId: "architecture" }],
          ["ArrowLeft", { nodeId: "design" }],
        ]);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(board.page.url()).toBe(url);
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click on a chevron collapses and expands its node, and a focus it hides moves to the node",
      async () => {
        const run = await host(dist, treeBoardDocument);
        await readyIn(run);
        const { board } = run;
        const tree = treeGridOf(board);
        expect(await tabIntoTree(board, plan.props.text)).toEqual({ nodeId: "design" });
        expect(await pressIn(board, "End")).toEqual({ nodeId: "reporting" });
        await tree.chevron("build").click();
        expect(await tree.row("build").getAttribute("aria-expanded")).toBe("false");
        expect(await chevronAngle(tree.chevron("build"))).toBe(0);
        expect(await shownIds(tree)).toEqual([
          "design",
          "ux",
          "architecture",
          "prototype",
          "build",
        ]);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        expect(await tabStops(tree.grid)).toBe(1);
        await tree.chevron("build").click();
        expect(await tree.row("build").getAttribute("aria-expanded")).toBe("true");
        expect(await chevronAngle(tree.chevron("build"))).toBe(90);
        expect(await shownIds(tree)).toEqual(FIXTURE_IDS);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        // A chevron collapsing a branch that does not hold the focus leaves the focus alone.
        await tree.chevron("design").click();
        expect(await shownIds(tree)).toEqual(["design", "build", "portal", "billing", "reporting"]);
        expect(await treeFocus(board)).toEqual({ nodeId: "build" });
        await expectUnchanged(run);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

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
      "a 200-node Tree becomes visible within the load timeout, every row in its treegrid",
      async () => {
        const started = performance.now();
        const run = await host(dist, largeTreeDocument);
        await readyIn(run);
        const visibleAfter = Math.round(performance.now() - started);
        console.info(`${engine}: the 200-node Tree became visible in ${visibleAfter} ms`);
        expect(visibleAfter).toBeLessThan(LOAD_TIMEOUT_MS);
        const tree = treeGridOf(run.board);
        expect(await tree.rows.count()).toBe(200);
        expect(await tree.grid.getByRole("row").count()).toBe(201);
        expect(run.browser.errors).toEqual([]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
