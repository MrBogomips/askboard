// The key-override notation (keyboard-shortcuts-help, design decision 17; contract spec: The
// key-override notation): a combination is its modifiers, each at most once and in any order, from
// `Mod` (Cmd or Ctrl), `Alt` and `Shift`, joined by `+` to a key: a UI Events `key` name, a letter
// (read as lower case), `Space` for the space bar, or `?` or `%` alone. Pure and total: a value
// that is no combination is refused with a reason, never thrown on. What a combination may bind is
// the overrides check's (`overrides.ts`), not the notation's: the keys the browser or the system
// takes, Alt with Shift on a key that types a character, and, for an action an `editor` part has, a
// key that types a character (`reservedProblem`, `editorKeyProblem` in `check.ts`). The notation
// itself writes only a letter, Space, `?` or `%` as a typing key, so the overrides check reads the
// same whatever `check.ts` counts as typing.

import { type KeyBinding, type KeyHold, keyBinding } from "./vocabulary.ts";

/** The most characters a combination may have. */
export const KEY_COMBINATION_MAX_CHARS = 32;

// The other bounds of the configuration schema's `keys` (`schemas/configuration/config.json`),
// which a reader that checks the shape without the schema holds too (the view's update; review
// 10.5, S-44). `configuration.test.ts` ties each to the schema.

/** The most actions `keys` may name. */
export const KEY_OVERRIDES_MAX_ACTIONS = 64;

/** The most characters an action's name may have. */
export const KEY_ACTION_MAX_CHARS = 64;

/** The most combinations one action may be given. */
export const KEY_OVERRIDE_MAX_COMBINATIONS = 4;

/** The user's key overrides: for an action, the combinations that replace its keys (`[]` removes them). */
export type KeyOverrides = { readonly [action: string]: readonly string[] };

/**
 * A combination read: its binding, or why it is no combination. A refusal's `rule` is `hold` when
 * the modifiers make no hold (Alt alone, Mod with Alt and Shift, a modifier on `?` or `%`) and
 * `notation` for every other fault; the overrides check reports it under that rule.
 */
export type KeyCombinationRead =
  | { readonly ok: true; readonly binding: KeyBinding }
  | { readonly ok: false; readonly rule: "notation" | "hold"; readonly reason: string };

const NAMED_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
  "Escape",
  "Tab",
  "Delete",
  "Backspace",
  ...Array.from({ length: 12 }, (_, at) => `F${at + 1}`),
]);

const CHARS: ReadonlySet<string> = new Set(["?", "%"]);
const MODIFIERS: ReadonlySet<string> = new Set(["Mod", "Alt", "Shift"]);

// The hold of a set of modifiers, in the notation's order: Mod, Alt, Shift.
const HOLDS: Readonly<Record<string, Exclude<KeyHold, "char">>> = {
  "": "none",
  Shift: "shift",
  "Alt+Shift": "alt+shift",
  Mod: "mod",
  "Mod+Shift": "mod+shift",
  "Mod+Alt": "mod+alt",
};

const refuse = (reason: string, rule: "notation" | "hold" = "notation"): KeyCombinationRead => ({
  ok: false,
  rule,
  reason,
});

const quoted = (text: string): string => JSON.stringify(text);

// The key of a combination's last part, or why it is none.
const keyOf = (name: string): { key: string } | { reason: string } => {
  if (name === "Space") return { key: " " };
  if (NAMED_KEYS.has(name) || CHARS.has(name)) return { key: name };
  if (/^[A-Za-z]$/.test(name)) return { key: name.toLowerCase() };
  if (MODIFIERS.has(name))
    return { reason: `${quoted(name)} is a modifier, and no key follows it` };
  return { reason: `${quoted(name)} is no key name of the notation` };
};

const ORDER = ["Mod", "Alt", "Shift"] as const;

/**
 * Reads a combination. It refuses, with a reason that names the part at fault: a value that is no
 * text, an empty text or part (a lone, leading or trailing `+`), a text over 32 characters, a
 * modifier twice, a modifier the notation lacks (`Ctrl`, `Cmd`, `Meta`, `Option`, `AltGraph`), a key
 * that is no name, `?` or `%` with a modifier, and a set of modifiers no hold has (Alt alone, Mod
 * with Alt and Shift).
 */
export const parseKeyCombination = (text: unknown): KeyCombinationRead => {
  if (typeof text !== "string") return refuse("a key combination is a text");
  if (text === "") return refuse("a key combination is empty");
  if (text.length > KEY_COMBINATION_MAX_CHARS) {
    return refuse(`a key combination has at most ${KEY_COMBINATION_MAX_CHARS} characters`);
  }
  const parts = text.split("+");
  if (parts.some((part) => part === "")) {
    return refuse(`${quoted(text)} has a "+" with nothing before or after it`);
  }
  const named = parts.slice(0, -1);
  const found = keyOf(parts[parts.length - 1] as string);
  const seen = new Set<string>();
  for (const name of named) {
    if (!MODIFIERS.has(name)) {
      return refuse(`${quoted(name)} is no modifier of the notation: Mod, Alt and Shift are`);
    }
    if (seen.has(name)) return refuse(`the modifier ${quoted(name)} is given twice`);
    seen.add(name);
  }
  if ("reason" in found) return refuse(found.reason);
  const modifiers = ORDER.filter((name) => seen.has(name)).join("+");
  if (CHARS.has(found.key)) {
    return modifiers === ""
      ? { ok: true, binding: keyBinding(found.key, "char") }
      : refuse(`${quoted(found.key)} takes no modifier: it is a printed character`, "hold");
  }
  const hold = HOLDS[modifiers];
  if (hold === undefined) {
    return refuse(
      `${quoted(text)} has no hold: no key is bound with ${quoted(modifiers)} alone`,
      "hold",
    );
  }
  return { ok: true, binding: keyBinding(found.key, hold) };
};

// The modifiers of each hold, in the notation's order.
const WRITTEN: Readonly<Record<Exclude<KeyHold, "char">, string>> = {
  none: "",
  shift: "Shift+",
  "alt+shift": "Alt+Shift+",
  mod: "Mod+",
  "mod+shift": "Mod+Shift+",
  "mod+alt": "Mod+Alt+",
};

/** A binding as the notation writes it: the modifiers as Mod, Alt, Shift, then the key (`Space`, a letter in lower case). */
export const keyCombinationText = ({ key, hold }: KeyBinding): string =>
  hold === "char" ? key : `${WRITTEN[hold]}${key === " " ? "Space" : key}`;
