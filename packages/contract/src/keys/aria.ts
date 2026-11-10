// `aria-keyshortcuts` from a key table (keyboard-shortcuts-help, design decision 4), pure: WAI-ARIA
// 1.2's form. The spacebar is `Space` (the one exception to UI Events' key values), a letter is
// written in upper case (either case is equivalent), the modifiers come first, and `mod` names
// both Control and Meta, as the Tree's undo does. A printed character (`char`) is the character
// itself, since the layout that types it is not known here.

import type { KeyBinding } from "./vocabulary.ts";

const nameOf = (key: string): string => {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
};

const MODIFIERS: Readonly<Record<Exclude<KeyBinding["hold"], "char">, readonly string[]>> = {
  none: [""],
  shift: ["Shift+"],
  "alt+shift": ["Alt+Shift+"],
  mod: ["Control+", "Meta+"],
  "mod+shift": ["Control+Shift+", "Meta+Shift+"],
  "mod+alt": ["Control+Alt+", "Meta+Alt+"],
};

const shortcutsOf = ({ key, hold }: KeyBinding): readonly string[] =>
  hold === "char" ? [key] : MODIFIERS[hold].map((modifiers) => `${modifiers}${nameOf(key)}`);

/** The `aria-keyshortcuts` value of an entry's keys: space-separated, in the table's order. */
export const ariaKeyShortcuts = (keys: readonly KeyBinding[]): string =>
  keys.flatMap(shortcutsOf).join(" ");
