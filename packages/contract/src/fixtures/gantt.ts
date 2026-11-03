// The Gantt's fixtures (gantt-widget, design decision 4), for tests only. A board document whose
// question holds a Gantt with its own tasks: UJ-2's six work packages with the durations the UJ-2
// plan computes from their estimates, and its four dependencies, so that it schedules as the plan
// does; and that Gantt after two edits. Then the UJ-2 plan: the Tree's question with the approved
// `gantt-plan` data as the Gantt plan its expansion gives, under the reference's ID, the plan
// after the approved answer's edit, that edit's changes and the answer's derived values. Their
// type is E1's board document with a question that holds widget items, as the view document reads
// it, written here until the input format admits widgets.

import {
  BOARD_DOCUMENT_VERSION,
  type BoardDocument,
  type BoardQuestion,
} from "../schemas/board-document/index.ts";
import type { QuestionProps } from "../schemas/input/index.ts";
import type { GanttChange, GanttItem, GanttOwnTask, GanttProps } from "../widgets/gantt/index.ts";
import type { TreeItem } from "../widgets/tree/index.ts";
import { type TreeBoardDocument, treeBoardDocument } from "./tree.ts";

type GanttQuestion = Omit<BoardQuestion, "props"> & {
  readonly props: Omit<QuestionProps, "options" | "items"> & {
    readonly items: readonly [GanttItem];
  };
};

export type GanttBoardDocument = Omit<BoardDocument, "items"> & {
  readonly items: readonly [GanttQuestion];
};

const RELEASE_TASKS: readonly GanttOwnTask[] = [
  { id: "ux", label: "UX design", duration: 6 },
  { id: "architecture", label: "Architecture", duration: 4 },
  { id: "prototype", label: "Clickable prototype", duration: 5, dependencies: ["ux"] },
  {
    id: "portal",
    label: "Customer portal",
    duration: 13,
    dependencies: ["architecture", "prototype"],
  },
  { id: "billing", label: "Billing integration", duration: 9, dependencies: ["architecture"] },
  { id: "reporting", label: "Reporting", duration: 6, dependencies: ["portal"] },
];

export const ganttBoardDocument: GanttBoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  askId: "portal-release-schedule-r4n8",
  title: "Does this release schedule hold?",
  items: [
    {
      type: "question",
      id: "schedule-review",
      rev: 1,
      props: {
        text: "Does this release schedule hold? Move tasks or change durations as needed.",
        header: "Schedule",
        items: [
          { type: "gantt", id: "release", props: { start: "2026-11-02", tasks: RELEASE_TASKS } },
        ],
      },
    },
  ],
};

/** The Gantt `release` after two edits: billing lasts 11 days, reporting asked for 2026-12-09. */
export const ganttEditedValue = {
  start: "2026-11-02",
  tasks: RELEASE_TASKS.map((task) => {
    if (task.id === "billing") return { ...task, duration: 11 };
    if (task.id === "reporting") return { ...task, start: "2026-12-09" };
    return task;
  }),
} as const;

/** A Gantt plan's props: its tasks by ID, their names, durations and order from its Tree. */
type GanttPlanProps = Extract<GanttProps, { readonly workPackages: string }>;

type TreeQuestion = TreeBoardDocument["items"][0];

type GanttPlanQuestion = Omit<TreeQuestion, "props"> & {
  readonly props: Omit<TreeQuestion["props"], "items"> & {
    readonly items: readonly [TreeItem, GanttItem];
  };
};

/** E1's board document whose one question holds a Tree and a Gantt plan over it. */
export type GanttPlanBoardDocument = Omit<BoardDocument, "items"> & {
  readonly items: readonly [GanttPlanQuestion];
};

// The approved `gantt-plan` data expanded (design decision 6): each key of its `dependencies` an
// entry holding that task's predecessors.
const PLAN: GanttPlanProps = {
  start: "2026-11-02",
  workPackages: "wbs",
  tasks: {
    prototype: { dependencies: ["ux"] },
    portal: { dependencies: ["architecture", "prototype"] },
    billing: { dependencies: ["architecture"] },
    reporting: { dependencies: ["portal"] },
  },
};

const [TREE_QUESTION] = treeBoardDocument.items;
const [WBS] = TREE_QUESTION.props.items;

/** The UJ-2 plan at rev 1: the Tree's question `plan` with the Gantt plan `schedule` appended. */
export const ganttPlanBoardDocument: GanttPlanBoardDocument = {
  ...treeBoardDocument,
  items: [
    {
      ...TREE_QUESTION,
      props: {
        ...TREE_QUESTION.props,
        items: [WBS, { type: "gantt", id: "schedule", props: PLAN }],
      },
    },
  ],
};

/** The plan after the approved answer's edit: the package the user added in the Tree, linked. */
export const ganttPlanEditedValue: GanttPlanProps = {
  ...PLAN,
  tasks: { ...PLAN.tasks, "u-1": { dependencies: ["architecture", "prototype"] } },
};

/** The approved answer's operation on the plan, the diff of the plan as sent and as edited. */
export const ganttPlanChanges: readonly GanttChange[] = [
  { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
];

/**
 * The approved answer's derived values of the plan, by `GANTT_ANSWER_DERIVED`: what `compute` gives
 * over the edited Tree and plan.
 */
export const ganttPlanDerived: Readonly<Record<string, unknown>> = {
  "schedule.finish": "2026-12-02",
  "schedule.criticalPath": ["ux", "prototype", "portal", "reporting"],
};
