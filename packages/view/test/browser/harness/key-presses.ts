// Playwright presses for a binding of a key table (keyboard-shortcuts-help, task 4.9): what a
// browser test presses for each key of `RANKING_KEYS` and the like, read from the contract so that
// the test never keeps a list of its own. `mod` is pressed as Control and as Meta, a `char` as its
// character, and the holds Shift and Alt+Shift as written.

import type { KeyBinding } from "@askboard/contract";

const KEY_NAMES: Readonly<Record<string, string>> = { " ": "Space" };

const HOLDS: Readonly<Record<string, readonly string[]>> = {
  none: [""],
  shift: ["Shift+"],
  "alt+shift": ["Alt+Shift+"],
  mod: ["Control+", "Meta+"],
  "mod+shift": ["Control+Shift+", "Meta+Shift+"],
  "mod+alt": ["Control+Alt+", "Meta+Alt+"],
};

/** The presses of one binding, as `page.keyboard.press` takes them. */
export const pressesOf = (binding: KeyBinding): string[] => {
  if (binding.hold === "char") return [binding.key];
  const key = KEY_NAMES[binding.key] ?? binding.key;
  return (HOLDS[binding.hold] ?? []).map((hold) => `${hold}${key}`);
};
