// The configuration's diagnostics (settings-languages design decision 4): AskBoard's own text,
// written once per session, naming the file, the code, the JSON pointer and Ajv's keyword. Every
// text a file chose (a JSON pointer, which holds the name of the property that failed, an unknown
// key, a Snapshot folder, an action, a combination) goes through `quoteFileText`: quoted as JSON,
// with DEL, the C1 controls, U+2028, U+2029 and the bidirectional controls escaped as well, so each
// diagnostic is one line that no file can colour, split or reorder (keyboard-shortcuts-help, review
// 8.6, X-1 and X-2). A path goes through the same helpers (review 8.13, X-6): a file's, as the
// panel shows it, with `escapeFileText`, and the project folder's with `quoteFileText`. No value of
// an `editor` is named, so it never reaches stderr.

import {
  escapeFileText,
  type FileProblem,
  quoteFileText,
  type SettingsFile,
  type SettingWarning,
} from "@askboard/contract";
import type { FolderResult } from "./ports.ts";
import type { SettingsInEffect } from "./settings.ts";

const FILE_NAMES = { user: "the user file", project: "the project file" } as const;

// A file's path as the panel shows it comes from `XDG_CONFIG_HOME` or `HOME`: escaped, with no
// quotes, so a line feed there cannot split a line and a usual path reads as it always did.
const where = (file: SettingsFile, name: keyof typeof FILE_NAMES): string =>
  file.path === undefined ? FILE_NAMES[name] : escapeFileText(file.path);

const problemText = ({ code, pointer, keyword, error }: FileProblem): string =>
  [
    code,
    pointer && `at ${quoteFileText(pointer)}`,
    keyword && `(${keyword})`,
    error && `(${error})`,
  ]
    .filter(Boolean)
    .join(" ");

const WARNINGS: Readonly<Record<SettingWarning["code"], (warning: SettingWarning) => string>> = {
  "unknown-key": ({ key }) => `holds the unknown key ${quoteFileText(key)}, which is ignored.`,
  "project-editor-ignored": () =>
    "sets editor, which AskBoard reads from the user file only: it is ignored.",
  "editor-file-writable-by-others": () =>
    "can be written by another user, or a folder above it can, or another user owns one: its editor is ignored.",
  "snapshot-folder-replaced": ({ value }) =>
    `sets snapshotFolder to ${quoteFileText(value ?? "")}, which leaves the project: .askboard/snapshots is used instead.`,
  "project-keys-ignored": () =>
    "sets keys, which AskBoard reads from the user file only: it is ignored.",
  // The action, the combination and the other action come from a file: quoted by `quoteFileText`,
  // so no control character, separator or bidirectional control gets out.
  "keys-not-applied": ({ rule, action, binding, with: other }) => {
    const parts = [
      `does not apply its keys (every key is the default): rule ${rule}`,
      `action ${quoteFileText(action ?? "")}`,
      ...(binding === undefined ? [] : [`combination ${quoteFileText(binding)}`]),
      ...(other === undefined ? [] : [`with ${quoteFileText(other)}`]),
    ];
    return `${parts.join(", ")}.`;
  },
};

const warningText = (settings: SettingsInEffect, warning: SettingWarning): string =>
  `AskBoard: ${where(settings.files[warning.file], warning.file)} ${WARNINGS[warning.code](warning)}`;

const rowWarnings = (settings: SettingsInEffect): SettingWarning[] =>
  Object.values(settings.rows).flatMap((row) => row.warnings ?? []);

/** Every line the configuration in effect has to say on stderr. */
export const configurationDiagnostics = (settings: SettingsInEffect): string[] => {
  const lines: string[] = [];
  for (const name of ["user", "project"] as const) {
    const file = settings.files[name];
    if (file.status !== "not-applied") continue;
    lines.push(
      `AskBoard: ${where(file, name)} is not applied: ${problemText(file.problem)}; none of its keys count.`,
    );
  }
  for (const warning of [...rowWarnings(settings), ...settings.warnings]) {
    lines.push(warningText(settings, warning));
  }
  return lines;
};

/**
 * The line for project folders the first ask could not create. The path is the project folder's,
 * which the folder names under it choose: it is quoted as JSON with `quoteFileText`, so no control
 * character, separator or bidirectional control gets out (review 8.13, X-6).
 */
export const foldersFailed = ({ path, code }: Extract<FolderResult, { kind: "failed" }>): string =>
  `AskBoard: .askboard/ could not be created at ${quoteFileText(path)} (${code}); the ask goes on without it.`;
