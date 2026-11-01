// The `MoleculeSource` port (AD-9, AD-12; molecules design decision 5): how `ask-core` gets a
// molecule's definition. The `molecule-source` adapter serves the shipped definitions through it,
// each checked before it is used. `CorePorts` gains it when an ask's expansion is wired in.

import type { MoleculeDefinition } from "@askboard/contract";

/**
 * The outcome of a lookup. Found: a definition that passed the contract's definition checks.
 * Not found: why, and what is shipped, so the refusal can say it: for `unknown-molecule` the
 * shipped molecules' names, otherwise the shipped versions of the named molecule; `detail` says
 * what is wrong with a `broken` definition.
 */
export type MoleculeLookup =
  | { readonly found: true; readonly definition: MoleculeDefinition }
  | {
      readonly found: false;
      readonly reason: "unknown-molecule" | "unknown-version" | "broken";
      readonly shipped: readonly string[];
      readonly detail?: string;
    };

/**
 * `molecule-source`: a molecule's definition by name and version. Without `version`, the highest
 * shipped version of the molecule's current major; with one, the highest shipped version of that
 * major at or above it.
 */
export type MoleculeSource = {
  lookup(molecule: string, version?: string): MoleculeLookup;
};
