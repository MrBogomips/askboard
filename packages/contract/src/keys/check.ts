// The key table check (keyboard-shortcuts-help, design decision 2; contract spec, "Key tables in the
// registry"): what is wrong with a widget type's key table, run by the registry's check for each
// entry with `keys`. Each problem names the type and the action or the key, and one entry's problems
// never hide another's. Plain ECMAScript over data, so a table of another shape is a problem and
// never a throw.

import type { RegistryProblem } from "../widgets/registry.ts";
import {
  isVocabularyAction,
  KEY_HOLDS,
  KEY_SHOWS,
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyEntry,
  type KeyHold,
  type KeyShows,
  type KeyTable,
  MOD_ALT_KEYS,
  type VocabularyAction,
} from "./vocabulary.ts";

const HOLD_TEXT: Readonly<Record<KeyHold, string>> = {
  none: "",
  shift: "Shift+",
  "alt+shift": "Alt+Shift+",
  mod: "Ctrl/Cmd+",
  "mod+shift": "Ctrl/Cmd+Shift+",
  "mod+alt": "Ctrl/Cmd+Alt+",
  char: "",
};

// A binding as a message shows it; one that is no binding is shown as JSON.
const bindingText = (binding: KeyBinding): string =>
  `${Object.hasOwn(HOLD_TEXT, binding.hold) ? HOLD_TEXT[binding.hold] : `${String(binding.hold)}+`}${binding.key === " " ? "Space" : binding.key}`;

const shown = (value: unknown): string => JSON.stringify(value) ?? String(value);

// The keys `mod` takes: Cmd or Ctrl with Z (undo) and A (select all); every other letter, W and S
// among them, is the browser's. With Shift, the keys the vocabulary moves to the top or bottom and
// adds a child with.
const MOD_KEYS: ReadonlySet<string> = new Set(["z", "a"]);
const MOD_SHIFT_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "Enter"]);
const CHARS: ReadonlySet<string> = new Set(["?", "%"]);
const FUNCTION_KEYS = /^F(1|[3-9]|1[0-2])$/;

/**
 * Why a whole binding is a key the browser or the system needs, or undefined: Tab; F1 and F3 to
 * F12; Cmd or Ctrl with any key but Z and A; with Shift any but the arrows up and down and Enter; a
 * printed character but `?` and `%`; and Cmd or Ctrl with Alt on any key outside `MOD_ALT_KEYS`.
 * The table check and the overrides check (`overrides.ts`) share it.
 */
export const reservedProblem = ({ key, hold }: KeyBinding): string | undefined => {
  const text = bindingText({ key, hold });
  if (key === "Tab") return `the key ${text} is Tab, which moves the focus`;
  if (FUNCTION_KEYS.test(key)) return `the key ${text} is a function key the browser takes`;
  if (hold === "mod" && !MOD_KEYS.has(key)) return `the key ${text} is the browser's`;
  if (hold === "mod+shift" && !MOD_SHIFT_KEYS.has(key)) return `the key ${text} is the browser's`;
  if (hold === "mod+alt" && !MOD_ALT_KEYS.includes(key)) {
    return `the key ${text} is the browser's or the system's: Ctrl/Cmd with Alt takes only ArrowUp, ArrowDown, Home, End and Enter`;
  }
  if (hold === "char" && !CHARS.has(key)) return `the key ${text} is no character a table may take`;
  return undefined;
};

// A binding's own problem against the browser's and the system's keys, or undefined.
const bindingProblem = (binding: unknown): string | undefined => {
  if (typeof binding !== "object" || binding === null)
    return `a key ${shown(binding)} is no binding`;
  const { key, hold } = binding as { key: unknown; hold: unknown };
  if (typeof key !== "string" || key === "") return `a binding with the key ${shown(key)}`;
  if (hold === "mod+alt") {
    return `the key ${bindingText(binding as KeyBinding)} is Ctrl/Cmd with Alt, which only the user's overrides may bind`;
  }
  if (typeof hold !== "string" || !(KEY_HOLDS as readonly string[]).includes(hold)) {
    return `the key ${shown(`${String(hold)}+${key}`)} has a hold no binding can have`;
  }
  const text = bindingText(binding as KeyBinding);
  if (key.length === 1 && key !== key.toLowerCase())
    return `the key ${text} is a letter in upper case`;
  return reservedProblem(binding as KeyBinding);
};

// Whether a binding of this key and hold is among `keys` (a printed character stands for the
// plain key and Shift with it, which is what a press of it reads).
const holdsKey = (keys: readonly KeyBinding[], key: string, hold: KeyHold): boolean =>
  keys.some((binding) => binding.key === key && binding.hold === hold);

