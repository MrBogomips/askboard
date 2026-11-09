// The settings in effect (settings-languages design decision 4): each key from the project file,
// else the user file, else its default, with where it came from, the other file's value when both
// set it, and the warnings a board shows beside it.

import {
  CONFIGURATION_DEFAULTS,
  CONFIGURATION_KEYS,
  type ConfigurationKey,
  type ConfigurationValues,
  PRESENTATION_KEYS,
  type SettingRow,
  type SettingSource,
  type SettingsFile,
  type SettingsFileName,
  type SettingsRows,
  type SettingWarning,
} from "@askboard/contract";
import type { FileState } from "./file.ts";
import type { Config } from "./ports.ts";
import { ROW_WARNINGS_MAX, screened } from "./rules.ts";

/** Each key's value in effect; `editor`, `defaultMinimumMargin` and `keys` only when one is. */
export type EffectiveValues = {
  readonly [K in keyof typeof CONFIGURATION_DEFAULTS]: ConfigurationValues[K];
} & Partial<Pick<ConfigurationValues, "editor" | "defaultMinimumMargin" | "keys">>;

export type SettingsInEffect = {
  readonly values: EffectiveValues;
  readonly rows: SettingsRows;
  readonly files: { readonly user: SettingsFile; readonly project: SettingsFile };
  /** The warnings no row holds. */
  readonly warnings: readonly SettingWarning[];
};

/** Both files as read, with the paths the panel shows. */
export type FileStates = {
  readonly user: FileState;
  readonly project: FileState;
  readonly paths: Config["paths"];
};

const PRESENTATION: ReadonlySet<string> = new Set(PRESENTATION_KEYS);

/** What the board protocol holds: a warning's key, and the warnings no row holds (task 2.6). */
export const WARNING_KEY_MAX_CHARS = 256;
export const WARNINGS_MAX = 64;

const fileOf = (state: FileState, path: string | undefined): SettingsFile => {
  const where = path === undefined ? {} : { path };
  return state.status === "not-applied"
    ? { ...where, status: "not-applied", problem: state.problem }
    : { ...where, status: state.status };
};

type Row = SettingRow<unknown>;

const rowOf = (
  key: ConfigurationKey,
  project: Partial<ConfigurationValues>,
  user: Partial<ConfigurationValues>,
): Row => {
  const writable = PRESENTATION.has(key) && project[key] === undefined;
  const set: readonly [SettingSource & SettingsFileName, unknown][] = [
    ["project", project[key]],
    ["user", user[key]],
  ];
  const [first, second] = set.filter(([, value]) => value !== undefined);
  if (first === undefined) {
    const fallback = (CONFIGURATION_DEFAULTS as Readonly<Record<string, unknown>>)[key];
    return fallback === undefined
      ? { from: "default", writable }
      : { value: fallback, from: "default", writable };
  }
  const [from, value] = first;
  const other = second === undefined ? {} : { other: { file: second[0], value: second[1] } };
  return { value, from, writable, ...other };
};

const withWarnings = (row: Row, warnings: readonly SettingWarning[]): Row => {
  const [first, ...rest] = warnings;
  return first === undefined ? row : { ...row, warnings: [first, ...rest] };
};

/** The settings in effect from both files' states. */
export const mergeSettings = ({ user, project, paths }: FileStates): SettingsInEffect => {
  const fromProject = screened("project", project);
  const fromUser = screened("user", user);
  const dropped = [...fromProject.warnings, ...fromUser.warnings];
  const rows: Record<string, Row> = {};
  const values: Record<string, unknown> = {};
  for (const key of CONFIGURATION_KEYS) {
    const row = withWarnings(
      rowOf(key, fromProject.values, fromUser.values),
      dropped.filter((warning) => warning.key === key).slice(0, ROW_WARNINGS_MAX),
    );
    rows[key] = row;
    if (row.value !== undefined) values[key] = row.value;
  }
  return {
    values: values as EffectiveValues,
    rows: rows as SettingsRows,
    files: { user: fileOf(user, paths.user), project: fileOf(project, paths.project) },
    warnings: [...unknownKeys("project", project), ...unknownKeys("user", user)].slice(
      0,
      WARNINGS_MAX,
    ),
  };
};

const unknownKeys = (file: SettingsFileName, state: FileState): SettingWarning[] =>
  state.status === "applied"
    ? state.unknown.map((key) => ({
        code: "unknown-key",
        file,
        key: key.slice(0, WARNING_KEY_MAX_CHARS),
      }))
    : [];
