// The rules the configuration schema cannot say (settings-languages design decision 5): a value
// that names a command is dropped before the merge unless the user file, which only the user can
// write, sets it (AD-8, B4), and a Snapshot folder that leaves the project is dropped too (AD-14).
// A value dropped is a warning on its key's row, and the merge falls to the other file or the
// default.

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

/**
 * A relative folder that stays inside the project once normalised, or undefined: no leading `/`
 * or `~`, no backslash or NUL, no `..` that leaves the root, and not the root itself. E7's writer
 * still checks the real path when it writes, which also catches a symbolic link out of the project.
 */
export const keptFolder = (folder: string): string | undefined => {
  if (/^[/~]/.test(folder) || folder.includes("\\") || folder.includes("\0")) return undefined;
  const kept: string[] = [];
  for (const segment of folder.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") kept.push(segment);
    else if (kept.pop() === undefined) return undefined;
  }
  return kept.length === 0 ? undefined : kept.join("/");
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
  const folder = state.values.snapshotFolder;
  const kept = folder === undefined ? undefined : keptFolder(folder);
  if (kept !== undefined) values.snapshotFolder = kept;
  else if (folder !== undefined) {
    delete values.snapshotFolder;
    warnings.push({ code: "snapshot-folder-replaced", file, key: "snapshotFolder", value: folder });
  }
  return { values, warnings };
};
