// The configuration's port (settings-languages design decision 3): the session process's adapter
// reads and writes the two files' bytes, and ask-core parses, validates, merges and applies every
// rule, calling no Node API (AD-1).

/** One configuration file, as the adapter found it. */
export type FileRead =
  | { readonly kind: "absent" }
  /** `othersCanWrite`: another user can write the file or a folder above it, or owns one. */
  | { readonly kind: "read"; readonly text: string; readonly othersCanWrite: boolean }
  /** `code` is the system's error code, such as `EACCES` or `EISDIR`. */
  | { readonly kind: "unreadable"; readonly code: string };

/** Why ask-core refuses a board's write before anything is written. */
export type RefusalCode = "set-by-project" | "file-not-applied";

/** What the user file becomes: its new text, or a refusal that writes nothing. */
export type Replace =
  | { readonly kind: "write"; readonly text: string }
  | { readonly kind: "refuse"; readonly reason: RefusalCode };

export type WriteResult =
  | { readonly kind: "written"; readonly path: string }
  | { readonly kind: "refused"; readonly reason: string }
  /** `code` is the error's, or `no-user-file` without `XDG_CONFIG_HOME` and `HOME`. */
  | { readonly kind: "failed"; readonly path?: string; readonly code: string };

export type FolderResult =
  /** What this call created, relative to the project root. */
  | { readonly kind: "ready"; readonly created: readonly string[] }
  /** No session project root: nothing is created (AD-12). */
  | { readonly kind: "no-project" }
  | { readonly kind: "failed"; readonly path: string; readonly code: string };

export type Config = {
  /** The user file, read now. */
  userFile(): Promise<FileRead>;
  /** The project file, read now; absent without a session project root. */
  projectFile(): Promise<FileRead>;
  /** Re-reads the user file, hands it to `change`, and writes what it returns atomically. */
  replaceUserFile(change: (current: FileRead) => Replace): Promise<WriteResult>;
  /** Creates `.askboard/` under the session project root, at the first accepted ask. */
  ensureProjectFolders(): Promise<FolderResult>;
  /** As the settings panel shows them. */
  readonly paths: { readonly user?: string; readonly project?: string };
};
