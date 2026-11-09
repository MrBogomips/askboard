// What the settings panel shows (settings-languages, design decision 10; DESIGN.md, Settings
// panel), from the settings `board-host` sent, the presentation in effect on this board and the
// ask's language and locale: three groups, as text the panel's DOM puts on the page. Pure, so
// that it is tested without a document. The strings come from the catalogue in the ask's language.

import {
  ASKBOARD_FOLDER,
  type ConfigurationKey,
  type Locale,
  PRESENTATION_KEYS,
  type PresentationKey,
  type SettingRow,
  type SettingsFileName,
  type SettingsMessage,
  type SettingWarning,
} from "@askboard/contract";
import { t } from "../strings/index.ts";
import type { StringKey } from "../strings/keys.ts";
import type { ViewPresentation } from "../view-protocol.ts";
import {
  isolated,
  keysRowOf,
  keysWarningText,
  otherWarningsOf,
  type PanelKeysRow,
} from "./settings-keys-data.ts";

/** One choice of a segmented control. */
export type PanelSegment = { readonly value: string; readonly label: string };

/** A presentation key's control: its choices, the one in effect and why it is read-only. */
export type PanelControl = {
  readonly key: PresentationKey;
  readonly label: string;
  readonly segments: readonly PanelSegment[];
  readonly value: string;
  /** The file and key that fix it; set when the control is read-only. */
  readonly fixedBy?: string;
  /** A failed or refused write of this key, naming the file's path. */
  readonly error?: string;
};

/** A behaviour key: the value in effect, where it comes from, and what to say besides. */
export type PanelRow = {
  readonly key: ConfigurationKey;
  readonly label: string;
  readonly value: string;
  /** `<file> · <key>`, or `default` with the user file and key. */
  readonly source: string;
  /** The other file's value when both set the key. */
  readonly alsoIn?: string;
  readonly warnings: readonly string[];
};

export type { PanelKeysRow };

export type PanelData = {
  readonly title: string;
  readonly closeLabel: string;
  readonly controls: readonly PanelControl[];
  /** The user's key overrides, read-only, at the end of the presentation group. */
  readonly keys: PanelKeysRow;
  readonly languageLabel: string;
  readonly language: string;
  /** Files that were not applied, shown once above the behaviour group. */
  readonly notApplied: readonly string[];
  readonly nextSession: string;
  readonly rows: readonly PanelRow[];
  /** Warnings no row holds. */
  readonly warnings: readonly string[];
};

const USER_PATH = "~/.config/askboard/config.json";
const PROJECT_PATH = `${ASKBOARD_FOLDER}/config.json`;

const CHOICES: Readonly<Record<PresentationKey, readonly (readonly [string, StringKey])[]>> = {
  theme: [
    ["system", "toggles.system"],
    ["light", "toggles.light"],
    ["dark", "toggles.dark"],
  ],
  density: [
    ["compact", "toggles.compact"],
    ["comfortable", "toggles.comfortable"],
  ],
  contextPlacement: [
    ["beside", "settings.beside"],
    ["inline", "settings.inline"],
  ],
};

const LABELS: Readonly<Record<PresentationKey, StringKey>> = {
  theme: "toggles.theme",
  density: "toggles.density",
  contextPlacement: "settings.contextPlacement",
};

const ROWS: readonly (readonly [Exclude<ConfigurationKey, "keys">, StringKey])[] = [
  ["defaultLanguage", "settings.defaultLanguage"],
  ["askingRule", "settings.askingRules"],
  ["snapshotFolder", "settings.snapshotFolder"],
  ["editor", "settings.editor"],
];

const PROBLEMS = {
  unreadable: "settings.problemUnreadable",
  "not-json": "settings.problemNotJson",
  version: "settings.problemVersion",
  schema: "settings.problemSchema",
} as const satisfies Record<string, StringKey>;

const WARNINGS = {
  "unknown-key": "settings.warningUnknownKey",
  "project-editor-ignored": "settings.warningProjectEditor",
  "editor-file-writable-by-others": "settings.warningWritableByOthers",
  "snapshot-folder-replaced": "settings.warningSnapshotFolder",
} as const satisfies Partial<Record<SettingWarning["code"], StringKey>>;

const isOther = (code: SettingWarning["code"]): code is keyof typeof WARNINGS =>
  Object.hasOwn(WARNINGS, code);

