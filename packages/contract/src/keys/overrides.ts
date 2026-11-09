// The user's key overrides and their check (keyboard-shortcuts-help, design decision 18; contract
// spec: User key overrides and their check): what is wrong with a `keys` object against every
// registered key table once it is applied. Pure and total over any value: the configuration schema
// bounds the shape of `keys` and this check gives it its meaning (AD-14), and one problem never
// hides another. A file with any problem applies no `keys` at all (`ask-core`, NFR-10).

import { editorKeyProblem, reads, reservedProblem } from "./check.ts";
import { bindingsOf, effectiveKeys } from "./effective.ts";
import { type KeyOverrides, keyCombinationText, parseKeyCombination } from "./notation.ts";
import { type KeyTypes, REGISTERED_KEY_TABLES } from "./tables.ts";
import {
  isVocabularyAction,
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyEntry,
} from "./vocabulary.ts";

/** The rules an override can break. */
export type KeyOverrideRule =
  | "action"
  | "native"
  | "notation"
  | "hold"
  | "reserved"
  | "conflict"
  | "exit";

/**
 * One problem of the overrides: its rule, the action, the combination as the user wrote it where
 * one is at fault, and the other action of a conflict.
 */
export type KeyOverrideProblem = {
  readonly rule: KeyOverrideRule;
  readonly action: string;
  readonly binding?: string;
  readonly with?: string;
};

// `keys.open` is the frame's: its keys act across the whole item, not in one part (decision 5).
const KEYS_OPEN = "keys.open";

// The keys a native control inside an item takes (a button, a check box, a Radix toggle group, a
// slider, a menu), which `keys.open` may not be bound to with no modifier or Shift alone: the frame
// acts on a key no part prevented, so `Enter` would open the panel from a focused button instead of
// pressing it (design decision 18, review 8.6). A key named as `parseKeyCombination` reads it;
// the space bar is " ".
/** The keys `keys.open` may not take with no modifier or Shift alone. */
export const KEYS_OPEN_RESERVED_KEYS: ReadonlySet<string> = new Set([
  "Enter",
  " ",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Delete",
  "Backspace",
]);

const takenByControls = ({ key, hold }: KeyBinding): boolean =>
  (hold === "none" || hold === "shift") && KEYS_OPEN_RESERVED_KEYS.has(key);

// A registered table's entries that are whole, by type.
type Registered = { readonly type: string; readonly table: readonly KeyEntry[] };

const isEntry = (value: unknown): value is KeyEntry => {
  if (typeof value !== "object" || value === null) return false;
  const { action, part, keys } = value as { action: unknown; part: unknown; keys: unknown };
  return typeof action === "string" && typeof part === "string" && Array.isArray(keys);
};

const registered = (types: KeyTypes): readonly Registered[] =>
  (Array.isArray(types) ? (types as readonly unknown[]) : []).flatMap((value) => {
    const { type, keys } = (value ?? {}) as { type?: unknown; keys?: unknown };
    if (typeof type !== "string" || !Array.isArray(keys)) return [];
    return [{ type, table: (keys as readonly unknown[]).filter(isEntry) }];
  });

// What a combination's text is shown as in a problem, whatever the value is.
const shownText = (value: unknown): string =>
  (typeof value === "string" ? value : (JSON.stringify(value) ?? String(value))).slice(0, 64);

// The actions some registered table has in an `editor` part: a key that types a character is
// refused on them, as the table check refuses it in the part (review 8.6).
const editorActions = (tables: readonly Registered[]): ReadonlySet<string> =>
  new Set(
    tables.flatMap(({ table }) =>
      table.filter((entry) => entry.part === "editor").map((entry) => entry.action),
    ),
  );

const isEscape = ({ key, hold }: KeyBinding): boolean => key === "Escape" && hold === "none";

// The own actions whose default keys hold Escape: exits of a part (the Tree's two questions' cancels).
const escapeActions = (tables: readonly Registered[]): readonly string[] =>
  tables.flatMap(({ table }) =>
    table
      .filter(
        (entry) =>
          !isVocabularyAction(entry.action) &&
          entry.keys.some((binding) => typeof binding === "object" && isEscape(binding)),
      )
      .map((entry) => entry.action),
  );

