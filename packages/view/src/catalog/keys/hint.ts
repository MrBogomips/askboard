// The content of a key hint and of the keys panel, from a widget type's key table (keyboard-
// shortcuts-help, design decision 5; specs: Keyboard shortcuts are discoverable, The keys panel).
// Pure: the component files only draw it.

import {
  ariaKeyShortcuts,
  type KeyEntry,
  type KeyPress,
  type KeyTable,
  keyActionOf,
  vocabularyEntry,
} from "@askboard/contract";
import { STRINGS, type StringKey } from "../../strings/index.ts";
import type { Say } from "../port.ts";
import { type KeyPlatform, keyLabel } from "./label.ts";

/** The text of an entry's label: the string it names, else the label itself (a test checks each is a key). */
export const labelText = (say: Say, label: string): string =>
  Object.hasOwn(STRINGS["en-US"], label) ? say(label as StringKey) : label;

/** What a hint shows and announces for one entry. */
export type Hint = {
  /** The action's name, in the board's language. */
  readonly name: string;
  /** One cap per binding, as the platform writes it. */
  readonly caps: readonly string[];
  /** The `aria-keyshortcuts` value, in WAI-ARIA's names on every platform. */
  readonly aria: string;
};

/** The hint of an entry; none for a keyless one, which gets no tooltip and no `aria-keyshortcuts`. */
export const hintOf = (entry: KeyEntry, platform: KeyPlatform, say: Say): Hint | undefined =>
  entry.keys.length === 0
    ? undefined
    : {
        name: labelText(say, entry.label),
        caps: entry.keys.map((binding) => keyLabel(binding, platform, say)),
        aria: ariaKeyShortcuts(entry.keys),
      };

/** The Keys button's own entry: the vocabulary's `keys.open`, named "Keys". */
export const KEYS_OPEN_ENTRY: KeyEntry = vocabularyEntry("keys.open", "list", "panel", {
  label: "keys.button",
});

/**
 * Whether a press opens the keys panel: `?`, with or without Shift as the layout needs it, outside
 * a text field and while no input method composes (the matcher's rules for `keys.open`).
 */
export const opensKeysPanel = (press: KeyPress): boolean =>
  keyActionOf([KEYS_OPEN_ENTRY], KEYS_OPEN_ENTRY.part, press, false) !== undefined;

/** The groups of the panel, in order. */
export const PANEL_GROUPS = ["cursor", "selection", "move", "edit", "other"] as const;
export type PanelGroup = (typeof PANEL_GROUPS)[number];

const GROUP_TITLES: Readonly<Record<PanelGroup, StringKey>> = {
  cursor: "keys.group.cursor",
  selection: "keys.group.selection",
  move: "keys.group.move",
  edit: "keys.group.edit",
  other: "keys.group.other",
};

const EDIT_FAMILIES: ReadonlySet<string> = new Set(["edit", "add", "delete", "undo", "adjust"]);

/** The group an action belongs to, by its family: the type's own actions are `other`. */
export const groupOf = (action: string): PanelGroup => {
  const family = action.split(".")[0] ?? "";
  if (family === "cursor" || family === "toolbar") return "cursor";
  if (family === "select") return "selection";
  if (family === "move") return "move";
  return EDIT_FAMILIES.has(family) ? "edit" : "other";
};

/** One row of the panel. */
export type PanelRow = { readonly name: string; readonly caps: readonly string[] };

/** One group of the panel. */
export type PanelGroupRows = {
  readonly id: PanelGroup;
  readonly title: string;
  readonly rows: readonly PanelRow[];
};

/**
 * The panel's groups for a table: each entry that has keys, in the table's order, in the group of
 * its action; an item that takes no edits lists only the entries that still act (`readOnly`,
 * review 1.6 S-3). A group with no row is left out, and a keyless entry is never listed.
 */
export const panelGroups = (
  table: KeyTable,
  takesEdits: boolean,
  platform: KeyPlatform,
  say: Say,
): readonly PanelGroupRows[] => {
  const listed = table.filter((entry) => entry.keys.length > 0 && (takesEdits || entry.readOnly));
  return PANEL_GROUPS.flatMap((id) => {
    const rows = listed
      .filter((entry) => groupOf(entry.action) === id)
      .map((entry) => ({
        name: labelText(say, entry.label),
        caps: entry.keys.map((binding) => keyLabel(binding, platform, say)),
      }));
    return rows.length === 0 ? [] : [{ id, title: say(GROUP_TITLES[id]), rows }];
  });
};