const pathOf = (message: SettingsMessage, file: SettingsFileName): string =>
  message.files[file].path ?? (file === "user" ? USER_PATH : PROJECT_PATH);

const textOf = (value: unknown): string => (Array.isArray(value) ? value.join(" ") : String(value));

/** The ask's language as the Language row shows it, with its formats when its locale differs. */
export const languageIndicator = (language: Locale, locale: Locale): string => {
  const name = t(language, language === "it-IT" ? "settings.italian" : "settings.english");
  const base = `${name} (${language})`;
  return locale === language ? base : `${base} · ${t(language, "settings.formats", { locale })}`;
};

const controlOf = (
  key: PresentationKey,
  presentation: ViewPresentation,
  language: Locale,
  message: SettingsMessage,
): PanelControl => {
  const { write } = message;
  const failed = write?.key === key && write.outcome !== "saved";
  const reason = write?.reason ?? "";
  let error: string | undefined;
  if (failed && write.outcome === "failed") {
    const path = write.path ?? pathOf(message, "user");
    error = t(language, "settings.writeFailed", { key, path, reason });
  } else if (failed) {
    error = t(language, "settings.writeRefused", { key, reason });
  }
  return {
    key,
    label: t(language, LABELS[key]),
    segments: CHOICES[key].map(([value, label]) => ({ value, label: t(language, label) })),
    value: presentation[key],
    ...(presentation.locked.includes(key) ? { fixedBy: `${PROJECT_PATH} · ${key}` } : {}),
    ...(error === undefined ? {} : { error }),
  };
};

// The warnings of the keys are the Keys row's (`settings-keys-data.ts`); a row or the message's own
// list holds the other codes, and one of the keys' that strayed there is worded as the row words it.
const warningText = (warning: SettingWarning, language: Locale, message: SettingsMessage) =>
  isOther(warning.code)
    ? otherWarningText(warning.code, warning, language, message)
    : keysWarningText(warning, language, pathOf(message, warning.file));

const otherWarningText = (
  code: keyof typeof WARNINGS,
  warning: SettingWarning,
  language: Locale,
  message: SettingsMessage,
) =>
  t(language, WARNINGS[code], {
    key: isolated(warning.key),
    file: pathOf(message, warning.file),
    value: isolated(warning.value ?? ""),
  });

const rowOf = (
  key: ConfigurationKey,
  label: string,
  row: SettingRow<unknown>,
  language: Locale,
  message: SettingsMessage,
): PanelRow => {
  const source =
    row.from === "default"
      ? `${t(language, "settings.default")} · ${pathOf(message, "user")} · ${key}`
      : `${pathOf(message, row.from)} · ${key}`;
  const other = row.other;
  return {
    key,
    label,
    value: row.value === undefined ? t(language, "settings.notSet") : textOf(row.value),
    source,
    ...(other === undefined
      ? {}
      : {
          alsoIn: t(language, "settings.alsoIn", {
            file: pathOf(message, other.file),
            value: textOf(other.value),
          }),
        }),
    warnings: (row.warnings ?? []).map((warning) => warningText(warning, language, message)),
  };
};

const notAppliedOf = (message: SettingsMessage, language: Locale): string[] =>
  (["user", "project"] as const).flatMap((name) => {
    const file = message.files[name];
    if (file.status !== "not-applied") return [];
    const { code, pointer, error } = file.problem;
    const problem = t(language, PROBLEMS[code], {
      pointer: isolated(pointer ?? "/"),
      error: error ?? "?",
    });
    return [t(language, "settings.notApplied", { file: pathOf(message, name), problem })];
  });

/** The panel's three groups for the settings in effect. */
export const panelData = (
  message: SettingsMessage,
  presentation: ViewPresentation,
  language: Locale,
  locale: Locale,
): PanelData => ({
  title: t(language, "settings.title"),
  closeLabel: t(language, "settings.close"),
  controls: PRESENTATION_KEYS.map((key) => controlOf(key, presentation, language, message)),
  keys: keysRowOf(message, language, pathOf(message, "user"), pathOf(message, "project")),
  languageLabel: t(language, "settings.language"),
  language: languageIndicator(language, locale),
  notApplied: notAppliedOf(message, language),
  nextSession: t(language, "settings.nextSession"),
  rows: ROWS.map(([key, label]) =>
    rowOf(key, t(language, label), message.keys[key], language, message),
  ),
  warnings: otherWarningsOf(message).map((warning) => warningText(warning, language, message)),
});
