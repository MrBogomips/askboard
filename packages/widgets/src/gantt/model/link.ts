// A Gantt plan's link to its Tree (design decision 9, AD-10): the plan's `workPackages` names a Tree
// whose columns declare the three estimates as numbers, and the plan's tasks are that Tree's
// leaves. Nothing checked the link on its way to the view, so the component checks it with the
// contract's `ganttPlanLinkProblems` and throws on a problem, so that the item's error boundary
// fails it. The contract checks a plan against its question; the port gives the board's items
// flattened, with no question's bounds, so the view checks it against all of them. On a board of
// one question that is the same check; across questions, the input format's send-time check is
// the one that refuses a plan naming another question's Tree. Plain ECMAScript.

import {
  ganttPlanLinkProblems,
  type TreeItem,
  type TreeNode,
  type TreeProps,
} from "@askboard/contract";
import type { BoardContent } from "@askboard/view/catalog";

/** A board item as the port gives it: its type, its ID and its props, as sent. */
type Item = { readonly type: string; readonly id: string; readonly props: unknown };

/**
 * The Tree a plan's item names among the board's items, once the link has no problem; else it
 * throws, naming the plan and each problem.
 */
export const linkedTree = (plan: Item, items: readonly Item[]): TreeItem => {
  const problems = ganttPlanLinkProblems(plan, { props: { items } });
  if (problems.length > 0) {
    const listed = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Gantt plan "${plan.id}" refuses its link: ${listed}`);
  }
  const { workPackages } = plan.props as { readonly workPackages: string };
  // The contract's check found it: the first item of that ID, a Tree.
  return items.find((item) => item.id === workPackages) as TreeItem;
};

/**
 * The Tree's nodes as the board shows them (molecules, design decision 11): the draft's, once the
 * user edited the Tree, else its question's latest answer's, else as sent. Either holds what the
 * Tree's component put in the draft record, its full props.
 */
export const treeNodesOf = (
  tree: TreeItem,
  board: Pick<BoardContent, "shown">,
): readonly TreeNode[] => ((board.shown.get(tree.id) as TreeProps | undefined) ?? tree.props).nodes;
