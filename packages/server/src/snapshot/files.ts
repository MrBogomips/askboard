// The Snapshot folder and the files in it (snapshot design decision 6; open questions A5 and A6,
// XC-A1). The folder is the caller's, relative to the session project root, the real path of
// `CLAUDE_PROJECT_DIR`; without that root no folder stands in for it, and a Snapshot is refused
// before any file-system call. `.askboard/` and its folders are created by the preparation the
// entry point hands in, E8's `ensureProjectFolders`; then the folder's real path must lie inside
// the project root's, so a symbolic link never leads a Snapshot out of the project.

import { isAbsolute, relative, resolve, sep } from "node:path";
import { type Randomness, SnapshotWriteError } from "@askboard/core";
import { codeOf, type ReportLine, refuse } from "./diagnostics.ts";
import { fileSystemOf, type SnapshotFileSystem } from "./file-system.ts";
import { type SnapshotFile, writeSnapshotFile } from "./write.ts";

/** What preparing `.askboard/` gives: the shape of E8's `FolderResult`. */
export type FolderResult =
  /** What the preparation created, relative to the project root. */
  | { readonly kind: "ready"; readonly created: readonly string[] }
  /** No session project root: nothing is created (AD-12). */
  | { readonly kind: "no-project" }
  | { readonly kind: "failed"; readonly path: string; readonly code: string };

/** Creates `.askboard/` and its folders under the project root when missing (AD-14). */
export type PrepareFolders = (projectRoot: string) => Promise<FolderResult>;

export type SnapshotFilesOptions = {
  /** The real path of `CLAUDE_PROJECT_DIR`, or none without it (AD-12). */
  readonly projectRoot: string | undefined;
  /** The Snapshot folder, relative to the project root: `.askboard/snapshots` by default. */
  readonly folder: string;
  readonly prepareFolders: PrepareFolders;
  readonly randomness: Randomness;
  readonly report: ReportLine;
  readonly fs?: Partial<SnapshotFileSystem>;
};

export type SnapshotFiles = {
  /** Writes one Snapshot's page; resolves with the file's absolute real path. */
  save(file: Omit<SnapshotFile, "folder">): Promise<{ readonly path: string }>;
};

/** Whether `path` is `folder` or lies below it; both are real paths. */
const isWithin = (folder: string, path: string): boolean => {
  const below = relative(folder, path);
  return below !== ".." && !below.startsWith(`..${sep}`) && !isAbsolute(below);
};

/**
 * The Snapshot folder's real path, or its refusal: `outside-project` when it leaves the project
 * root's real path, or the code of the call that failed. A refusal names `folder` as the caller
 * named it.
 */
const realFolder = async (
  projectRoot: string,
  folder: string,
  fs: SnapshotFileSystem,
): Promise<string | SnapshotWriteError> => {
  let real: { readonly root: string; readonly folder: string };
  try {
    real = { root: await fs.realpath(projectRoot), folder: await fs.realpath(folder) };
  } catch (error) {
    return SnapshotWriteError.inFolder(folder, codeOf(error), { cause: error });
  }
  if (!isWithin(real.root, real.folder)) {
    return SnapshotWriteError.inFolder(folder, "outside-project");
  }
  return real.folder;
};

/**
 * The folder ready to take a file, or the refusal: no project root, a failed preparation (a
 * rejecting one included), or `realFolder`'s.
 */
const preparedFolder = async (
  options: SnapshotFilesOptions,
): Promise<string | SnapshotWriteError> => {
  const { projectRoot } = options;
  if (projectRoot === undefined) return SnapshotWriteError.noProjectRoot();
  const folder = resolve(projectRoot, options.folder);
  const prepared = await options
    .prepareFolders(projectRoot)
    .catch(
      (error: unknown): FolderResult => ({ kind: "failed", path: folder, code: codeOf(error) }),
    );
  if (prepared.kind === "no-project") return SnapshotWriteError.noProjectRoot();
  if (prepared.kind === "failed") return SnapshotWriteError.inFolder(folder, prepared.code);
  return realFolder(projectRoot, folder, fileSystemOf(options.fs));
};

/** The session's Snapshot files: one folder, one project root, resolved at each Snapshot. */
export const snapshotFiles = (options: SnapshotFilesOptions): SnapshotFiles => ({
  save: async (file) => {
    const folder = await preparedFolder(options);
    if (folder instanceof SnapshotWriteError) return refuse(folder, options.report);
    // The write reports its own failure, once.
    return { path: await writeSnapshotFile({ ...file, folder }, options) };
  },
});
