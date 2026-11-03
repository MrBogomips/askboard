// The `molecule-source` adapter (AD-9, AD-12; molecules design decision 5): `ask-core`'s
// `MoleculeSource` port over the definitions AskBoard ships. They are imported JSON, bundled into
// the executable, so the adapter reads no file and opens no connection (AD-11, NFR-9). Nothing is
// read or checked until the first lookup (AD-2); a molecule's first lookup checks that molecule's
// definitions against the contract's definition format and keeps the outcome.

import { MOLECULE_VERSION_PATTERN, type MoleculeDefinition } from "@askboard/contract";
import { validateMoleculeDefinition } from "@askboard/contract/validate";
import type { MoleculeLookup, MoleculeSource } from "@askboard/core";
import { READY_MOLECULES } from "@askboard/molecules";

const VERSION = new RegExp(MOLECULE_VERSION_PATTERN);

type Version = readonly [number, number, number];

const versionOf = (text: string): Version | undefined => {
  const parts = VERSION.exec(text);
  return parts === null ? undefined : [Number(parts[1]), Number(parts[2]), Number(parts[3])];
};

const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// Sorts a version the schema refuses after every other; its definition is broken, so never served.
const UNREADABLE: Version = [Number.POSITIVE_INFINITY, 0, 0];

type Shipped = { readonly definition: MoleculeDefinition; readonly version: Version };

/** A molecule's definitions once checked, by version from the lowest, or why none is served. */
type Outcome =
  | { readonly ok: true; readonly shipped: readonly Shipped[]; readonly versions: string[] }
  | { readonly ok: false; readonly versions: string[]; readonly detail: string };

/** Why `definition` fails the contract's checks, naming the molecule and each problem's path. */
const brokenDetail = (definition: MoleculeDefinition): string | undefined => {
  const checked = validateMoleculeDefinition(definition);
  if (checked.ok) return undefined;
  const name = `${definition.molecule} ${definition.version}`;
  return checked.problems
    .map(
      ({ path, message }) => `${name} fails the definition format's checks at ${path}: ${message}`,
    )
    .join("; ");
};

// A molecule any of whose definitions fails the checks serves none of them (fail closed, NFR-10):
// the shipped set is broken, and a version that fails cannot be told apart reliably.
const check = (definitions: readonly MoleculeDefinition[]): Outcome => {
  const shipped = definitions
    .map((definition) => ({ definition, version: versionOf(definition.version) ?? UNREADABLE }))
    .sort((a, b) => compare(a.version, b.version));
  const versions = shipped.map(({ definition }) => definition.version);
  const broken = definitions.map(brokenDetail).find((detail) => detail !== undefined);
  return broken === undefined
    ? { ok: true, shipped, versions }
    : { ok: false, versions, detail: broken };
};

// Without a version, the highest shipped one; with one, the highest of its major at or above it.
const resolve = (shipped: readonly Shipped[], asked: string | undefined) => {
  const wanted = asked === undefined ? undefined : versionOf(asked);
  if (asked !== undefined && wanted === undefined) return undefined;
  return shipped.findLast(
    ({ version }) =>
      wanted === undefined || (version[0] === wanted[0] && compare(version, wanted) >= 0),
  );
};

/**
 * The molecule source over `definitions`, by default every molecule AskBoard ships. A lookup
 * gives the definition the version rule selects, once its molecule's definitions have passed the
 * contract's checks; never a definition that failed them.
 */
export const createMoleculeSource = (
  definitions: readonly MoleculeDefinition[] = READY_MOLECULES,
): MoleculeSource => {
  let byMolecule: ReadonlyMap<string, readonly MoleculeDefinition[]> | undefined;
  const outcomes = new Map<string, Outcome>();

  const indexed = () => {
    if (byMolecule !== undefined) return byMolecule;
    const index = new Map<string, MoleculeDefinition[]>();
    for (const definition of definitions) {
      const { molecule } = definition;
      index.set(molecule, [...(index.get(molecule) ?? []), definition]);
    }
    byMolecule = index;
    return index;
  };

  const outcomeOf = (molecule: string): Outcome | undefined => {
    const own = indexed().get(molecule);
    if (own === undefined) return undefined;
    const outcome = outcomes.get(molecule) ?? check(own);
    outcomes.set(molecule, outcome);
    return outcome;
  };

  return {
    lookup: (molecule, version): MoleculeLookup => {
      const outcome = outcomeOf(molecule);
      if (outcome === undefined) {
        const names = [...indexed().keys()].sort();
        return { found: false, reason: "unknown-molecule", shipped: names };
      }
      if (!outcome.ok) {
        return {
          found: false,
          reason: "broken",
          shipped: outcome.versions,
          detail: outcome.detail,
        };
      }
      const chosen = resolve(outcome.shipped, version);
      if (chosen === undefined) {
        return { found: false, reason: "unknown-version", shipped: outcome.versions };
      }
      return { found: true, definition: chosen.definition };
    },
  };
};
