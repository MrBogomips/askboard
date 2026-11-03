// The molecules AskBoard ships ready-made (AD-9, FR-15): each is data, the parameters an agent
// fills as a JSON Schema, and holds no code. The parameters reference the contract's widget
// schemas by `$id`; the expansion is `ask-core`'s, in the molecules epic.

import ganttPlan from "./gantt-plan/gantt-plan.json" with { type: "json" };

/** A ready-made molecule: its name, its version and the JSON Schema of its parameters. */
type ReadyMolecule = {
  readonly molecule: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, unknown>>;
};

/** Every molecule AskBoard ships: the Gantt plan (gantt-widget, design decision 6). */
export const READY_MOLECULES: readonly ReadyMolecule[] = Object.freeze([ganttPlan]);
