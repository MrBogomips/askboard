// The Gantt plan's expansion, for tests only (gantt-widget, design decision 6; molecules spec, "The
// Gantt plan's expansion"). `ask-core` expands molecule references in the molecules epic, through
// `MoleculeSource`; this applies the same rule to a reference: one Gantt plan item under the
// reference's ID, with the data's `workPackages` and `start`, and a `tasks` map holding, for each
// key of `dependencies`, an entry with that task's predecessors.

/** The `gantt-plan` data an agent sends, as its parameters describe it. */
export type GanttPlanData = {
  readonly workPackages: string;
  readonly start: string;
  readonly dependencies?: Readonly<Record<string, readonly string[]>>;
};

export type GanttPlanReference = {
  readonly type: "molecule";
  readonly id: string;
  readonly props: { readonly molecule: "gantt-plan"; readonly data: GanttPlanData };
};

/** The Gantt plan item a `gantt-plan` reference expands to. */
export const expandGanttPlan = ({ id, props: { data } }: GanttPlanReference) => ({
  type: "gantt" as const,
  id,
  props: {
    workPackages: data.workPackages,
    start: data.start,
    tasks: Object.fromEntries(
      Object.entries(data.dependencies ?? {}).map(([task, dependencies]) => [
        task,
        { dependencies: [...dependencies] },
      ]),
    ),
  },
});
