// The keys in effect for a widget type (keyboard-shortcuts-help, design decision 19; view spec: The
// user's keys on the board): its key table with the user's overrides applied through the contract's
// `effectiveKeys`, each entry marked with whose keys it holds, the table's or the user's. An action
// is the user's when the applied overrides name it, with keys or with `[]` (removed): a removed
// action is not a keyless one, and the hint and the panel tell them apart by this mark. The overrides
// are text from a file, so every lookup of an action in them is the contract's own-property one.
// Pure: the hooks that give a component these are in `key-table.tsx`.

import { effectiveKeys, type KeyEntry, type KeyOverrides, sameBindings } from "@askboard/contract";
import { KEYS_OPEN_ENTRY } from "./hint.ts";

/** Whose keys an entry holds: the table's own, or those the user's file gave it. */
export type KeySource = "table" | "user";

/** An entry with the keys in effect, and whose they are. */
export type KeyInEffect = KeyEntry & { readonly source: KeySource };

/**
 * `table` with `overrides` applied. An entry whose keys `effectiveKeys` changed to keys that differ
 * from the table's (`sameBindings`) is the user's, a removed action among them; one it left (an
 * action the overrides do not name, a `native` entry, an override that does not parse) or whose
 * keys are the table's in another order is the table's own entry, the very object. With no
 * overrides every entry is the table's.
 */
export const keyTableOf = (
  table: readonly KeyEntry[],
  overrides: KeyOverrides | undefined,
): readonly KeyInEffect[] => {
  const effective = overrides === undefined ? table : effectiveKeys(table, overrides);
  return effective.map((entry, at): KeyInEffect => {
    const own = table[at] as KeyEntry;
    const same = entry === own || sameBindings(entry.keys, own.keys);
    return { ...(same ? own : entry), source: same ? "table" : "user" };
  });
};

/**
 * The entry as the widget's frame has it in effect: the table's entry for the same action and part,
 * else the entry as given, which is also what an entry shows outside a frame, and what one already in
 * effect shows.
 */
export const entryInEffect = (
  table: readonly KeyInEffect[] | undefined,
  entry: KeyEntry,
): KeyEntry => {
  if (table === undefined || "source" in entry) return entry;
  return table.find((each) => each.action === entry.action && each.part === entry.part) ?? entry;
};

/** The frame's `keys.open`: the Keys button's entry with the overrides applied, the same in every frame. */
export const keysOpenEntryOf = (overrides: KeyOverrides | undefined): KeyInEffect =>
  keyTableOf([KEYS_OPEN_ENTRY], overrides)[0] as KeyInEffect;

const listsEqual = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((text, at) => text === b[at]);

/**
 * Whether two sets of overrides are the same actions with the same combinations in the same order,
 * so that an update carrying a new copy of the same keys changes nothing the view renders from.
 */
export const sameOverrides = (
  a: KeyOverrides | undefined,
  b: KeyOverrides | undefined,
): boolean => {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  const actions = Object.keys(a);
  return (
    actions.length === Object.keys(b).length &&
    actions.every(
      (action) => Object.hasOwn(b, action) && listsEqual(a[action] ?? [], b[action] ?? []),
    )
  );
};