/**
 * The exits an override may not leave with no key: `edit.cancel` and each own action whose default
 * keys hold Escape in some registered table, sorted, frozen. The set `keyOverridesProblems` reports
 * an `exit` problem for; the generated key configuration reference reads it (review 5.6, S-36).
 */
export const keyExitActions = (types: KeyTypes = REGISTERED_KEY_TABLES): readonly string[] =>
  Object.freeze([...new Set(["edit.cancel", ...escapeActions(registered(types))])].sort());

// The problems of one action's override on its own: known, not native, each combination judged,
// an exit not left bare. `text` collects each parsed binding's text as the user wrote it.
const actionProblems = (
  action: string,
  combinations: unknown,
  tables: readonly Registered[],
  exits: readonly string[],
  editors: ReadonlySet<string>,
): readonly KeyOverrideProblem[] => {
  const entries = tables.flatMap(({ table }) => table.filter((entry) => entry.action === action));
  const known = isVocabularyAction(action) || entries.some((entry) => entry.keys.length > 0);
  if (!known) return [{ rule: "action", action }];
  if (entries.length > 0 && entries.every((entry) => entry.shows === "native")) {
    return [{ rule: "native", action }];
  }
  if (!Array.isArray(combinations)) {
    return [{ rule: "notation", action, binding: shownText(combinations) }];
  }
  const problems: KeyOverrideProblem[] = [];
  for (const combination of combinations as readonly unknown[]) {
    const read = parseKeyCombination(combination);
    if (!read.ok) {
      problems.push({ rule: read.rule, action, binding: shownText(combination) });
    } else if (
      reservedProblem(read.binding) !== undefined ||
      (editors.has(action) && editorKeyProblem(read.binding) !== undefined) ||
      (action === KEYS_OPEN && takenByControls(read.binding))
    ) {
      problems.push({ rule: "reserved", action, binding: shownText(combination) });
    }
  }
  const bare = combinations.length === 0;
  if (bare && exits.includes(action)) problems.push({ rule: "exit", action });
  return problems;
};

// Each binding a press of which an entry takes, as the keys the matcher reads, by part.
const taken = (entry: KeyEntry): ReadonlySet<string> =>
  new Set(entry.keys.flatMap((binding) => reads(binding)));

// The conflicts of one type's effective table that an override causes: for each overridden action,
// each binding another action of the same part also takes. Two overridden actions on one key are
// reported once, from the one the overrides name later.
const conflicts = (
  table: readonly KeyEntry[],
  order: readonly string[],
  written: ReadonlyMap<string, ReadonlyMap<string, string>>,
): readonly KeyOverrideProblem[] => {
  const problems: KeyOverrideProblem[] = [];
  for (const entry of table) {
    const mine = written.get(entry.action);
    if (mine === undefined) continue;
    for (const binding of entry.keys) {
      const own = new Set(reads(binding));
      for (const other of table) {
        if (other === entry || other.part !== entry.part || other.action === entry.action) continue;
        if (![...taken(other)].some((id) => own.has(id))) continue;
        const later = order.indexOf(other.action) > order.indexOf(entry.action);
        if (written.has(other.action) && later) continue;
        problems.push({
          rule: "conflict",
          action: entry.action,
          binding: mine.get(`${binding.hold}:${binding.key}`) ?? keyCombinationText(binding),
          with: other.action,
        });
      }
    }
  }
  return problems;
};

// The text the user wrote for a binding of an overridden action, else the binding as the notation
// writes it.
const textOf = (
  written: ReadonlyMap<string, ReadonlyMap<string, string>>,
  action: string,
  binding: KeyBinding,
): string =>
  written.get(action)?.get(`${binding.hold}:${binding.key}`) ?? keyCombinationText(binding);

// The keys `keys.open` has in effect: the override when it parses, else the vocabulary's.
const openKeys = (overrides: KeyOverrides): readonly KeyBinding[] =>
  (Object.hasOwn(overrides, KEYS_OPEN) ? bindingsOf(overrides[KEYS_OPEN]) : undefined) ??
  KEY_VOCABULARY[KEYS_OPEN].keys;

