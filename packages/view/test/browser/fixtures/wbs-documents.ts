// The work breakdown's browser fixtures (molecules design decision 15): the expanded UJ-2 question
// as `ask-core`'s expansion gives it, its Tree `wbs__tree` with `pert` beside the plan
// `schedule__plan`, and variants of it with other Tree props: another opening depth, a single
// top-level package, agent markup in a name. Also where the WBS's own parts are found: the Total
// row, the one row of the treegrid with no node, carries `data-total-row`. For the linked edits: a
// variant whose plan leaves Clickable prototype at its limit of dependents, the board state of the
// question answered with an edited plan, and the item values the view's latest draft mirror holds.

import {
  GANTT_MAX_DEPENDENTS,
  type GanttPlanEntry,
  type LifecycleBoardState,
  type TreeNode,
  type TreePertProps,
} from "@askboard/contract";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { Locator } from "playwright";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { AnswerContent, ViewDraft } from "../../../src/view-protocol.ts";
import type { TreeGrid } from "../harness/tree-grid.ts";
import type { WidgetHostRun } from "../harness/widget-host-test.ts";

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

/** The plan's props as sent, its entries by task. */
type PlanProps = { readonly tasks: Readonly<Record<string, GanttPlanEntry>> };
export const SENT_PLAN = wbsPlan.props as PlanProps & Readonly<Record<string, unknown>>;

/** The plan with `tasks` added to, or in place of, its entries as sent. */
export const planWith = (tasks: Readonly<Record<string, GanttPlanEntry>>) => ({
  ...SENT_PLAN,
  tasks: { ...SENT_PLAN.tasks, ...tasks },
});

// The leaves `t-1`… under a last top-level package `extra`, each estimated at a day, and the plan
// entries making each depend on Clickable prototype.
const EXTRA_COUNT = GANTT_MAX_DEPENDENTS - 1;
const EXTRA_IDS = Array.from({ length: EXTRA_COUNT }, (_, at) => `t-${at + 1}`);

/**
 * The UJ-2 question whose plan gives Clickable prototype the most dependents a task can have: the
 * portal and 49 extra leaves.
 */
export const crowdedDocument: ViewDocument = (() => {
  const extra: TreeNode = {
    id: "extra",
    label: "Extra",
    children: EXTRA_IDS.map((id) => ({
      id,
      label: `Extra ${id}`,
      optimistic: 1,
      mostLikely: 1,
      pessimistic: 1,
    })),
  };
  const tree = { ...wbsTree, props: { ...wbsTree.props, nodes: [...wbsTree.props.nodes, extra] } };
  const tasks = Object.fromEntries(EXTRA_IDS.map((id) => [id, { dependencies: ["prototype"] }]));
  const plan = { ...wbsPlan, props: planWith(tasks) };
  return {
    ...uj2ExpandedBoardDocument,
    items: [{ ...wbsQuestion, props: { ...wbsQuestion.props, items: [tree, plan] } }],
  };
})();

/** The board state with the question answered and delivered, its answer holding `values`. */
export const answeredStateOf = (values: Readonly<Record<string, unknown>>): LifecycleBoardState => {
  const answer: AnswerContent & { readonly when: string; readonly receipt: "delivered" } = {
    values,
    when: "2026-11-03T10:00:00Z",
    receipt: "delivered",
  };
  return {
    ask: "answered",
    questions: [{ itemId: wbsQuestion.id, rev: wbsQuestion.rev, state: "answered", answer }],
  };
};

/** The item values of the question in the view's latest draft mirror; none before any. */
export const draftValues = (run: WidgetHostRun): Readonly<Record<string, unknown>> => {
  const last = run.drafts.at(-1) as ViewDraft | undefined;
  return last?.record.questions[wbsQuestion.id]?.values ?? {};
};
