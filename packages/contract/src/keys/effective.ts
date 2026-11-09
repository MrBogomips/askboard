// The effective key table (keyboard-shortcuts-help, design decision 18; contract spec: The
// effective key table): a table with the user's overrides applied, pure and total. A handler reads
// the effective table through `keyActionOf`, so the keys a user sets act and the ones removed do not.

import { type KeyOverrides, parseKeyCombination } from "./notation.ts";
import type { KeyBinding, KeyEntry } from "./vocabulary.ts";

// The bindings of an override's combinations, or undefined when the override is no list of
// combinations or any of them does not parse: an action is replaced whole or not at all.
export const bindingsOf = (combinations: unknown): readonly KeyBinding[] | undefined => {
  if (!Array.isArray(combinations)) return undefined;
  const bindings: KeyBinding[] = [];
  for (const combination of combinations as readonly unknown[]) {
    const read = parseKeyCombination(combination);
    if (!read.ok) return undefined;
    const { key, hold } = read.binding;
    if (!bindings.some((binding) => binding.key === key && binding.hold === hold)) {
      bindings.push(read.binding);
    }
  }
  return Object.freeze(bindings);
};

const isOverrides = (value: unknown): value is KeyOverrides =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `table` with each entry's keys replaced by its action's override: the combinations parsed, none
 * for `[]`; the entry's part, label, `shows`, `readOnly` and `when` stay. An entry that is
 * `native` (a Radix or browser control's keys), an action the table lacks, and an override any of
 * whose combinations does not parse change nothing. Only an override's own properties count
 * (`__proto__`, `constructor` and `toString` name no action). The input is untouched and the
 * result frozen; an entry that changes is a new frozen object.
 */
export const effectiveKeys = <Entry extends KeyEntry>(
  table: readonly Entry[],
  overrides: KeyOverrides,
): readonly Entry[] => {
  const replaced = table.map((entry): Entry => {
    if (!isOverrides(overrides) || entry.shows === "native") return entry;
    if (!Object.hasOwn(overrides, entry.action)) return entry;
    const keys = bindingsOf(overrides[entry.action]);
    return keys === undefined ? entry : Object.freeze({ ...entry, keys });
  });
  return Object.freeze(replaced);
};
