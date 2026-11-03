// The molecules' fixtures (molecules design decision 9), for tests only: the UJ-2 question `plan`
// as `ask-core`'s expansion gives it, its `wbs` reference become the Tree `wbs__tree` with `pert`
// and an opening depth of 2, and its `schedule` reference the Gantt plan `schedule__plan` over it;
// a board document holding that question; both items' values after the approved answer's edits;
// and the approved answer's fourteen derived values under the expanded IDs. Built on the Tree's
// and the Gantt's fixtures. Answers name the references, `wbs` and `schedule`: `ask-core` maps
// between the two (AD-9).

import type { QuestionProps } from "../schemas/input/index.ts";
import type { GanttItem, GanttProps } from "../widgets/gantt/index.ts";
import type { TreePertProps } from "../widgets/tree/index.ts";
import { ganttPlanBoardDocument, ganttPlanDerived, ganttPlanEditedValue } from "./gantt.ts";
import { treeEditedValue } from "./tree.ts";

/** A Tree item with `pert`, the item `wbs-pert` composes. */
export type TreePertItem = {
  readonly type: "tree";
  readonly id: string;
  readonly props: TreePertProps;
};

/** The UJ-2 question as the expansion gives it: the expanded Tree, then the expanded plan. */
export type Uj2ExpandedQuestion = {
  readonly type: "question";
  readonly id: string;
  readonly props: Omit<QuestionProps, "options"> & {
    readonly items: readonly [TreePertItem, GanttItem];
  };
};

type Uj2BoardQuestion = Uj2ExpandedQuestion & { readonly rev: number };

/** A board document whose one question is the expanded UJ-2 question, at rev 1. */
export type Uj2ExpandedBoardDocument = Omit<typeof ganttPlanBoardDocument, "items"> & {
  readonly items: readonly [Uj2BoardQuestion];
};

const TREE_ID = "wbs__tree";
const PLAN_ID = "schedule__plan";

const [PLAN_QUESTION] = ganttPlanBoardDocument.items;
const [WBS, SCHEDULE] = PLAN_QUESTION.props.items;
const { rev, ...QUESTION } = PLAN_QUESTION;

/** What `wbs-pert`'s composition adds to the Tree: PERT, and two levels open at first. */
const WBS_PERT = { pert: true, openDepth: 2 } as const;

const TREE: TreePertItem = { type: "tree", id: TREE_ID, props: { ...WBS.props, ...WBS_PERT } };
/** A Gantt plan's props, which name its Tree; the Gantt's fixture plan is one. */
type GanttPlanProps = Extract<GanttProps, { readonly workPackages: string }>;
const SENT_PLAN = SCHEDULE.props as GanttPlanProps;
const PLAN: GanttItem = {
  type: "gantt",
  id: PLAN_ID,
  props: { ...SENT_PLAN, workPackages: TREE_ID },
};

/** The UJ-2 question `plan`, its references `wbs` and `schedule` expanded. */
export const uj2ExpandedQuestion: Uj2ExpandedQuestion = {
  ...QUESTION,
  props: { ...QUESTION.props, items: [TREE, PLAN] },
};

/** The UJ-2 plan at rev 1, its question as the expansion gives it. */
export const uj2ExpandedBoardDocument: Uj2ExpandedBoardDocument = {
  ...ganttPlanBoardDocument,
  items: [{ ...uj2ExpandedQuestion, rev }],
};

/** Both items as the approved answer's edits leave them: the Tree split, the plan with `u-1`. */
export const uj2ExpandedEditedValues: Readonly<Record<string, unknown>> = {
  [TREE_ID]: { ...treeEditedValue, ...WBS_PERT },
  [PLAN_ID]: { ...ganttPlanEditedValue, workPackages: TREE_ID },
};

/**
 * The approved answer's derived values under the expanded IDs: the work breakdown's twelve, the
 * nodes that changed and the item's totals to two decimals (F7), then the plan's.
 */
export const uj2ExpandedDerived: Readonly<Record<string, unknown>> = {
  [`${TREE_ID}.ux.expected`]: 4.83,
  [`${TREE_ID}.portal.expected`]: 6.33,
  [`${TREE_ID}.portal.spread`]: 1,
  [`${TREE_ID}.u-1.expected`]: 7.33,
  [`${TREE_ID}.u-1.spread`]: 1.33,
  [`${TREE_ID}.billing.expected`]: 9.67,
  [`${TREE_ID}.billing.spread`]: 2.67,
  [`${TREE_ID}.design.expected`]: 13.33,
  [`${TREE_ID}.build.expected`]: 28.67,
  [`${TREE_ID}.build.spread`]: 3.3,
  [`${TREE_ID}.expected`]: 42,
  [`${TREE_ID}.spread`]: 3.66,
  ...Object.fromEntries(
    Object.entries(ganttPlanDerived).map(([key, value]) => [
      key.replace(/^schedule\./, `${PLAN_ID}.`),
      value,
    ]),
  ),
};
