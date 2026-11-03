// The configuration's diagnostics (settings-languages design decision 4): AskBoard's own text,
// written once per session, naming the file, the code, the JSON pointer and Ajv's keyword. A key
// from a file is quoted as JSON, so no control character reaches the terminal; no value is named,
// so an `editor` never reaches stderr.

import type { FileProblem, SettingsFile, SettingWarning } from "@askboard/contract";
import type { SettingsInEffect } from "./settings.ts";

const FILE_NAMES = { user: "the user file", project: "the project file" } as const;

const where = (file: SettingsFile, name: keyof typeof FILE_NAMES): string =>
  file.path ?? FILE_NAMES[name];

const problemText = ({ code, pointer, keyword, error }: FileProblem): string =>
  [code, pointer && `at ${pointer}`, keyword && `(${keyword})`, error && `(${error})`]
    .filter(Boolean)
    .join(" ");

const warningText = (settings: SettingsInEffect, warning: SettingWarning): string => {
  const file = where(settings.files[warning.file], warning.file);
  return `AskBoard: ${file} holds the unknown key ${JSON.stringify(warning.key)}, which is ignored.`;
};

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
  for (const warning of settings.warnings) lines.push(warningText(settings, warning));
  return lines;
};
