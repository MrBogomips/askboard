// The Tree's scenarios, in each engine, on the widget host (design decisions 6 and 9 of the
// tree-widget change), since the board page refuses a board document holding a Tree until the
// input format admits one. The fixture Tree's question counts as visible with no CSP violation,
// and a Tree whose props fail the contract's checks fails its question (AD-10).

import { describe, expect, test } from "bun:test";
import { type TreeNode, treePropsProblems } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../src/view-document.ts";
import { eventually, LOAD_TIMEOUT_MS, QUIET_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

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
const refusedTree: ViewDocument = {
  ...treeBoardDocument,
  items: [{ ...plan, props: { ...plan.props, items: [{ ...wbs, props: refusedProps }] } }],
};

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
  });
}
