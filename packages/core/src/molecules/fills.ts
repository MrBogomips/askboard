// The fill forms of the molecule definition format 1.0.0 (AD-9; molecules design decision 3): a
// fill puts its parameter's value at a JSON Pointer of the composition, as a deep copy (no form),
// as the expanded item of the molecule reference it names (`item`), with each value of an object
// as an entry holding it under one field (`entries`), or without some keys at any depth (`omit`).
// A parameter the data leaves out leaves the composition's value. Declarative and pure: no fill
// evaluates anything, nothing is changed in place, and the item shares nothing with the definition
// or the data. Plain ECMAScript (AD-1).

import {
  type MoleculeDefinition,
  type MoleculeFill,
  type MoleculeItem,
  pointerOf,
  pointerTokens,
} from "@askboard/contract";
import type { Problem } from "@askboard/contract/validate";

type Json = Readonly<Record<string, unknown>>;

/** The expanded item's ID of each molecule reference of the ask, by the reference's ID. */
export type ExpandedIds = ReadonlyMap<string, string>;

export type Filled =
  | { readonly ok: true; readonly item: MoleculeItem }
  | { readonly ok: false; readonly problems: readonly Problem[] };

const INDEX = /^(0|[1-9][0-9]*)$/;
export const NO_PLACE: unique symbol = Symbol("no place");

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A deep copy of JSON data, without the keys in `omit`. `Object.fromEntries` defines each key as
// an own property, so a `__proto__` key stays data and never becomes a prototype.
const copyOf = (value: unknown, omit?: ReadonlySet<string>): unknown => {
  if (Array.isArray(value)) return value.map((child) => copyOf(child, omit));
  if (!isObject(value)) return value;
  const kept = Object.entries(value).filter(([key]) => omit?.has(key) !== true);
  return Object.fromEntries(kept.map(([key, child]) => [key, copyOf(child, omit)]));
};

// `root` with `value` at `tokens`, copied along the path, or `NO_PLACE` when the parent is missing
// or a list has no such index. A new key goes last; an existing one keeps its place.
export const withValueAt = (root: unknown, tokens: readonly string[], value: unknown): unknown => {
  const [head, ...rest] = tokens;
  if (head === undefined) return value;
  if (Array.isArray(root)) {
    if (!INDEX.test(head) || Number(head) >= root.length) return NO_PLACE;
    const child = withValueAt(root[Number(head)], rest, value);
    return child === NO_PLACE
      ? NO_PLACE
      : root.map((old, at) => (at === Number(head) ? child : old));
  }
  if (!isObject(root)) return NO_PLACE;
  const has = Object.hasOwn(root, head);
  if (!has && rest.length > 0) return NO_PLACE;
  const child = withValueAt(has ? root[head] : undefined, rest, value);
  if (child === NO_PLACE) return NO_PLACE;
  const entries = Object.entries(root);
  return Object.fromEntries(
    has
      ? entries.map(([key, old]) => [key, key === head ? child : old])
      : [...entries, [head, child]],
  );
};

type Value = { readonly value: unknown } | { readonly fault: string };

// What a fill puts at its pointer, by its form.
const fillValue = (
  parameter: string,
  fill: MoleculeFill,
  value: unknown,
  ids: ExpandedIds,
): Value => {
  const { as } = fill;
  if (as === undefined) return { value: copyOf(value) };
  if (as === "item") {
    return { value: typeof value === "string" ? (ids.get(value) ?? value) : copyOf(value) };
  }
  if ("omit" in as) return { value: copyOf(value, new Set(as.omit)) };
  if (!isObject(value)) {
    return { fault: `the parameter "${parameter}" is no object, which its entries fill needs` };
  }
  const entries = Object.entries(value).map(([key, child]) => [
    key,
    { [as.entries]: copyOf(child) },
  ]);
  return { value: Object.fromEntries(entries) };
};

/**
 * The definition's item with every fill of a parameter the data holds applied, in the order of
 * `fills`' keys and then of each list; its ID is still the definition's. `references` gives the
 * expanded item of each molecule reference of the ask, for the `item` form. A form that cannot
 * take its value, or a pointer that names no place, is a problem at the parameter's path in the
 * data, never an exception.
 */
export const fillItem = (
  definition: MoleculeDefinition,
  data: Json,
  references: ExpandedIds,
): Filled => {
  let items: unknown = copyOf(definition.items);
  const problems: Problem[] = [];
  for (const [parameter, fills] of Object.entries(definition.fills)) {
    if (!Object.hasOwn(data, parameter)) continue;
    const path = pointerOf([parameter]);
    for (const fill of fills) {
      const filled = fillValue(parameter, fill, data[parameter], references);
      if ("fault" in filled) {
        problems.push({ path, message: filled.fault });
        continue;
      }
      const tokens = pointerTokens(fill.pointer) ?? [];
      const next = tokens.length === 0 ? NO_PLACE : withValueAt(items, tokens, filled.value);
      if (next === NO_PLACE) {
        const message = `the definition fills "${parameter}" at "${fill.pointer}", which names no place in its composition`;
        problems.push({ path, message });
      } else {
        items = next;
      }
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, item: (items as readonly MoleculeItem[])[0] as MoleculeItem };
};