const DELETE_PLAIN: readonly KeyBinding[] = KEY_VOCABULARY.delete.keys.filter(
  ({ hold }) => hold === "none",
);
const DELETE_ALT: readonly KeyBinding[] = KEY_VOCABULARY.delete.keys.filter(
  ({ hold }) => hold === "alt+shift",
);

const holdsAll = (keys: readonly KeyBinding[], wanted: readonly KeyBinding[]): boolean =>
  wanted.every(({ key, hold }) => holdsKey(keys, key, hold));

const holdsAny = (keys: readonly KeyBinding[], wanted: readonly KeyBinding[]): boolean =>
  wanted.some(({ key, hold }) => holdsKey(keys, key, hold));

type Parsed = KeyEntry & { readonly keys: readonly KeyBinding[] };

// The keys of `delete` may be the plain pair (Delete, Backspace), with or without the same keys
// held with Alt and Shift; and the Alt+Shift pair alone where another action of the part takes the
// plain pair (a cell that Delete clears). Half a pair is a key left out.
const deleteProblem = (entry: Parsed, table: readonly Parsed[]): string | undefined => {
  const plain = holdsAll(entry.keys, DELETE_PLAIN);
  const alt = holdsAll(entry.keys, DELETE_ALT);
  const left = [...DELETE_PLAIN, ...DELETE_ALT].filter(
    (wanted) => !holdsKey(entry.keys, wanted.key, wanted.hold),
  );
  const added = entry.keys.filter(
    ({ key, hold }) =>
      !KEY_VOCABULARY.delete.keys.some((own) => own.key === key && own.hold === hold),
  );
  if (added.length > 0)
    return `has the keys ${added.map(bindingText).join(", ")} the vocabulary does not give it`;
  const half = (pair: readonly KeyBinding[]) =>
    holdsAny(entry.keys, pair) && !holdsAll(entry.keys, pair);
  if (half(DELETE_PLAIN) || half(DELETE_ALT) || (!plain && !alt)) {
    return `leaves out ${left.map(bindingText).join(", ")} of the vocabulary's keys`;
  }
  if (plain) return undefined;
  const taken = table.some(
    (other) =>
      other.part === entry.part &&
      other.action !== entry.action &&
      holdsAll(other.keys, DELETE_PLAIN),
  );
  return taken
    ? undefined
    : `leaves out ${DELETE_PLAIN.map(bindingText).join(", ")}, which no other action of the part "${entry.part}" takes`;
};

// The vocabulary's keys of an action against the entry's, and its `when`.
const vocabularyProblem = (
  action: VocabularyAction,
  entry: Parsed,
  table: readonly Parsed[],
): string | undefined => {
  const given = KEY_VOCABULARY[action];
  if (entry.when !== given.when) {
    return given.when === undefined
      ? `acts only on a selection, which the vocabulary's does not`
      : `does not act only on a selection, as the vocabulary's does`;
  }
  if (action === "delete") return deleteProblem(entry, table);
  const added = entry.keys.filter(({ key, hold }) => !holdsKey(given.keys, key, hold));
  const left = given.keys.filter(({ key, hold }) => !holdsKey(entry.keys, key, hold));
  if (added.length === 0 && left.length === 0) return undefined;
  const parts = [
    ...(added.length > 0 ? [`the keys ${added.map(bindingText).join(", ")} added`] : []),
    ...(left.length > 0 ? [`the keys ${left.map(bindingText).join(", ")} left out`] : []),
  ];
  return `has other keys than the vocabulary's: ${parts.join(" and ")}`;
};

const KEYLESS_SHOWS: ReadonlySet<KeyShows> = new Set(["tool", "menu"]);

// The actions that change the answer: their keys never act on an item that takes no edits.
const CHANGES_ANSWER = /^(move|add|edit)\.|^(delete|undo|adjust\.percent)$/;

