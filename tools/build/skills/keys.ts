// The keys in the generated skills (keyboard-shortcuts-help, design decisions 6, 10 and 20): a
// widget type's Keys section from its key table, and the list of every action an override may name.
// Each action is named as the board's tooltips name it (the English string of its label, from
// `@askboard/view/strings`) and each key is written as on Linux with the macOS form beside it, as
// the board's `keyLabel` writes them (a test holds the two together). Pure.

import {
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyEntry,
  type VocabularyAction,
  type WidgetType,
} from "@askboard/contract";
import { type StringKey, t } from "@askboard/view/strings";

/** One binding as written on Linux and as written on macOS. */
export type KeyForms = { readonly linux: string; readonly mac: string };

const ARROWS: Readonly<Record<string, string>> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};
const MAC_NAMES: Readonly<Record<string, string>> = { Enter: "↩", Backspace: "⌫", Delete: "⌦" };
const NAMED: Readonly<Record<string, StringKey>> = {
  Enter: "key.enter",
  Escape: "key.escape",
  Home: "key.home",
  End: "key.end",
  Delete: "key.delete",
  Backspace: "key.backspace",
  " ": "key.space",
};

const english = (key: StringKey): string => t("en-US", key);

const keyName = (key: string, mac: boolean): string => {
  if (Object.hasOwn(ARROWS, key)) return ARROWS[key] as string;
  if (mac && Object.hasOwn(MAC_NAMES, key)) return MAC_NAMES[key] as string;
  if (Object.hasOwn(NAMED, key)) return english(NAMED[key] as StringKey);
  return key.length === 1 ? key.toUpperCase() : key;
};

const MAC: Readonly<Record<string, string>> = {
  none: "",
  shift: "⇧",
  "alt+shift": "⌥⇧",
  mod: "⌘",
  "mod+shift": "⇧⌘",
  "mod+alt": "⌥⌘",
};
const LINUX: Readonly<Record<string, readonly StringKey[]>> = {
  none: [],
  shift: ["key.shift"],
  "alt+shift": ["key.alt", "key.shift"],
  mod: ["key.ctrl"],
  "mod+shift": ["key.ctrl", "key.shift"],
  "mod+alt": ["key.ctrl", "key.alt"],
};

/** The two written forms of a binding. */
export const keyForms = (binding: KeyBinding): KeyForms => {
  if (binding.hold === "char") return { linux: binding.key, mac: binding.key };
  return {
    linux: [...(LINUX[binding.hold] ?? []).map(english), keyName(binding.key, false)].join("+"),
    mac: `${MAC[binding.hold] ?? ""}${keyName(binding.key, true)}`,
  };
};

const joined = (words: readonly string[]): string => words.join(" and ");

/** The keys of an entry or an action: `Linux form (macOS form)`, bindings joined by "and". */
export const keysText = (keys: readonly KeyBinding[]): string => {
  const forms = keys.map(keyForms);
  return `${joined(forms.map(({ linux }) => linux))} (${joined(forms.map(({ mac }) => mac))})`;
};

/** The English name of an action, as the board's tooltip names it. */
export const actionName = (label: string): string => english(label as StringKey);

const withKeys = (table: readonly KeyEntry[] | undefined): readonly KeyEntry[] =>
  (table ?? []).filter(({ keys }) => keys.length > 0);

const qualifier = ({ when, shows }: KeyEntry): string =>
  [
    ...(when === "selected" ? ["with a selection"] : []),
    ...(shows === "native" ? ["a control's own keys, not changeable"] : []),
  ].join(", ");

const PANEL_NOTE =
  "These are the default keys. The board's keys panel (the Keys button, or `?`) shows the keys in effect, which the user may have changed in the user configuration file.";

/** The Keys section of a widget type's reference: a table of its entries that have keys; empty when it has none. */
export const keysSection = (entry: WidgetType): string => {
  const rows = withKeys(entry.keys);
  if (rows.length === 0) return "";
  return [
    "## Keys",
    "",
    PANEL_NOTE,
    "",
    "| Action | Where | Keys (macOS) |",
    "|---|---|---|",
    ...rows.map((row) => {
      const note = qualifier(row);
      return `| ${actionName(row.label)}${note === "" ? "" : ` (${note})`} | ${row.part} | ${keysText(row.keys)} |`;
    }),
  ].join("\n");
};

/** One action an override may name, with its English name and default keys. */
export type ActionRow = {
  readonly action: string;
  readonly name: string;
  readonly keys: readonly KeyBinding[];
  readonly note: string;
};

/**
 * Every vocabulary action, then every own action some table binds with keys, in the order the
 * vocabulary and the registry list them. A vocabulary action takes its name from the first table
 * that binds it, else from its label key.
 */
export const actionRows = (widgets: readonly WidgetType[]): readonly ActionRow[] => {
  const entries = widgets.flatMap(({ keys }) => withKeys(keys));
  const first = (action: string) => entries.find((entry) => entry.action === action);
  const nativeOnly = (action: string) =>
    entries.filter((entry) => entry.action === action).every(({ shows }) => shows === "native");
  const vocabulary = (Object.keys(KEY_VOCABULARY) as VocabularyAction[]).map((action) => {
    const given = KEY_VOCABULARY[action];
    const found = first(action);
    const notes = [
      ...(given.when === "selected" ? ["with a selection"] : []),
      ...(found !== undefined && nativeOnly(action)
        ? ["a control's own keys, not changeable"]
        : []),
    ];
    return {
      action,
      name: actionName(found?.label ?? `keys.action.${action}`),
      keys: given.keys,
      note: notes.join(", "),
    };
  });
  const own: ActionRow[] = [];
  for (const entry of entries) {
    if (Object.hasOwn(KEY_VOCABULARY, entry.action)) continue;
    if (own.some(({ action }) => action === entry.action)) continue;
    own.push({
      action: entry.action,
      name: actionName(entry.label),
      keys: entry.keys,
      note: nativeOnly(entry.action) ? "a control's own keys, not changeable" : "",
    });
  }
  return [...vocabulary, ...own];
};

/** One line of `key-actions.md`. */
export const actionLine = ({ action, name, keys, note }: ActionRow): string =>
  `- \`${action}\`: ${name}, ${keysText(keys)}${note === "" ? "" : `; ${note}`}`;
