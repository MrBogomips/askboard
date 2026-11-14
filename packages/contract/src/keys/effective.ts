// The effective key table (keyboard-shortcuts-help, design decision 18; contract spec: The
// effective key table): a table with the user's overrides applied, pure and total. A handler reads
// the effective table through `keyActionOf`, so the keys a user sets act and the ones removed do not.

import { type KeyOverrides, parseKeyCombination } from "./notation.ts";
import { type KeyTypes, REGISTERED_KEY_TABLES } from "./tables.ts";
import {
  isVocabularyAction,
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyEntry,
} from "./vocabulary.ts";

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

/**
 * Whether two lists of bindings are the same keys: each binding of one is in the other, whatever
 * the order and however often one is repeated (keyboard-shortcuts-help, review 10.5, S-42). A
 * binding is its key and its hold.
 */
export const sameBindings = (a: readonly KeyBinding[], b: readonly KeyBinding[]): boolean => {
  const has = (list: readonly KeyBinding[], { key, hold }: KeyBinding): boolean =>
    list.some((other) => other.key === key && other.hold === hold);
  return a.every((binding) => has(b, binding)) && b.every((binding) => has(a, binding));
};

// The default keys an action is judged against: the keys of each non-native entry of it in a
// registered table, or, when no table holds the action, the vocabulary's own.
const defaultsOf = (action: string, types: KeyTypes): readonly (readonly KeyBinding[])[] => {
  const entries = (Array.isArray(types) ? (types as KeyTypes) : []).flatMap(({ keys }) =>
    (Array.isArray(keys) ? keys : []).filter((entry) => entry.action === action),
  );
  if (entries.length > 0) {
    return entries.filter((entry) => entry.shows !== "native").map((entry) => entry.keys);
  }
  return isVocabularyAction(action) ? [KEY_VOCABULARY[action].keys] : [];
};

/**
 * The actions whose keys in effect differ from their defaults (design decision 19; review 10.5,
 * S-42), sorted and frozen: an action the overrides name, with combinations that parse, whose
 * bindings are not the same keys (`sameBindings`) as its entry's in some registered table, or, for
 * a vocabulary action no table binds, as the vocabulary's. Keys given as they already are, in any
 * order, change nothing; `[]` on an action that has keys does. A `native` entry, an unknown
 * action, an override that does not parse and a name from the prototype chain change nothing, as
 * `effectiveKeys` leaves them. The settings panel's count and the keys panel's "customised" mark
 * read this and `sameBindings`.
 */
export const changedKeyActions = (
  overrides: KeyOverrides,
  types: KeyTypes = REGISTERED_KEY_TABLES,
): readonly string[] => {
  if (!isOverrides(overrides)) return Object.freeze([]);
  const changed = Object.keys(overrides).filter((action) => {
    const bindings = bindingsOf(overrides[action]);
    if (bindings === undefined) return false;
    return defaultsOf(action, types).some((defaults) => !sameBindings(bindings, defaults));
  });
  return Object.freeze(changed.sort());
};
