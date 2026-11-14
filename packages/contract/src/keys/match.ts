// The matcher (keyboard-shortcuts-help, design decision 3): which entry of a key table a key press
// triggers, pure. It is the Tree's `holdOf` and `keyAction` made general: a handler maps the entry's
// action through a typed record, and a key no entry names is left to the browser.

import type { KeyBinding, KeyEntry, KeyHold } from "./vocabulary.ts";

/** The hold a press has: one a binding can name, or `other` (Alt alone, Ctrl with Alt, a second modifier). */
export type PressHold = Exclude<KeyHold, "char"> | "other";

/**
 * A key press as the matcher reads it: the UI Events `key`, its hold, whether an input method is
 * composing and whether the target is a text field. The view's port reads an event into it.
 */
export type KeyPress = {
  readonly key: string;
  readonly hold: PressHold;
  readonly composing: boolean;
  readonly inText: boolean;
};

/** The modifier flags of a DOM or React keyboard event. */
export type Modifiers = {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
};

/**
 * The hold of a press: none, exactly Shift, exactly Alt and Shift, exactly one of Ctrl and Cmd
 * with or without Shift, or exactly one of Ctrl and Cmd with Alt and no Shift (`mod+alt`, which
 * only an override binds); any other combination (Alt alone, Ctrl with Cmd, a third modifier) is
 * `other` and is the browser's or the system's.
 */
export const pressHold = ({ altKey, ctrlKey, metaKey, shiftKey }: Modifiers): PressHold => {
  if (ctrlKey || metaKey) {
    if (ctrlKey === metaKey) return "other";
    if (altKey) return shiftKey ? "other" : "mod+alt";
    return shiftKey ? "mod+shift" : "mod";
  }
  if (altKey) return shiftKey ? "alt+shift" : "other";
  return shiftKey ? "shift" : "none";
};

// A letter compares in either case (Caps Lock); every other key value compares as it is.
const nameOf = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

const matches = (binding: KeyBinding, press: KeyPress): boolean => {
  if (binding.hold === "char") {
    // A printed character, with Shift as the layout needs it, and no Ctrl, Alt or Cmd.
    return binding.key === press.key && (press.hold === "none" || press.hold === "shift");
  }
  return binding.hold === press.hold && nameOf(binding.key) === nameOf(press.key);
};

/**
 * The entry of `part` that `press` triggers, or undefined when the key is the browser's. A press
 * while an input method composes matches nothing; a press on a text field matches only an entry
 * of the `editor` part; an entry with `when: selected` matches only while `selected`. The first
 * entry that matches wins; the table check refuses a binding twice in one part.
 */
export const keyActionOf = <Entry extends KeyEntry>(
  table: readonly Entry[],
  part: string,
  press: KeyPress,
  selected: boolean,
): Entry | undefined => {
  if (press.composing || (press.inText && part !== "editor")) return undefined;
  return table.find(
    (entry) =>
      entry.part === part &&
      (entry.when !== "selected" || selected) &&
      entry.keys.some((binding) => matches(binding, press)),
  );
};
