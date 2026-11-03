// The work breakdown's browser fixtures (molecules design decision 15): the expanded UJ-2 question
// as `ask-core`'s expansion gives it, its Tree `wbs__tree` with `pert` beside the plan
// `schedule__plan`, and variants of it with other Tree props: another opening depth, a single
// top-level package, agent markup in a name. Also where the WBS's own parts are found: the Total
// row, the one row of the treegrid with no node, carries `data-total-row`.

import type { TreeNode, TreePertProps } from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { TreeGrid } from "../harness/tree-grid.ts";

/** The expanded UJ-2 question `plan`, and its Tree and plan. */
export const [wbsQuestion] = uj2ExpandedBoardDocument.items;
export const [wbsTree, wbsPlan] = wbsQuestion.props.items;

/** The expanded UJ-2 document, its Tree with `props` and the plan as expanded. */
export const wbsDocumentWith = (props: TreePertProps): ViewDocument => ({
  ...uj2ExpandedBoardDocument,
  items: [
    {
      ...wbsQuestion,
      props: { ...wbsQuestion.props, items: [{ ...wbsTree, props }, wbsPlan] },
    },
  ],
});

/** The UJ-2 work breakdown opening one level deep. */
export const oneLevelDocument = wbsDocumentWith({ ...wbsTree.props, openDepth: 1 });

/** The UJ-2 work breakdown under a single top-level package, `project`. */
export const oneTopLevelDocument = wbsDocumentWith({
  ...wbsTree.props,
  nodes: [{ id: "project", label: "Customer portal SOW", children: wbsTree.props.nodes }],
});

const renamed = (nodes: readonly TreeNode[], id: string, label: string): TreeNode[] =>
  nodes.map((node) => ({
    ...node,
    ...(node.id === id ? { label } : {}),
    ...(node.children === undefined ? {} : { children: renamed(node.children, id, label) }),
  }));

/** The UJ-2 work breakdown whose UX design package is named `label`. */
export const uxNamedDocument = (label: string): ViewDocument =>
  wbsDocumentWith({ ...wbsTree.props, nodes: renamed(wbsTree.props.nodes, "ux", label) });

/** The header row's column names (provisional labels: EXPERIENCE, Copy, WBS with PERT). */
export const WBS_HEADERS = [
  "Work package",
  "Optimistic",
  "Most likely",
  "Pessimistic",
  "Expected effort",
  "Spread",
];

/** The work breakdown's Total row, the last row of its treegrid. */
export const totalRow = (tree: TreeGrid): Locator => tree.grid.locator("[data-total-row]");

/** The texts of a row's cells, in order. */
export const cellTexts = (row: Locator): Promise<string[]> =>
  row.getByRole("gridcell").allTextContents();
