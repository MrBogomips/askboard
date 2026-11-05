// The `snapshot` unit's writer (snapshot design decision 6, Factory): the `SnapshotWriter` port
// ask-core holds. It builds the page from the Snapshot data and the view build, then hands it to the
// file side, which prepares and checks the folder and writes the file. Without a session project
// root it refuses at once, before the build is loaded or anything is read (XC-A1).

import { SnapshotWriteError, type SnapshotWriter } from "@askboard/core";
import { refuse } from "./diagnostics.ts";
import { fileSystemOf } from "./file-system.ts";
import { type SnapshotFilesOptions, snapshotFiles } from "./files.ts";
import { snapshotPage, type ViewBuild } from "./page.ts";

export type SnapshotWriterOptions = SnapshotFilesOptions & {
  /** The view build `board-host` serves, which the entry point loads (open question B12). */
  readonly viewBuild: ViewBuild;
};

/**
 * The session's Snapshot writer. `write` resolves with the file's absolute real path; it rejects
 * with a `SnapshotWriteError` when the file cannot be written, and with a `BoardSetupError` when
 * the view build cannot be read.
 */
export const createSnapshotWriter = (options: SnapshotWriterOptions): SnapshotWriter => {
  const files = snapshotFiles(options);
  const fs = fileSystemOf(options.fs);
  return {
    write: async (data) => {
      if (options.projectRoot === undefined) {
        return refuse(SnapshotWriteError.noProjectRoot(), options.report);
      }
      const html = await snapshotPage(data, await options.viewBuild.load(), fs);
      return files.save({ askId: data.askId, takenAt: data.snapshot.takenAt, html });
    },
  };
};
