// Expanding molecule references (AD-9, AD-12; molecules design decision 4): each reference among a
// question's items becomes its definition's item, filled from the reference's data, in the
// reference's place and under the ID `<reference>__<item>`. First every reference's definition
// and expanded ID, so that an `item` fill names a reference wherever it sits in the ask; then each
// reference's data against its parameters, and its fills; then each expanded ID, at most 64
// characters and the ID of no other item of the ask. With any problem the expansion gives no
// items: the caller refuses the request (AD-10). Pure and deterministic, changing none of its
// inputs; plain ECMAScript (AD-1).

import {
  expandedItemId,
  type MoleculeDefinition,
  type MoleculeItem,
  type MoleculeProps,
  pointerOf,
} from "@askboard/contract";
import {
  moleculeDataValidator,
  type Problem,
  validateMoleculeProps,
} from "@askboard/contract/validate";
import { type ExpandedIds, fillItem } from "./fills.ts";
import type { ExpansionEntry, ExpansionMap } from "./map.ts";
import type { MoleculeLookup, MoleculeSource } from "./source.ts";

/** The item type of a molecule reference (AD-9). */
const MOLECULE = "molecule";
/** The longest item ID, as E1's `ID_PATTERN` allows. */
const ID_MAX_CHARS = 64;

/**
 * A problem with a molecule reference: `path` is a JSON Pointer into the items given to
 * `expandMolecules`, and `itemId` the reference's ID when it has one.
 */
export type ExpansionProblem = Problem & { readonly itemId?: string };

export type Expansion =
  | { readonly ok: true; readonly items: readonly unknown[]; readonly map: ExpansionMap }
  | { readonly ok: false; readonly problems: readonly ExpansionProblem[] };

type Json = Readonly<Record<string, unknown>>;

/** A reference found in a question's items: where it is, and what it holds. */
type Found = { readonly at: readonly [number, number]; readonly item: Json };

/** A reference whose definition was found. */
type Resolved = {
  readonly at: readonly [number, number];
  readonly id: string;
  readonly props: MoleculeProps;
  readonly definition: MoleculeDefinition;
  readonly expandedId: string;
};

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const childrenOf = (item: unknown): readonly unknown[] | undefined =>
  isObject(item) &&
  item.type === "question" &&
  isObject(item.props) &&
  Array.isArray(item.props.items)
    ? item.props.items
    : undefined;

const placeOf = ([question, child]: readonly [number, number], ...rest: string[]): string =>
  pointerOf([question, "props", "items", child, ...rest]);

// `/` from a validator is the value itself.
const under = (base: string, path: string): string => (path === "/" ? base : `${base}${path}`);

