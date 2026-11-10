// What the user reads of a key (keyboard-shortcuts-help, design decision 4; spec: Key labels by
// platform): on macOS the symbols ⌃⌥⇧⌘ in that order, then the key, with ↩ ⌫ ⌦; elsewhere the
// names joined by `+`; arrows as ↑ ↓ ← → everywhere; the names from the strings, so that the board's
// language writes them. `aria-keyshortcuts` is the contract's `ariaKeyShortcuts`, not this.

import type { KeyBinding, KeyHold } from "@askboard/contract";
import type { StringKey } from "../../strings/index.ts";
import type { Say } from "../port.ts";

/** The platform whose key names are written: macOS, or any other. */
export type KeyPlatform = "mac" | "other";

/** The platform a user agent names: `Macintosh` or `Mac OS X` is macOS. */
export const platformOf = (userAgent: string): KeyPlatform =>
  /Macintosh|Mac OS X/.test(userAgent) ? "mac" : "other";

const ARROWS: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

const MAC_KEYS: Readonly<Record<string, string>> = { Enter: "↩", Backspace: "⌫", Delete: "⌦" };

const NAMED: Readonly<Record<string, StringKey>> = {
  Enter: "key.enter",
  Escape: "key.escape",
  Home: "key.home",
  End: "key.end",
  Delete: "key.delete",
  Backspace: "key.backspace",
  " ": "key.space",
};

const keyName = (key: string, platform: KeyPlatform, say: Say): string => {
  if (Object.hasOwn(ARROWS, key)) return ARROWS[key] as string;
  if (platform === "mac" && Object.hasOwn(MAC_KEYS, key)) return MAC_KEYS[key] as string;
  if (Object.hasOwn(NAMED, key)) return say(NAMED[key] as StringKey);
  return key.length === 1 ? key.toUpperCase() : key;
};

// The modifiers of a hold, in the order each platform writes them.
const MAC_MODIFIERS: Readonly<Record<Exclude<KeyHold, "char">, string>> = {
  none: "",
  shift: "⇧",
  "alt+shift": "⌥⇧",
  mod: "⌘",
  "mod+shift": "⇧⌘",
  "mod+alt": "⌥⌘",
};

const OTHER_MODIFIERS: Readonly<Record<Exclude<KeyHold, "char">, readonly StringKey[]>> = {
  none: [],
  shift: ["key.shift"],
  "alt+shift": ["key.alt", "key.shift"],
  mod: ["key.ctrl"],
  "mod+shift": ["key.ctrl", "key.shift"],
  "mod+alt": ["key.ctrl", "key.alt"],
};

/** The label of one binding on `platform`, its key names in the language `say` speaks. */
export const keyLabel = (binding: KeyBinding, platform: KeyPlatform, say: Say): string => {
  if (binding.hold === "char") return binding.key;
  const key = keyName(binding.key, platform, say);
  if (platform === "mac") return `${MAC_MODIFIERS[binding.hold]}${key}`;
  return [...OTHER_MODIFIERS[binding.hold].map((name) => say(name)), key].join("+");
};

let held: KeyPlatform | undefined;

/**
 * The platform of this page, read once from `navigator.userAgent`; tests pass the platform to
 * `keyLabel` instead of reading it here.
 */
export const useKeyPlatform = (): KeyPlatform => {
  if (held === undefined) {
    held = platformOf(typeof navigator === "undefined" ? "" : navigator.userAgent);
  }
  return held;
};
