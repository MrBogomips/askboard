// The driven port through which `ask-core` hands a Snapshot's data to the `snapshot` unit, and the
// error it rejects with (snapshot design decision 3, open question B1). `snapshot` implements the
// port and the entry point wires it. The `CorePorts` field and the `snapshot` command come with
// group 0, beside E3's and E4's names.

import type { SnapshotData } from "@askboard/contract";

/** The variable that names the session project root (AD-12): without it there is no Snapshot. */
export const PROJECT_ROOT_VARIABLE = "CLAUDE_PROJECT_DIR";

/** The code of a Snapshot refused for want of a session project root (XC-A1). */
export const SNAPSHOT_NO_PROJECT_ROOT = "no-project-root";

/** `snapshot`: writes a Snapshot's file in the session project's Snapshot folder. */
export type SnapshotWriter = {
  /** Resolves with the file's absolute real path; rejects with a `SnapshotWriteError`. */
  write(data: SnapshotData): Promise<{ readonly path: string }>;
};

/**
 * A Snapshot that was not written, and nothing of it left under a final name. Its message names
 * the Snapshot folder and the code, or the missing variable, and never agent content.
 */
export class SnapshotWriteError extends Error {
  override readonly name: string = "SnapshotWriteError";
  /**
   * `no-project-root`, `outside-project` for a folder whose real path leaves the project, or the
   * failed file-system call's code, such as `EACCES`.
   */
  readonly code: string;
  /** The Snapshot folder; none for `no-project-root`. */
  readonly folder: string | undefined;
  /** For `no-project-root` only: the variable that is not set. */
  readonly variable: typeof PROJECT_ROOT_VARIABLE | undefined;

  private constructor(
    code: string,
    where: { readonly folder: string } | { readonly variable: typeof PROJECT_ROOT_VARIABLE },
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.folder = "folder" in where ? where.folder : undefined;
    this.variable = "variable" in where ? where.variable : undefined;
  }

  /** Without `CLAUDE_PROJECT_DIR` no folder stands in for the project root: nothing is written. */
  static noProjectRoot(): SnapshotWriteError {
    const message = `no Snapshot without a session project root: ${PROJECT_ROOT_VARIABLE} is not set`;
    return new SnapshotWriteError(
      SNAPSHOT_NO_PROJECT_ROOT,
      { variable: PROJECT_ROOT_VARIABLE },
      message,
    );
  }

  /** The Snapshot folder could not take the file, for the reason `code` names. */
  static inFolder(folder: string, code: string, options?: ErrorOptions): SnapshotWriteError {
    return new SnapshotWriteError(
      code,
      { folder },
      `no Snapshot written to ${folder}: ${code}`,
      options,
    );
  }
}
