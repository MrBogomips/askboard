// Expanding molecule references (AD-9, AD-12; molecules design decision 4): each reference among a
// question's items, at the top level or in an area (E3), becomes its definition's item, filled
// from the reference's data, in the reference's place and under the ID `<reference>__<item>`.
// First every reference's definition and expanded ID, so that an `item` fill names a reference
// wherever it sits in the ask; then each reference's data against its parameters, and its fills;
// then each expanded ID, at most 64 characters and the ID of no other item of the ask; last, once
// every reference has expanded, each expanded item through its widget's checks in its question as
// expanded, so a plan's link reads the Tree beside it. With any problem the expansion gives no
// items: the caller refuses the request (AD-10). Pure and deterministic, changing none of its
// inputs; plain ECMAScript (AD-1).

import {
  expandedItemId,
  type MoleculeDefinition,
  type MoleculeItem,
  type MoleculeProps,
  nestedItemsOf,
  pointerOf,
  pointerTokens,
} from "@askboard/contract";
import {
  moleculeDataValidator,
  type Problem,
  validateMoleculeProps,
  widgetItemProblems,
} from "@askboard/contract/validate";
import { referenceAddressing } from "./addressing.ts";
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

/** Where a question sits in the items given: `[i]` at the top level, `[i, "props", "items", j]` in an area. */
type QuestionPlace = readonly (string | number)[];

/** Where a reference sits: its question's place, and its index among that question's items. */
type Place = { readonly question: QuestionPlace; readonly child: number };

/** A reference found in a question's items: where it is, and what it holds. */
type Found = { readonly at: Place; readonly item: Json };

/** A reference whose definition was found. */
type Resolved = {
  readonly at: Place;
  readonly id: string;
  readonly props: MoleculeProps;
  readonly definition: MoleculeDefinition;
  readonly expandedId: string;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const itemsIn = (item: unknown, type: string): readonly unknown[] | undefined =>
  isObject(item) && item.type === type && isObject(item.props) && Array.isArray(item.props.items)
    ? item.props.items
    : undefined;

const childrenOf = (item: unknown): readonly unknown[] | undefined => itemsIn(item, "question");

/** Every question of the items with its place: each top-level question, then each area's. */
const questionsOf = (items: readonly unknown[]): { place: QuestionPlace; question: unknown }[] =>
  items.flatMap((item, at) => {
    const inArea = itemsIn(item, "area");
    if (inArea === undefined) return [{ place: [at], question: item }];
    return inArea.map((question, index) => ({
      place: [at, "props", "items", index],
      question,
    }));
  });

const placeOf = ({ question, child }: Place, ...rest: string[]): string =>
  pointerOf([...question, "props", "items", child, ...rest]);

// `/` from a validator is the value itself.
const under = (base: string, path: string): string => (path === "/" ? base : `${base}${path}`);

const inWords = (names: readonly string[]): string => {
  if (names.length === 0) return "nothing";
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const referencesOf = (items: readonly unknown[]): Found[] =>
  questionsOf(items).flatMap(({ place, question }) =>
    (childrenOf(question) ?? []).flatMap((child, at): Found[] =>
      isObject(child) && child.type === MOLECULE
        ? [{ at: { question: place, child: at }, item: child }]
        : [],
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

// The field of the data a problem is about, as the agent names it: `/dependencies/ux/0` is
// `, data.dependencies.ux[0]`; a problem about the data as a whole names none, nor does one whose
// message already quotes the key (an unknown field).
const dataFieldOf = (path: string, message: string): string => {
  const tokens = pointerTokens(path) ?? [];
  if (tokens.length === 0 || message.includes(`"${tokens.at(-1)}"`)) return "";
  const field = tokens.reduce(
    (text, token) => (/^\d+$/.test(token) ? `${text}[${token}]` : `${text}.${token}`),
    "data",
  );
  return `, ${field}`;
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
      message: `${name}${dataFieldOf(path, message)}: ${message}`,
    })),
  });
  let checked: ReturnType<ReturnType<typeof moleculeDataValidator>>;
  try {
    checked = moleculeDataValidator(definition)(props.data);
  } catch (error) {
    // A source hands out checked definitions; one that still fails to compile refuses the reference.
    const message = `the molecule reference "${id}" names ${definition.molecule} ${definition.version}, whose parameters AskBoard cannot use: ${messageOf(error)}`;
    return {
      problems: [{ itemId: id, path: placeOf(reference.at, "props", "molecule"), message }],
    };
  }
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
  for (const item of items) if (isObject(item)) take(item.id);
  for (const { place, question } of questionsOf(items)) {
    if (place.length > 1 && isObject(question)) take(question.id);
    // Every item of the question at every depth of its layouts (review X-1).
    for (const { item } of nestedItemsOf(childrenOf(question) ?? [])) {
      if (isObject(item)) take(item.id);
    }
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

const keyOf = ({ question, child }: Place): string => pointerOf([...question, child]);

// A container, question or area, with its items replaced: itself when none changed.
const withItems = (item: unknown, items: readonly unknown[], old: readonly unknown[]): unknown =>
  isObject(item) && items.some((each, at) => each !== old[at])
    ? { ...item, props: { ...(item.props as Json), items } }
    : item;

// A question with each of its references replaced in place by its expanded item.
const replacedQuestion = (
  question: unknown,
  place: QuestionPlace,
  expanded: ReadonlyMap<string, MoleculeItem>,
): unknown => {
  const children = childrenOf(question) ?? [];
  const items = children.map(
    (old, child) => expanded.get(keyOf({ question: place, child })) ?? old,
  );
  return withItems(question, items, children);
};

// The items with each reference replaced in place by its expanded item, in an area's question too.
const replaced = (items: readonly unknown[], expanded: ReadonlyMap<string, MoleculeItem>) =>
  items.map((item, at) => {
    const inArea = itemsIn(item, "area");
    if (inArea === undefined) return replacedQuestion(item, [at], expanded);
    const questions = inArea.map((question, index) =>
      replacedQuestion(question, [at, "props", "items", index], expanded),
    );
    return withItems(item, questions, inArea);
  });

// Step 4's widget checks: each expanded item in its question as expanded, its problems at the
// reference's place, naming the reference and the path in the item's props, in reference
// addressing, since a path in the expanded item is no path in the reference's data.
const widgetProblems = (
  done: readonly { readonly reference: Resolved; readonly item: MoleculeItem }[],
  items: readonly unknown[],
  map: ExpansionMap,
): ExpansionProblem[] => {
  const { textToReference } = referenceAddressing(map);
  const questions = new Map(
    questionsOf(items).map(({ place, question }) => [pointerOf(place), question]),
  );
  return done.flatMap(({ reference, item }) => {
    const { id, definition, at } = reference;
    const question = questions.get(pointerOf(at.question));
    const name = `the molecule reference "${id}" (${definition.molecule} ${definition.version})`;
    return widgetItemProblems(item, question, "agent").map(({ path, message }) => ({
      itemId: id,
      path: placeOf(at),
      message: `${name}, at ${path} of its ${item.type}: ${textToReference(message)}`,
    }));
  });
};

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
  const result = replaced(items, expanded);
  const refused = widgetProblems(done, result, map);
  if (refused.length > 0) return { ok: false, problems: refused };
  return { ok: true, items: result, map };
};
