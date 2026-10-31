// Test-only board documents holding a Tree (tree-widget design decision 9): the fixture Tree's
// document with other props for its Tree `wbs`, which the Tree checks itself as an agent's, and
// FR-20's 200-node Tree; and the fixture Tree's value after an edit, as an answer carries it. Only
// the widget host shows them: the board page refuses a Tree for now.

import type { TreeNode, TreeProps } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";

/** The fixture's question `plan`, and the Tree `wbs` it holds. */
export const [plan] = treeBoardDocument.items;
export const [wbs] = plan.props.items;

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

/** A Tree with the fixture's columns and no node, which the contract allows. */
export const emptyTreeDocument: ViewDocument = treeDocumentWith({
  columns: wbs.props.columns,
  nodes: [],
});

/** A Tree at the contract's node limit: 25 packages of 19 tasks, 500 nodes. */
export const fullTreeDocument: ViewDocument = treeDocumentWith(packagesTree(25, 19));

// The chain `<prefix><level>` … `<prefix><depth>`, each node the only child of the one before.
const chain = (prefix: string, level: number, depth: number): TreeNode => ({
  id: `${prefix}${level}`,
  label: `Level ${level}`,
  ...(level < depth ? { children: [chain(prefix, level + 1, depth)] } : {}),
});

/** A Tree at the contract's depth limit: `l1` to `l8`, each the only child of the one before. */
export const deepTreeDocument: ViewDocument = treeDocumentWith({
  columns: wbs.props.columns,
  nodes: [chain("l", 1, 8)],
});

/** A leaf `leaf`, then the chain `b1` to `b8`, which an indent would take past the depth limit. */
export const tallBranchTreeDocument: ViewDocument = treeDocumentWith({
  columns: wbs.props.columns,
  nodes: [{ id: "leaf", label: "Leaf" }, chain("b", 1, 8)],
});

/** The fixture Tree with `build`'s children as `change` makes them. */
export const withBuild = (
  change: (children: readonly TreeNode[]) => readonly TreeNode[],
): TreeProps => ({
  ...wbs.props,
  nodes: wbs.props.nodes.map((node) =>
    node.id === "build" ? { ...node, children: change(node.children ?? []) } : node,
  ),
});

/** The fixture Tree with `portal`'s fields or name changed, as the answer's value must hold it. */
export const withPortal = (change: Readonly<Record<string, string | number>>): TreeProps => ({
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