const inWords = (names: readonly string[]): string => {
  if (names.length === 0) return "nothing";
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const referencesOf = (items: readonly unknown[]): Found[] =>
  items.flatMap((item, question) =>
    (childrenOf(item) ?? []).flatMap((child, at): Found[] =>
      isObject(child) && child.type === MOLECULE ? [{ at: [question, at], item: child }] : [],
    ),
  );

// Why a lookup found no definition, in words that name the reference and what is shipped.
const lookupProblem = (
  found: Found,
  id: string,
  props: MoleculeProps,
  lookup: Exclude<MoleculeLookup, { found: true }>,
): ExpansionProblem => {
  const { molecule, version } = props;
  const who = `the molecule reference "${id}"`;
  if (lookup.reason === "unknown-molecule") {
    const message = `${who} names the molecule "${molecule}", which AskBoard does not ship: it ships ${inWords(lookup.shipped)}`;
    return { itemId: id, path: placeOf(found.at, "props", "molecule"), message };
  }
  if (lookup.reason === "broken") {
    const detail = lookup.detail ?? "it fails the definition format's checks";
    const message = `${who} names ${molecule}, whose shipped definition AskBoard cannot use: ${detail}`;
    return { itemId: id, path: placeOf(found.at, "props", "molecule"), message };
  }
  const shipped = inWords(lookup.shipped.map((each) => `${molecule} ${each}`));
  const asked = version === undefined ? molecule : `${molecule} ${version}`;
  const message = `${who} asks for ${asked}, which AskBoard does not ship: it ships ${shipped}`;
  const field = version === undefined ? "molecule" : "version";
  return { itemId: id, path: placeOf(found.at, "props", field), message };
};

// Step 1: the reference's props, its definition and its expanded ID.
const resolve = (
  found: Found,
  source: MoleculeSource,
): { readonly resolved: Resolved } | { readonly problems: readonly ExpansionProblem[] } => {
  const { id } = found.item;
  if (typeof id !== "string") {
    return {
      problems: [{ path: placeOf(found.at, "id"), message: "a molecule reference has no ID" }],
    };
  }
  const checked = validateMoleculeProps(found.item.props);
  if (!checked.ok) {
    const problems = checked.problems.map(({ path, message }) => ({
      itemId: id,
      path: under(placeOf(found.at, "props"), path),
      message: `the molecule reference "${id}": ${message}`,
    }));
    return { problems };
  }
  const props = checked.value;
  const lookup = source.lookup(props.molecule, props.version);
  if (!lookup.found) return { problems: [lookupProblem(found, id, props, lookup)] };
  const { definition } = lookup;
  const expandedId = expandedItemId(id, definition.items[0].id);
  return { resolved: { at: found.at, id, props, definition, expandedId } };
};

// Steps 2 and 3: the data against the parameters, then the fills; the item under its new ID.
const fill = (
  reference: Resolved,
  ids: ExpandedIds,
): { readonly item: MoleculeItem } | { readonly problems: readonly ExpansionProblem[] } => {
  const { id, props, definition } = reference;
  const base = placeOf(reference.at, "props", "data");
  const name = `the data of the molecule reference "${id}" (${definition.molecule} ${definition.version})`;
  const located = (problems: readonly Problem[]) => ({
    problems: problems.map(({ path, message }) => ({
      itemId: id,
      path: under(base, path),
      message: `${name}: ${message}`,
    })),
  });
  const checked = moleculeDataValidator(definition)(props.data);
  if (!checked.ok) return located(checked.problems);
  const filled = fillItem(definition, checked.value, ids);
  if (!filled.ok) return located(filled.problems);
  return { item: { ...filled.item, id: reference.expandedId } };
};

// Every item ID of the ask, references and expanded items included, with how often it occurs.
const takenIds = (items: readonly unknown[], references: readonly Resolved[]) => {
  const taken = new Map<string, number>();
  const take = (id: unknown) => {
    if (typeof id === "string") taken.set(id, (taken.get(id) ?? 0) + 1);
  };
  for (const item of items) {
    if (isObject(item)) take(item.id);
    for (const child of childrenOf(item) ?? []) if (isObject(child)) take(child.id);
  }
  for (const { expandedId } of references) take(expandedId);
  return taken;
};

// Step 4: the expanded ID within the limit and the ID of no other item of the ask, references
// included, so that an answer names each item unambiguously.
const idProblems = (
  { at, id, expandedId }: Resolved,
  taken: ReadonlyMap<string, number>,
): ExpansionProblem[] => {
  const who = `the molecule reference "${id}" expands to the item "${expandedId}"`;
  let message: string | undefined;
  if (expandedId.length > ID_MAX_CHARS) {
    message = `${who}, of ${expandedId.length} characters, over the limit of ${ID_MAX_CHARS} characters for an item ID`;
  } else if ((taken.get(expandedId) ?? 0) > 1) {
    message = `${who}, and another item of the ask has that ID`;
  }
  return message === undefined ? [] : [{ itemId: id, path: placeOf(at, "id"), message }];
};

const keyOf = ([question, child]: readonly [number, number]): string => `${question}/${child}`;

// The items with each reference replaced in place by its expanded item.
const replaced = (items: readonly unknown[], expanded: ReadonlyMap<string, MoleculeItem>) =>
  items.map((item, question) => {
    const children = childrenOf(item);
    if (children === undefined || !isObject(item)) return item;
    const at = (child: number) => expanded.get(keyOf([question, child]));
    if (!children.some((_, child) => at(child) !== undefined)) return item;
    const props = {
      ...(item.props as Json),
      items: children.map((old, child) => at(child) ?? old),
    };
    return { ...item, props };
  });

type Step =
  | { readonly reference: Resolved; readonly item: MoleculeItem }
  | { readonly problems: readonly ExpansionProblem[] };

/**
 * Expands every molecule reference among the questions' items of `items` through `source` (AD-9):
 * the items with each reference replaced in place by its expanded item, and the expansion map,
 * expanded ID to reference, molecule and version, in the order of the references; or every
 * problem, in the order of the references, each naming its reference, and no items.
 */
export const expandMolecules = (items: readonly unknown[], source: MoleculeSource): Expansion => {
  const outcomes = referencesOf(items).map((reference) => resolve(reference, source));
  const resolved = outcomes.flatMap((outcome) => ("resolved" in outcome ? [outcome.resolved] : []));
  const ids: ExpandedIds = new Map(resolved.map(({ id, expandedId }) => [id, expandedId]));
  const taken = takenIds(items, resolved);
  const steps = outcomes.map((outcome): Step => {
    if ("problems" in outcome) return outcome;
    const reference = outcome.resolved;
    const filled = fill(reference, ids);
    const problems = [
      ...("problems" in filled ? filled.problems : []),
      ...idProblems(reference, taken),
    ];
    return "item" in filled && problems.length === 0
      ? { reference, item: filled.item }
      : { problems };
  });
  const problems = steps.flatMap((step) => ("problems" in step ? step.problems : []));
  if (problems.length > 0) return { ok: false, problems };
  const done = steps.flatMap((step) => ("item" in step ? [step] : []));
  const map: ExpansionMap = new Map(
    done.map(({ reference: { id, definition, expandedId } }): [string, ExpansionEntry] => [
      expandedId,
      Object.freeze({ reference: id, molecule: definition.molecule, version: definition.version }),
    ]),
  );
  const expanded = new Map(done.map(({ reference, item }) => [keyOf(reference.at), item]));
  return { ok: true, items: replaced(items, expanded), map };
};
