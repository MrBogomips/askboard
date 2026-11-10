// The key vocabulary (keyboard-shortcuts-help, design decision 2): the actions every widget with
// keys of its own binds to the same keys, as data. A widget type's key table (`KeyTable`) is built
// from it and checked against it (`check.ts`); the matcher (`match.ts`) reads the table at run time
// and the generated skills teach it. Plain data, no DOM (AD-1).

/**
 * The modifiers a binding holds. `mod` is exactly one of Ctrl and Cmd; `char` is a printed
 * character with Shift as the layout needs it and no Ctrl, Alt or Cmd. No other hold can be
 * written in a table, so Alt alone, Ctrl with Alt and AltGr combinations stay the browser's.
 * `mod+alt` (exactly one of Ctrl and Cmd, with Alt and no Shift) is the user's overrides' alone,
 * on `MOD_ALT_KEYS` (design decision 17): `KEY_HOLDS` does not list it and the table check refuses it.
 */
export type KeyHold = "none" | "shift" | "alt+shift" | "mod" | "mod+shift" | "mod+alt" | "char";

/** One binding: a UI Events `key` value (a letter in lower case) and the modifiers held. */
export type KeyBinding = { readonly key: string; readonly hold: KeyHold };

/**
 * The visible counterpart of an entry, for the two-way test of a toolbar against its table:
 * `tool`, `menu` and `pointer` (a click, Shift+click or drag the spec names) have one; `navigation`
 * and `panel` are exempt; `native` is keys a Radix or browser control takes by its documentation,
 * listed and taught but not matched by AskBoard's handler.
 */
export type KeyShows = "tool" | "menu" | "pointer" | "navigation" | "panel" | "native";

/** An action's entry in a key table (design decision 2). */
export type KeyEntry<Action extends string = string> = {
  /** A vocabulary action, or the type's own `<type>.<name>`. */
  readonly action: Action;
  /** The part of the widget the keys act in: `list`, `grid`, `editor`, `toolbar`, `edge`, `zoom`, `panel`, or the type's own. */
  readonly part: string;
  /** Empty only for an entry that shows as a tool or a menu. */
  readonly keys: readonly KeyBinding[];
  /** The view string key of the action's name. */
  readonly label: string;
  readonly shows: KeyShows;
  /**
   * Whether the keys still act while the item takes no edits (answered, locked, read-only, a
   * Snapshot), as the widget's component does: the keys panel of such an item lists these entries
   * and no other (design decision 2, review 1.6 S-3). Never an action that changes the answer.
   */
  readonly readOnly: boolean;
  /** `selected`: the keys act only while the widget holds a selection; otherwise the key goes on with its default. */
  readonly when?: "selected";
};

/** A widget type's key table. */
export type KeyTable<Action extends string = string> = readonly KeyEntry<Action>[];

/** The holds a binding of a key table may take; `mod+alt` is the user's overrides' alone. */
export const KEY_HOLDS: readonly KeyHold[] = Object.freeze([
  "none",
  "shift",
  "alt+shift",
  "mod",
  "mod+shift",
  "char",
]);

/** The keys `mod+alt` may take, in an override: ArrowLeft and ArrowRight switch tabs in Chrome on macOS. */
export const MOD_ALT_KEYS: readonly string[] = Object.freeze([
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
]);

/** The visible counterparts an entry may name. */
export const KEY_SHOWS: readonly KeyShows[] = Object.freeze([
  "tool",
  "menu",
  "pointer",
  "navigation",
  "panel",
  "native",
]);

/** One action of the vocabulary: its keys and whether it needs a selection. */
export type VocabularyKeys = {
  readonly keys: readonly KeyBinding[];
  readonly when?: "selected";
};

/** A binding with its modifiers, frozen. */
export const keyBinding = (key: string, hold: KeyHold = "none"): KeyBinding =>
  Object.freeze({ key, hold });

const keys = (...bindings: readonly KeyBinding[]): VocabularyKeys =>
  Object.freeze({ keys: Object.freeze(bindings) });

const keysWhenSelected = (...bindings: readonly KeyBinding[]): VocabularyKeys =>
  Object.freeze({ keys: Object.freeze(bindings), when: "selected" as const });

const alt = (key: string) => keyBinding(key, "alt+shift");
const mod = (key: string) => keyBinding(key, "mod+shift");

/**
 * The vocabulary (design decision 2), from the Tree and the keys the PO approved on 2026-11-09
 * (select all, select none, add after, add a child, delete beside Delete, adjust by percentage).
 * A widget that gives one of these actions a key gives it these keys. `move.*` is along the
 * widget's axis (the Tree's indent and outdent are its `move.right` and `move.left`), and
 * `move.top` and `move.bottom` are vertical only. `delete` keeps two pairs: Delete and Backspace,
 * and the same with Alt+Shift where Delete clears a cell (`check.ts`).
 */
