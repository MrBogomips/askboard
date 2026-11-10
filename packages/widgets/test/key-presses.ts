// Key presses for the key tests (keyboard-shortcuts-help, design decisions 7 and 9): the 16 sets of
// the four modifiers, the keys a parity test probes, and the oracle that says which entry of a
// table's part a press triggers, from the contract's own matcher. Test support only.

import {
  type KeyEntry,
  type KeyPress,
  keyActionOf,
  type Modifiers,
  type PressHold,
  pressHold,
} from "@askboard/contract";

/** Every set of the four modifiers: the 16 subsets. */
export const FLAG_SETS: readonly Modifiers[] = Array.from({ length: 16 }, (_, bits) => ({
  altKey: (bits & 1) !== 0,
  ctrlKey: (bits & 2) !== 0,
  metaKey: (bits & 4) !== 0,
  shiftKey: (bits & 8) !== 0,
}));

/** No modifier held. */
export const NO_MODIFIER: Modifiers = {
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

/** A press with the hold of `flags`, outside composition and a text field. */
export const pressOf = (key: string, flags: Modifiers = NO_MODIFIER): KeyPress => ({
  key,
  hold: pressHold(flags),
  composing: false,
  inText: false,
});

/** A press with a named hold, for tests that need no flags. */
export const pressWith = (key: string, hold: PressHold = "none"): KeyPress => ({
  key,
  hold,
  composing: false,
  inText: false,
});

/** Every flag set with at least one modifier held: 15 of the 16. */
export const MODIFIED_FLAGS: readonly Modifiers[] = FLAG_SETS.filter((flags) =>
  Object.values(flags).some(Boolean),
);

/** The keys every parity test gives each part, beside the keys its table binds. */
export const PROBE_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  " ",
  "Delete",
  "Backspace",
  "Escape",
  "F2",
] as const;

/** What a part's function gives for a key and a flag set: a table action ID, or nothing. */
export type Taken = (key: string, flags: Modifiers, press: KeyPress) => string | undefined;

type Entries = readonly (KeyEntry & { readonly part: string })[];

/** The keys to probe for a part: the probe keys and every key its entries bind. */
export const keysOfPart = (table: Entries, part: string): string[] => [
  ...new Set([
    ...PROBE_KEYS,
    ...table
      .filter((entry) => entry.part === part)
      .flatMap((entry) => entry.keys.map((k) => k.key)),
  ]),
];

/** The entries of a part that take a key from AskBoard's own handler: not `native`, with keys. */
export const handledEntries = (table: Entries, part: string): Entries =>
  table.filter((entry) => entry.part === part && entry.shows !== "native" && entry.keys.length > 0);

/**
 * Every disagreement between the table and a part's function: for each key and each of the 16
 * flag sets, the table's action (a `native` entry counts as nothing: no AskBoard function takes
 * its key) against what `taken` gives. Empty when the part and its table agree.
 */
export const parityMismatches = (table: Entries, part: string, taken: Taken): string[] => {
  const handled = handledEntries(table, part);
  const found: string[] = [];
  for (const key of keysOfPart(table, part)) {
    for (const flags of FLAG_SETS) {
      const press = pressOf(key, flags);
      const expected = keyActionOf(handled, part, press, true)?.action;
      const given = taken(key, flags, press);
      if (given !== expected) {
        found.push(
          `${part} ${key} ${pressHold(flags)}/${JSON.stringify(flags)}: table ${expected}, handler ${given}`,
        );
      }
    }
  }
  return found;
};

/** The table's actions of a part that the function reaches with at least one binding (S-2). */
export const reachedActions = (table: Entries, part: string, taken: Taken): string[] => {
  const reached = new Set<string>();
  for (const key of keysOfPart(table, part)) {
    for (const flags of FLAG_SETS) {
      const given = taken(key, flags, pressOf(key, flags));
      if (given !== undefined) reached.add(given);
    }
  }
  return [...reached].sort();
};

/** The actions of a part that a handler must reach: every entry with keys that is not native. */
export const expectedActions = (table: Entries, part: string): string[] =>
  handledEntries(table, part)
    .map((entry) => entry.action)
    .sort();
