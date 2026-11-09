// The configuration's diagnostics (settings-languages design decision 4): AskBoard's own text,
// written once per session, naming the file, the code, the JSON pointer and Ajv's keyword. A key
// from a file is quoted as JSON, so no control character reaches the terminal; no value is named,
// so an `editor` never reaches stderr.

import type { FileProblem, SettingsFile, SettingWarning } from "@askboard/contract";
import type { FolderResult } from "./ports.ts";
import type { SettingsInEffect } from "./settings.ts";

const FILE_NAMES = { user: "the user file", project: "the project file" } as const;

const where = (file: SettingsFile, name: keyof typeof FILE_NAMES): string =>
  file.path ?? FILE_NAMES[name];

const problemText = ({ code, pointer, keyword, error }: FileProblem): string =>
  [code, pointer && `at ${pointer}`, keyword && `(${keyword})`, error && `(${error})`]
    .filter(Boolean)
    .join(" ");

const WARNINGS: Readonly<Record<SettingWarning["code"], (warning: SettingWarning) => string>> = {
  "unknown-key": ({ key }) => `holds the unknown key ${JSON.stringify(key)}, which is ignored.`,
  "project-editor-ignored": () =>
    "sets editor, which AskBoard reads from the user file only: it is ignored.",
  "editor-file-writable-by-others": () =>
    "can be written by another user, or a folder above it can, or another user owns one: its editor is ignored.",
  "snapshot-folder-replaced": ({ value }) =>
    `sets snapshotFolder to ${JSON.stringify(value)}, which leaves the project: .askboard/snapshots is used instead.`,
  "project-keys-ignored": () =>
    "sets keys, which AskBoard reads from the user file only: it is ignored.",
  // The action and the combination come from a file: JSON-quoted, so no control character gets out.
  "keys-not-applied": ({ rule, action, binding, with: other }) => {
    const parts = [
      `does not apply its keys (every key is the default): rule ${rule}`,
      `action ${JSON.stringify(action)}`,
      ...(binding === undefined ? [] : [`combination ${JSON.stringify(binding)}`]),
      ...(other === undefined ? [] : [`with ${JSON.stringify(other)}`]),
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

/** The line for project folders the first ask could not create; the path is quoted as JSON. */
export const foldersFailed = ({ path, code }: Extract<FolderResult, { kind: "failed" }>): string =>
  `AskBoard: .askboard/ could not be created at ${JSON.stringify(path)} (${code}); the ask goes on without it.`;
