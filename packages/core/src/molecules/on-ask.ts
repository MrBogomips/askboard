// Expansion when an ask is sent (widget-answers design decision 5): the request's molecule
// references expanded through the session's source, or refused with the expansion's problems as the
// request problems the agent reads (AD-6). A session without a source ships no molecule, so any
// reference is refused as unknown; with no reference nothing is looked up (AD-2). Plain ECMAScript
// (AD-1).

import type { RequestProblem } from "@askboard/contract/validate";
import { type ExpansionProblem, expandMolecules } from "./expand.ts";
import type { ExpansionMap } from "./map.ts";
import type { MoleculeSource } from "./source.ts";

/** A source that ships nothing. */
const NO_MOLECULES: MoleculeSource = {
  lookup: () => ({ found: false, reason: "unknown-molecule", shipped: [] }),
};

export type SentItems =
  | { readonly ok: true; readonly items: readonly unknown[]; readonly map: ExpansionMap }
  | { readonly ok: false; readonly problems: readonly RequestProblem[] };

/** The field of a problem path under its item: `/0/props/items/1/props/molecule` is `props.molecule`. */
const fieldOf = (path: string): string =>
  path
    .replace(/^\/\d+(?:\/props\/items\/\d+)?\/?/, "")
    .split("/")
    .filter((segment) => segment !== "")
    .join(".") || "items";

const EXPECTED = "a molecule reference that AskBoard ships, with data its parameters accept";

const requestProblem = ({ itemId, path, message }: ExpansionProblem): RequestProblem => ({
  path: `/items${path}`,
  ...(itemId === undefined ? {} : { itemId }),
  field: fieldOf(path),
  expected: EXPECTED,
  message,
});

/** The request's items with every molecule reference expanded, and the expansion map. */
export const expandSentItems = (
  items: readonly unknown[],
  source: MoleculeSource | undefined,
): SentItems => {
  const expansion = expandMolecules(items, source ?? NO_MOLECULES);
  return expansion.ok ? expansion : { ok: false, problems: expansion.problems.map(requestProblem) };
};
