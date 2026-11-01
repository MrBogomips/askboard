// The Tree's layout scenarios, in each engine, on the widget host (design decisions 6 and 9 of
// the tree-widget change), since the board page refuses a board document holding a Tree until the
// input format admits one. The fixture Tree's question counts as visible with no CSP violation,
// and a Tree whose props fail the contract's checks fails its question (AD-10). The Tree is a
// treegrid in the widget frame: its column names, one row per node, indented per level, with a
// chevron on a parent and numbers right-aligned; agent strings show as text (AD-8); a 200-node
// Tree becomes visible within the load timeout.

import { describe, expect, test } from "bun:test";
import { type TreeNode, treePropsProblems } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { MARKUP_LABEL } from "./fixtures/markup-document.ts";
import { MARKUP_NOTE, markupTreeDocument } from "./fixtures/markup-tree-document.ts";
import { largeTreeDocument, plan, treeDocumentWith, wbs } from "./fixtures/tree-documents.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { chevronAngle, nameLefts, rightGaps, treeGridOf } from "./harness/tree-grid.ts";
import { FIXTURE_ROWS, readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const namesOf = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) => [node.label, ...namesOf(node.children ?? [])]);

// The fixture Tree with a node only the view may add: `u-` IDs are refused from the agent (design
// decision 11), so the Tree's own check fails it.
const refusedProps = {
  ...wbs.props,
  nodes: [...wbs.props.nodes, { id: "u-1", label: "Added by the agent" }],
};
const refusedTree: ViewDocument = treeDocumentWith(refusedProps);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Tree's layout`, () => {
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