// The conflicts of `keys.open` with every keyed binding of every part of every registered table
// once the overrides apply (it acts across the item, so the part of an action does not matter),
// where one of the two is overridden. A pair is reported once, from the overridden action, or
// from the one the overrides name later when both are; duplicates across tables and parts are
// the caller's to drop.
const openConflicts = (
  tables: readonly Registered[],
  overrides: KeyOverrides,
  order: readonly string[],
  written: ReadonlyMap<string, ReadonlyMap<string, string>>,
): readonly KeyOverrideProblem[] => {
  const problems: KeyOverrideProblem[] = [];
  const open = openKeys(overrides);
  for (const { table } of tables) {
    for (const entry of effectiveKeys(table, overrides)) {
      if (entry.action === KEYS_OPEN || (!written.has(entry.action) && !written.has(KEYS_OPEN))) {
        continue;
      }
      const fromEntry =
        written.has(entry.action) &&
        (!written.has(KEYS_OPEN) || order.indexOf(entry.action) > order.indexOf(KEYS_OPEN));
      for (const binding of entry.keys) {
        const own = new Set(reads(binding));
        for (const opened of open) {
          if (!reads(opened).some((id) => own.has(id))) continue;
          problems.push(
            fromEntry
              ? {
                  rule: "conflict",
                  action: entry.action,
                  binding: textOf(written, entry.action, binding),
                  with: KEYS_OPEN,
                }
              : {
                  rule: "conflict",
                  action: KEYS_OPEN,
                  binding: textOf(written, KEYS_OPEN, opened),
                  with: entry.action,
                },
          );
        }
      }
    }
  }
  return problems;
};

// For each overridden action whose combinations all parse, the text the user wrote for each binding.
const writtenTexts = (
  overrides: KeyOverrides,
  actions: readonly string[],
): ReadonlyMap<string, ReadonlyMap<string, string>> => {
  const written = new Map<string, ReadonlyMap<string, string>>();
  for (const action of actions) {
    const combinations = overrides[action];
    if (bindingsOf(combinations) === undefined) continue;
    const texts = new Map<string, string>();
    for (const combination of combinations as readonly string[]) {
      const read = parseKeyCombination(combination);
      if (read.ok) texts.set(`${read.binding.hold}:${read.binding.key}`, combination);
    }
    written.set(action, texts);
  }
  return written;
};

const same = (a: KeyOverrideProblem, b: KeyOverrideProblem): boolean =>
  a.rule === b.rule && a.action === b.action && a.binding === b.binding && a.with === b.with;

/**
 * What is wrong with the user's overrides, every problem at once, none hiding another: an
 * `action` neither in the vocabulary nor an own action some registered table binds with keys
 * (`__proto__`, a misspelling, a keyless tool); a `native` action, whose keys a Radix or browser
 * control takes; a combination that does not parse (`notation`) or has no hold (`hold`); a
 * `reserved` key of the browser or the system (Alt with Shift on a letter or Space included), or,
 * for an action that any registered table has in an `editor` part, a key that types a character;
 * a `conflict`, two actions of one part on one key
 * once applied, and `keys.open` against every keyed binding of every part, since it acts across
 * the item; for `keys.open` also a `reserved` key a native control takes (`KEYS_OPEN_RESERVED_KEYS`);
 * an `exit` left with no key (`edit.cancel`, and each own action whose default keys
 * hold Escape). A vocabulary action no table binds yet passes. Each problem names the action, the
 * combination as written and, for a conflict, the other action. Never throws.
 */
export const keyOverridesProblems = (
  overrides: KeyOverrides,
  types: KeyTypes = REGISTERED_KEY_TABLES,
): readonly KeyOverrideProblem[] => {
  if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
    return [{ rule: "notation", action: "keys", binding: shownText(overrides) }];
  }
  const tables = registered(types);
  const exits = keyExitActions(types);
  const editors = editorActions(tables);
  const actions = Object.keys(overrides);
  const found = actions.flatMap((action) =>
    actionProblems(action, overrides[action], tables, exits, editors),
  );
  const written = writtenTexts(overrides, actions);
  const conflicting = [
    ...tables.flatMap(({ table }) => conflicts(effectiveKeys(table, overrides), actions, written)),
    ...openConflicts(tables, overrides, actions, written),
  ];
  for (const problem of conflicting) {
    if (!found.some((other) => same(other, problem))) found.push(problem);
  }
  return found;
};
