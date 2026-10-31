// Test-only board documents holding a Tree (tree-widget design decision 9): the fixture Tree's
// document with other props for its Tree `wbs`, which the Tree checks itself as an agent's, and
// FR-20's 200-node Tree. Only the widget host shows them: the board page refuses a Tree for now.

import type { TreeNode, TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";

const [plan] = treeBoardDocument.items;
const [wbs] = plan.props.items;

/** The fixture Tree's document, its question `plan` holding the Tree `wbs` with `props`. */
export const treeDocumentWith = (props: unknown): ViewDocument => ({
  ...treeBoardDocument,
  items: [{ ...plan, props: { ...plan.props, items: [{ ...wbs, props }] } }],
});

const task = (pack: number, at: number): TreeNode => ({
  id: `p${pack}t${at}`,
  label: `Task ${pack}.${at}`,
  optimistic: 1,
  mostLikely: 2,
  pessimistic: 3,
});

/** `packages` top-level nodes of `tasks` leaves each, with the fixture's three number columns. */
export const packagesTree = (packages: number, tasks: number): TreeProps => ({
  columns: wbs.props.columns,
  nodes: Array.from({ length: packages }, (_, p) => ({
    id: `p${p + 1}`,
    label: `Package ${p + 1}`,
    children: Array.from({ length: tasks }, (_, t) => task(p + 1, t + 1)),
  })),
});

/** FR-20's example size: 10 packages of 19 tasks, 200 nodes. */
export const largeTreeDocument: ViewDocument = treeDocumentWith(packagesTree(10, 19));
