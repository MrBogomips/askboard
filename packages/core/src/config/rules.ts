// The rules the configuration schema cannot say (settings-languages design decision 5): a value
// that names a command is dropped before the merge unless the user file, which only the user can
// write, sets it (AD-8, B4). A value dropped is a warning on its key's row.

import type { ConfigurationValues, SettingsFileName, SettingWarning } from "@askboard/contract";
import type { FileState } from "./file.ts";

/** A file's values once the rules ran, and the warnings for what they dropped. */
export type Screened = {
  readonly values: Partial<ConfigurationValues>;
  readonly warnings: readonly SettingWarning[];
};

// Drops `editor` from the project file, and from a user file others can write.
const editorRule = (file: SettingsFileName, state: FileState): SettingWarning | undefined => {
  if (state.status !== "applied" || state.values.editor === undefined) return undefined;
  if (file === "project") return { code: "project-editor-ignored", file, key: "editor" };
  return state.othersCanWrite
    ? { code: "editor-file-writable-by-others", file, key: "editor" }
    : undefined;
};

/** One file's values with the rules applied. */
export const screened = (file: SettingsFileName, state: FileState): Screened => {
  if (state.status !== "applied") return { values: {}, warnings: [] };
  const values: Record<string, unknown> = { ...state.values };
  const warnings: SettingWarning[] = [];
  const editor = editorRule(file, state);
  if (editor !== undefined) {
    delete values.editor;
    warnings.push(editor);
  }
  return { values, warnings };
};
