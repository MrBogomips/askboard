// The settings panel's Keys row and the wording of the warnings about the user's keys
// (keyboard-shortcuts-help, design decision 19; view spec: The settings panel). Pure: text for the
// panel's DOM, built from the settings message. An action, a combination, a key and a JSON pointer
// are text a file chose, so each goes into a sentence escaped by the contract's helper and between
// U+2068 and U+2069, which isolate it from the sentence around it; the panel's DOM puts it on the
// page as a text node, never as markup (AD-8).

import {
  escapeFileText,
  type KeyOverrideRule,
  type Locale,
  type SettingsMessage,
  type SettingWarning,
} from "@askboard/contract";
import { t } from "../strings/index.ts";
import type { StringKey } from "../strings/keys.ts";

/**
 * File text as a sentence shows it: escaped (no control, separator or bidirectional control raw),
 * between U+2068 and U+2069. The helper escapes a file's own U+2069, so it cannot end the isolate.
 */
export const isolated = (text: string): string => `⁨${escapeFileText(text)}⁩`;

/** The Keys row: read-only, at the end of the presentation group. */
export type PanelKeysRow = {
  readonly label: string;
  /** "Default keys", or how many actions the user's file changed. */
  readonly value: string;
  /** `<user file> · keys`. */
  readonly source: string;
  /** That a change applies to the boards opened after it. */
  readonly note: string;
  /** The project's keys ignored, then each problem of the user's keys, worded in full. */
  readonly warnings: readonly string[];
};

// What each rule names in its sentence: a warning lacking one of them (a message built past the
// schema, which bounds but does not require them) gets the generic problem, never an unfilled slot.
const PROBLEMS: Readonly<
  Record<KeyOverrideRule, { readonly key: StringKey; readonly needs: readonly Field[] }>
> = {
  action: { key: "settings.keysProblem.action", needs: ["action"] },
  native: { key: "settings.keysProblem.native", needs: ["action"] },
  notation: { key: "settings.keysProblem.notation", needs: ["action", "binding"] },
  hold: { key: "settings.keysProblem.hold", needs: ["action", "binding"] },
  reserved: { key: "settings.keysProblem.reserved", needs: ["action", "binding"] },
  conflict: { key: "settings.keysProblem.conflict", needs: ["action", "binding", "with"] },
  exit: { key: "settings.keysProblem.exit", needs: ["action"] },
};

type Field = "action" | "binding" | "with";

// An own property only: a rule named `toString` or `constructor` is no rule.
const problemOf = (rule: unknown) =>
  typeof rule === "string" && Object.hasOwn(PROBLEMS, rule)
    ? PROBLEMS[rule as KeyOverrideRule]
    : undefined;

const problemText = (warning: SettingWarning, language: Locale): string => {
  const problem = problemOf(warning.rule);
  if (problem === undefined || problem.needs.some((field) => warning[field] === undefined)) {
    return t(language, "settings.keysProblem.unknown");
  }
  const slots = Object.fromEntries(
    problem.needs.map((field) => [field, isolated(warning[field] as string)]),
  );
  return t(language, problem.key, slots);
};

/** One warning of the keys, worded in full by its code and rule. */
export const keysWarningText = (warning: SettingWarning, language: Locale, file: string): string =>
  warning.code === "project-keys-ignored"
    ? t(language, "settings.warningProjectKeys", { file })
    : t(language, "settings.warningKeysNotApplied", {
        file,
        problem: problemText(warning, language),
      });

/** The warnings that belong to the Keys row: the project's keys ignored, and the user's problems. */
const isKeysWarning = (warning: SettingWarning): boolean =>
  warning.code === "project-keys-ignored" || warning.code === "keys-not-applied";

/** The warnings of the message that the Keys row holds, the project's first (`ask-core`'s order). */
export const keysWarningsOf = (message: SettingsMessage): readonly SettingWarning[] =>
  [...message.warnings, ...(message.keys.keys?.warnings ?? [])]
    .filter(isKeysWarning)
    .sort(
      (a, b) =>
        Number(b.code === "project-keys-ignored") - Number(a.code === "project-keys-ignored"),
    );

/** The warnings no row holds, once the Keys row has taken its own. */
export const otherWarningsOf = (message: SettingsMessage): readonly SettingWarning[] =>
  message.warnings.filter((warning) => !isKeysWarning(warning));

/** The Keys row for the settings in effect; `userFile` and `projectFile` are the files as the panel names them. */
export const keysRowOf = (
  message: SettingsMessage,
  language: Locale,
  userFile: string,
  projectFile: string,
): PanelKeysRow => {
  const row = message.keys.keys;
  const changed =
    row?.from === "user" && row.value !== undefined ? Object.keys(row.value).length : 0;
  return {
    label: t(language, "settings.keys"),
    value:
      row?.from === "user"
        ? t(language, "settings.keysChanged", { count: changed })
        : t(language, "settings.keysDefault"),
    source: `${userFile} · keys`,
    note: t(language, "settings.keysNote"),
    warnings: keysWarningsOf(message).map((warning) =>
      keysWarningText(warning, language, warning.file === "project" ? projectFile : userFile),
    ),
  };
};
