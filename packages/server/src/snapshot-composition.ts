// Snapshots as the session process composes them (E7, snapshot design decision 6): the `snapshot`
// unit's writer over the session project root, the real path of `CLAUDE_PROJECT_DIR` (AD-12), with
// E8's `ensureProjectFolders` as its preparer, `SNAPSHOT_FOLDER` as its folder and the view build
// `board-host` serves; and E7's `CorePorts` field, which also carries the project folder the board's
// origin row names, for the Snapshot data's origin only (Two project values). Nothing is read or
// created until a Snapshot is taken.

import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { SNAPSHOT_FOLDER, type ViewManifest } from "@askboard/contract";
import type { CorePorts } from "@askboard/core";
import { type LoadedView, loadView } from "./board-host/index.ts";
import type { Environment } from "./notifier/index.ts";
import { ensureProjectFolders } from "./project-folders.ts";
import { sessionProjectRoot } from "./push-composition.ts";
import { createSnapshotWriter, type LoadedViewBuild, type ViewBuild } from "./snapshot/index.ts";

export type SnapshotOptions = {
  readonly env: Environment;
  /** The view build's folder, the one `board-host` serves (design decision 7). */
  readonly view: string;
  /** Writes one diagnostics line to stderr. */
  readonly stderr: (line: string) => void;
};

export type SnapshotComposition = {
  /** ask-core's Snapshot ports: the writer and the origin row's project folder. */
  readonly ports: Pick<CorePorts, "snapshots">;
};

// The build as `snapshot` takes it: the manifest parsed from the bytes `loadView` validated, and
// each chunk file's text by its digest.
const buildOf = (view: LoadedView, folder: string): LoadedViewBuild => ({
  manifest: JSON.parse(view.manifest.toString("utf8")) as ViewManifest,
  sources: Object.fromEntries(
    [...view.chunks].map(([sha256, file]) => [sha256, file.body.toString("utf8")]),
  ),
  folder,
});

/**
 * The view build in `folder`, read and checked by `board-host`'s own loader at the first Snapshot
 * and kept for the session, as `board-host` keeps the one it serves; a failed load is tried again
 * at the next Snapshot.
 */
export const servedViewBuild = (folder: string): ViewBuild => {
  const root = resolve(folder);
  let loading: Promise<LoadedViewBuild> | undefined;
  return {
    load: () => {
      loading ??= loadView(root)
        .then((view) => buildOf(view, root))
        .catch((error: unknown) => {
          loading = undefined;
          throw error;
        });
      return loading;
    },
  };
};

/** Builds the Snapshot writer and E7's `CorePorts` field; `projectDir` is `PushComposition`'s. */
export const composeSnapshots = (
  options: SnapshotOptions,
  context: { readonly projectDir: string },
): SnapshotComposition => {
  const writer = createSnapshotWriter({
    projectRoot: sessionProjectRoot(options.env),
    folder: SNAPSHOT_FOLDER,
    prepareFolders: ensureProjectFolders,
    viewBuild: servedViewBuild(options.view),
    randomness: { bytes: (count) => randomBytes(count) },
    report: options.stderr,
  });
  return { ports: { snapshots: { writer, projectDir: context.projectDir } } };
};
