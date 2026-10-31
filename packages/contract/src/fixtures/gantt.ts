// The Gantt's fixtures (gantt-widget, design decision 4), for tests only. A board document whose
// question holds a Gantt with its own tasks: UJ-2's six work packages with the durations the UJ-2
// plan computes from their estimates, and its four dependencies, so that it schedules as the plan
// does; and that Gantt after two edits. Their type is E1's board document with a question that
// holds widget items, as the view document reads it, written here until the input format admits
// widgets.

import {
  BOARD_DOCUMENT_VERSION,
  type BoardDocument,
  type BoardQuestion,
} from "../schemas/board-document/index.ts";
import type { QuestionProps } from "../schemas/input/index.ts";
import type { GanttItem, GanttOwnTask } from "../widgets/gantt/index.ts";

type GanttQuestion = Omit<BoardQuestion, "props"> & {
  readonly props: Omit<QuestionProps, "options"> & { readonly items: readonly [GanttItem] };
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
