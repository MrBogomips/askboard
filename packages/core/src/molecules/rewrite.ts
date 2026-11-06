// A widget item's value in reference addressing (widget-answers design decision 7; AD-9): an
// expanded item comes under its reference's ID, and each slot the definition's `item` fills wrote
// (the plan's `workPackages`) names the reference again, the inverse of the `item` form and
// nothing else. The definition comes from the molecule source, by the molecule and version the
// expansion map names. Pure: nothing is changed in place. Plain ECMAScript (AD-1).

import { type MoleculeDefinition, pointerTokens } from "@askboard/contract";
import { NO_PLACE, withValueAt } from "./fills.ts";
import type { ExpansionMap } from "./map.ts";
import type { MoleculeSource } from "./source.ts";

type Json = Readonly<Record<string, unknown>>;

/** An item's ID and props as the agent addresses them. */
export type AddressedValue = { readonly id: string; readonly props: unknown };

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The value at `tokens` in `root`, or undefined where there is none.
const valueAt = (root: unknown, tokens: readonly string[]): unknown => {
  let at = root;
  for (const token of tokens) {
    if (Array.isArray(at)) at = at[Number(token)];
    else if (isObject(at) && Object.hasOwn(at, token)) at = at[token];
    else return undefined;
  }
  return at;
};

// A fill's pointer addresses the composition `[item]`: `/0/props/...`, so the props' own path
// follows the first two tokens.
const propsPathOf = (pointer: string): readonly string[] | undefined => {
  const tokens = pointerTokens(pointer);
  return tokens !== undefined && tokens[0] === "0" && tokens[1] === "props"
    ? tokens.slice(2)
    : undefined;
};

const slotsOf = (definition: MoleculeDefinition): readonly (readonly string[])[] =>
  Object.values(definition.fills)
    .flat()
    .filter((fill) => fill.as === "item")
    .flatMap((fill) => {
      const path = propsPathOf(fill.pointer);
      return path === undefined ? [] : [path];
    });

/** Props with each slot an `item` fill wrote naming the reference of the expanded ID it holds. */
const slotsToReference = (
  props: unknown,
  slots: readonly (readonly string[])[],
  map: ExpansionMap,
) =>
  slots.reduce((rewritten, path) => {
    const held = valueAt(rewritten, path);
    const entry = typeof held === "string" ? map.get(held) : undefined;
    if (entry === undefined) return rewritten;
    const next = withValueAt(rewritten, path, entry.reference);
    return next === NO_PLACE ? rewritten : next;
  }, props);

/**
 * The value of the item `itemId` with `props`, as the agent addresses it: an expanded item under
 * its reference's ID with its `item`-fill slots naming references; any other item as it is. A
 * molecule that expanded the ask but is no longer shipped is an error, never a half-rewritten value.
 */
export const valueInReferenceAddressing = (
  map: ExpansionMap,
  source: MoleculeSource | undefined,
  itemId: string,
  props: unknown,
): AddressedValue => {
  const entry = map.get(itemId);
  if (entry === undefined) return { id: itemId, props };
  const found = source?.lookup(entry.molecule, entry.version);
  if (found === undefined || !found.found) {
    throw new Error(`the molecule ${entry.molecule} ${entry.version} is no longer shipped`);
  }
  return { id: entry.reference, props: slotsToReference(props, slotsOf(found.definition), map) };
};