// What is wrong with one entry on its own, each as a clause that follows its action.
const entryClauses = (type: string, entry: Parsed, table: readonly Parsed[]): string[] => {
  const clauses: string[] = [];
  const { action } = entry;
  if (!isVocabularyAction(action) && !action.startsWith(`${type}.`)) {
    clauses.push(`is neither a vocabulary action nor an action of the type, "${type}.<name>"`);
  } else if (!isVocabularyAction(action) && action === `${type}.`) {
    clauses.push(`has no name after "${type}."`);
  }
  if (typeof entry.part !== "string" || entry.part === "") clauses.push("has no part");
  if (typeof entry.label !== "string" || entry.label === "") clauses.push("has no label");
  if (!(KEY_SHOWS as readonly string[]).includes(entry.shows)) {
    clauses.push(`shows ${shown(entry.shows)}, which is no visible counterpart`);
  }
  if (typeof entry.readOnly !== "boolean") {
    clauses.push(`has readOnly ${shown(entry.readOnly)}, which is no boolean`);
  } else if (entry.readOnly && CHANGES_ANSWER.test(action)) {
    clauses.push(
      `changes the answer, so its keys cannot act while the item takes no edits (readOnly)`,
    );
  }
  if (entry.when !== undefined && entry.when !== "selected") {
    clauses.push(`has when ${shown(entry.when)}, and only "selected" is one`);
  }
  for (const binding of entry.keys) {
    const problem = bindingProblem(binding);
    if (problem !== undefined) clauses.push(problem);
  }
  if (entry.keys.length === 0 && !KEYLESS_SHOWS.has(entry.shows)) {
    clauses.push(`has no keys, and only an entry that shows as a tool or a menu may have none`);
  }
  if (
    isVocabularyAction(action) &&
    entry.keys.every((binding) => bindingProblem(binding) === undefined)
  ) {
    const problem = vocabularyProblem(action, entry, table);
    if (problem !== undefined) clauses.push(problem);
  }
  return clauses;
};

// The bindings a press of the key can trigger: a printed character, with or without Shift.
export const reads = (binding: KeyBinding): readonly string[] =>
  binding.hold === "char"
    ? [`none:${binding.key}`, `shift:${binding.key}`]
    : [`${binding.hold}:${binding.key}`];

// One problem per binding that two entries of a part, or one entry twice, take.
const twiceProblems = (type: string, table: readonly Parsed[]): string[] => {
  const taken = new Map<string, { binding: KeyBinding; actions: string[] }>();
  for (const entry of table) {
    for (const binding of entry.keys) {
      for (const id of new Set(reads(binding))) {
        const at = `${entry.part}\u0000${id}`;
        const found = taken.get(at) ?? { binding, actions: [] };
        found.actions.push(entry.action);
        taken.set(at, found);
      }
    }
  }
  const seen = new Set<string>();
  return [...taken.entries()].flatMap(([at, { binding, actions }]) => {
    if (actions.length < 2) return [];
    const part = at.slice(0, at.indexOf("\u0000"));
    const message = `the key table of "${type}" binds ${bindingText(binding)} twice in the part "${part}": to ${[...new Set(actions)].map((action) => `"${action}"`).join(" and ")}`;
    if (seen.has(message)) return [];
    seen.add(message);
    return [message];
  });
};

const isBinding = (value: unknown): value is KeyBinding => {
  if (typeof value !== "object" || value === null) return false;
  const { key, hold } = value as { key: unknown; hold: unknown };
  return typeof key === "string" && typeof hold === "string";
};

const isEntry = (value: unknown): value is Parsed => {
  if (typeof value !== "object" || value === null) return false;
  const { action, keys } = value as { action: unknown; keys: unknown };
  return typeof action === "string" && Array.isArray(keys);
};

/**
 * What is wrong with `table`, the key table of the type `type`: an action neither in the
 * vocabulary nor `<type>.<name>`; a vocabulary action whose keys differ from the vocabulary's by a
 * key added or left out, or whose `when` differs (`delete` is the plain pair, with or without the
 * Alt+Shift pair, or the Alt+Shift pair beside another action that takes the plain pair); one
 * binding twice in one part; Tab; F1 and F3 to F12; Cmd or Ctrl with any key but Z and A, and with
 * Shift any but the arrows up and down and Enter; a printed character but `?` and `%`; a hold no
 * binding can have; an empty label; a keyless entry that does not show as a tool or a menu; a
 * `readOnly` that is no boolean, or true on an action that changes the answer (`move.*`, `add.*`,
 * `delete`, `edit.*`, `undo`, `adjust.percent`). Each
 * problem is `rule: "keys"` and names the type and the action or the key.
 */
export const keyTableProblems = (type: string, table: KeyTable): readonly RegistryProblem[] => {
  const problem = (message: string): RegistryProblem => ({ type, rule: "keys", message });
  if (!Array.isArray(table)) return [problem(`the key table of "${type}" is no list of entries`)];
  // The other entries a check reads hold only bindings that are whole.
  const entries = (table as readonly unknown[])
    .filter(isEntry)
    .map((entry) => ({ ...entry, keys: entry.keys.filter(isBinding) }));
  const messages = (table as readonly unknown[]).flatMap((value, at) =>
    isEntry(value)
      ? entryClauses(type, value, entries).map(
          (clause) => `the key table of "${type}": "${value.action}" ${clause}`,
        )
      : [`the key table of "${type}" has an entry ${at} with no action or no list of keys`],
  );
  return [...messages, ...twiceProblems(type, entries)].map(problem);
};
