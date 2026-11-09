// The user's key overrides and their check (keyboard-shortcuts-help, design decision 18; contract
// spec: User key overrides and their check): what is wrong with a `keys` object against every
// registered key table once it is applied. Pure and total over any value: the configuration schema
// bounds the shape of `keys` and this check gives it its meaning (AD-14), and one problem never
// hides another. A file with any problem applies no `keys` at all (`ask-core`, NFR-10).

import { WIDGET_TYPES, type WidgetType } from "../widgets/registry.ts";
import { reads, reservedProblem } from "./check.ts";
import { bindingsOf, effectiveKeys } from "./effective.ts";
import { type KeyOverrides, keyCombinationText, parseKeyCombination } from "./notation.ts";
import { isVocabularyAction, type KeyBinding, type KeyEntry } from "./vocabulary.ts";

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

// A registered table's entries that are whole, by type.
type Registered = { readonly type: string; readonly table: readonly KeyEntry[] };

const isEntry = (value: unknown): value is KeyEntry => {
  if (typeof value !== "object" || value === null) return false;
  const { action, part, keys } = value as { action: unknown; part: unknown; keys: unknown };
  return typeof action === "string" && typeof part === "string" && Array.isArray(keys);
};

const registered = (types: readonly WidgetType[]): readonly Registered[] =>
  (Array.isArray(types) ? (types as readonly unknown[]) : []).flatMap((value) => {
    const { type, keys } = (value ?? {}) as { type?: unknown; keys?: unknown };
    if (typeof type !== "string" || !Array.isArray(keys)) return [];
    return [{ type, table: (keys as readonly unknown[]).filter(isEntry) }];
  });

// What a combination's text is shown as in a problem, whatever the value is.
const shownText = (value: unknown): string =>
  (typeof value === "string" ? value : (JSON.stringify(value) ?? String(value))).slice(0, 64);

const isEscape = ({ key, hold }: KeyBinding): boolean => key === "Escape" && hold === "none";

// The own actions whose default keys hold Escape: exits of a part (the Tree's two questions' cancels).
const escapeActions = (tables: readonly Registered[]): ReadonlySet<string> =>
  new Set(
    tables.flatMap(({ table }) =>
      table
        .filter(
          (entry) =>
            !isVocabularyAction(entry.action) &&
            entry.keys.some((binding) => typeof binding === "object" && isEscape(binding)),
        )
        .map((entry) => entry.action),
    ),
  );

// The problems of one action's override on its own: known, not native, each combination judged,
// an exit not left bare. `text` collects each parsed binding's text as the user wrote it.
const actionProblems = (
  action: string,
  combinations: unknown,
  tables: readonly Registered[],
  exits: ReadonlySet<string>,
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
    } else if (reservedProblem(read.binding) !== undefined) {
      problems.push({ rule: "reserved", action, binding: shownText(combination) });
    }
  }
  const bare = combinations.length === 0;
  if (bare && (action === "edit.cancel" || exits.has(action)))
    problems.push({ rule: "exit", action });
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
 * `reserved` key of the browser or the system; a `conflict`, two actions of one part on one key
 * once applied; an `exit` left with no key (`edit.cancel`, and each own action whose default keys
 * hold Escape). A vocabulary action no table binds yet passes. Each problem names the action, the
 * combination as written and, for a conflict, the other action. Never throws.
 */
export const keyOverridesProblems = (
  overrides: KeyOverrides,
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly KeyOverrideProblem[] => {
  if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
    return [{ rule: "notation", action: "keys", binding: shownText(overrides) }];
  }
  const tables = registered(types);
  const exits = escapeActions(tables);
  const actions = Object.keys(overrides);
  const found = actions.flatMap((action) =>
    actionProblems(action, overrides[action], tables, exits),
  );
  const written = writtenTexts(overrides, actions);
  for (const { table } of tables) {
    for (const problem of conflicts(effectiveKeys(table, overrides), actions, written)) {
      if (!found.some((other) => same(other, problem))) found.push(problem);
    }
  }
  return found;
};
