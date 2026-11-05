// The molecules AskBoard ships ready-made (AD-9, FR-15): each a definition in `contract`'s molecule
// format, data only, with no code. Its parameters, the JSON Schema an agent's data fills, reference
// the contract's widget schemas by `$id`; its one item and its fills say what the reference becomes.
// The expansion is `ask-core`'s, through the `MoleculeSource` port that `molecule-source` serves.

import type { MoleculeDefinition } from "@askboard/contract";
import ganttPlan from "./gantt-plan/gantt-plan.json" with { type: "json" };
import wbsPert from "./wbs-pert/wbs-pert.json" with { type: "json" };

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

// A JSON module carries no tuple or literal types: each file is typed as the format it is written
// in, which the contract's checks confirm.
const asDefinition = (json: unknown): MoleculeDefinition => json as MoleculeDefinition;

/**
 * Every molecule AskBoard ships, one version per major of each: the Gantt plan (gantt-widget,
 * design decision 6) and the WBS with PERT, frozen. The contract's checks pass on each (their
 * tests); `molecule-source` checks each again on its first lookup.
 */
export const READY_MOLECULES: readonly MoleculeDefinition[] = deepFreeze([
  asDefinition(ganttPlan),
  asDefinition(wbsPert),
]);
