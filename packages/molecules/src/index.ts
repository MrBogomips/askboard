// The molecules AskBoard ships ready-made (AD-9, FR-15): each a definition in `contract`'s molecule
// format, data only, with no code. Its parameters, the JSON Schema an agent's data fills, reference
// the contract's widget schemas by `$id`; its one item and its fills say what the reference becomes.
// The expansion is `ask-core`'s, through the `MoleculeSource` port that `molecule-source` serves.

import type { MoleculeDefinition } from "@askboard/contract";
import ganttPlan from "./gantt-plan/gantt-plan.json" with { type: "json" };
import ganttPlanSkill from "./gantt-plan/skill.json" with { type: "json" };
import wbsPertSkill from "./wbs-pert/skill.json" with { type: "json" };
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

/** What the generated skill teaches of one ready molecule (askboard-skills, design decision 3). */
export type MoleculeSkill = {
  /** When to use the molecule, 1 to 200 characters. */
  readonly use: string;
  /** The `data` of a reference to it, as an agent sends it. */
  readonly example: unknown;
  /**
   * The molecule whose item the example names: the ID of that item in the same question and the
   * molecule that supplies it (a Gantt plan takes its tasks from a work breakdown).
   */
  readonly companion?: { readonly molecule: string; readonly id: string };
};

/**
 * The teaching data of every ready molecule, keyed by molecule name, frozen: when to use it and
 * an example of the data an agent sends (each checked by this package's tests against the
 * definition's parameters and the reference's checks).
 */
export const MOLECULE_SKILLS: Readonly<Record<string, MoleculeSkill>> = deepFreeze({
  "gantt-plan": ganttPlanSkill,
  "wbs-pert": wbsPertSkill,
});