export const KEY_VOCABULARY = Object.freeze({
  "cursor.up": keys(keyBinding("ArrowUp")),
  "cursor.down": keys(keyBinding("ArrowDown")),
  "cursor.left": keys(keyBinding("ArrowLeft")),
  "cursor.right": keys(keyBinding("ArrowRight")),
  "cursor.first": keys(keyBinding("Home")),
  "cursor.last": keys(keyBinding("End")),
  "select.toggle": keys(keyBinding(" ")),
  "select.extendUp": keys(keyBinding("ArrowUp", "shift")),
  "select.extendDown": keys(keyBinding("ArrowDown", "shift")),
  "select.all": keys(keyBinding("a", "mod")),
  "select.none": keysWhenSelected(keyBinding("Escape")),
  "move.up": keys(alt("ArrowUp")),
  "move.down": keys(alt("ArrowDown")),
  "move.left": keys(alt("ArrowLeft")),
  "move.right": keys(alt("ArrowRight")),
  "move.top": keys(alt("Home"), mod("ArrowUp")),
  "move.bottom": keys(alt("End"), mod("ArrowDown")),
  "add.after": keys(alt("Enter")),
  "add.child": keys(mod("Enter")),
  "edit.start": keys(keyBinding("Enter"), keyBinding("F2")),
  "edit.commit": keys(keyBinding("Enter")),
  "edit.cancel": keys(keyBinding("Escape")),
  delete: keys(keyBinding("Delete"), keyBinding("Backspace"), alt("Delete"), alt("Backspace")),
  "adjust.percent": keysWhenSelected(keyBinding("%", "char")),
  undo: keys(keyBinding("z", "mod")),
  "keys.open": keys(keyBinding("?", "char")),
  "toolbar.previous": keys(keyBinding("ArrowLeft")),
  "toolbar.next": keys(keyBinding("ArrowRight")),
  "toolbar.first": keys(keyBinding("Home")),
  "toolbar.last": keys(keyBinding("End")),
});

/** An action of the vocabulary. */
export type VocabularyAction = keyof typeof KEY_VOCABULARY;

/** Whether `action` is in the vocabulary: an own property, never an inherited name. */
export const isVocabularyAction = (action: string): action is VocabularyAction =>
  Object.hasOwn(KEY_VOCABULARY, action);

/** The view string key that names an action: `keys.action.` and the action's ID. */
export const vocabularyLabel = (action: string): string => `keys.action.${action}`;

// The vocabulary's actions that move, select or open and never change the answer: they act on an
// item that takes no edits unless a part says otherwise (an option's `readOnly`).
const ACTS_READ_ONLY: RegExp = /^(cursor|toolbar)\.|^keys\.open$/;

/**
 * A table's entry for a vocabulary action, with the vocabulary's keys and `when`. `label` names the
 * widget's own wording where it has one (a tool's name), else the action's label key; `keys` is a
 * subset only for `delete` (`check.ts`). `readOnly` is true for `cursor.*`, `toolbar.*` and
 * `keys.open` and false for the rest, and an option overrides it where a part says otherwise (the
 * cursor keys of the Gantt's predecessors panel, which opens only on an item that takes edits).
 */
export const vocabularyEntry = <const Action extends VocabularyAction>(
  action: Action,
  part: string,
  shows: KeyShows,
  options: {
    readonly label?: string;
    readonly keys?: readonly KeyBinding[];
    readonly readOnly?: boolean;
  } = {},
): KeyEntry<Action> => {
  const { keys: given, when } = KEY_VOCABULARY[action] as VocabularyKeys;
  return Object.freeze({
    action,
    part,
    keys: options.keys ?? given,
    label: options.label ?? vocabularyLabel(action),
    shows,
    readOnly: options.readOnly ?? ACTS_READ_ONLY.test(action),
    ...(when === undefined ? {} : { when }),
  });
};

/**
 * A table's entry for an action of the type's own, `<type>.<name>`. It states `readOnly`, whether
 * its keys act while the item takes no edits; `label` is the widget's own string key where it has
 * one, else the action's label key.
 */
export const ownEntry = <const Action extends string>(
  action: Action,
  part: string,
  bindings: readonly KeyBinding[],
  shows: KeyShows,
  options: { readonly readOnly: boolean; readonly label?: string },
): KeyEntry<Action> =>
  Object.freeze({
    action,
    part,
    keys: Object.freeze([...bindings]),
    label: options.label ?? vocabularyLabel(action),
    shows,
    readOnly: options.readOnly,
  });
