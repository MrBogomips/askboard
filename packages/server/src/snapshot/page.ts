// A Snapshot's page (snapshot design decision 6, open question B12; AD-9): `assemble` over the
// Snapshot data and the view build the entry point loaded and checked, with the licence notices of
// the chunks the Snapshot inlines, whose texts the unit reads from the build's folder by their
// manifest paths. The manifest schema's path pattern admits no segment that starts with a dot, so a
// notice's path stays inside that folder.

import { resolve } from "node:path";
import type { SnapshotData, ViewManifest } from "@askboard/contract";
import { BoardSetupError } from "@askboard/core";
import {
  assemble,
  type ChunkSources,
  type LicenceTexts,
  type SelectedChunk,
  selectChunks,
  targetOf,
} from "@askboard/view/assemble";
import type { SnapshotFileSystem } from "./file-system.ts";

/** The view build as the entry point loaded and checked it, the one `board-host` serves. */
export type LoadedViewBuild = {
  readonly manifest: ViewManifest;
  /** Every chunk's script and styles, by SHA-256 in lowercase hex. */
  readonly sources: ChunkSources;
  /** The build's folder, which holds each licence notice's text at its manifest path. */
  readonly folder: string;
};

/** The port through which the unit takes the view build (open question B12). */
export type ViewBuild = { load(): Promise<LoadedViewBuild> };

/**
 * A notice text the view build does not hold: no Snapshot can be built until AskBoard is rebuilt,
 * as no board can be served without its files (ask-core's `BoardSetupError`).
 */
export class SnapshotBuildError extends BoardSetupError {
  override readonly name = "SnapshotBuildError";
}

// Each notice text of the selected chunks, read once by its path.
const noticeTexts = async (
  selection: readonly SelectedChunk[],
  folder: string,
  fs: SnapshotFileSystem,
): Promise<LicenceTexts> => {
  const paths = new Set(selection.flatMap(({ chunk }) => chunk.licences.map(({ path }) => path)));
  const read = async (path: string): Promise<readonly [string, string]> => {
    try {
      return [path, await fs.readFile(resolve(folder, path), "utf8")];
    } catch (error) {
      throw new SnapshotBuildError("VIEW_FILE_INVALID", `cannot read ${path}`, { cause: error });
    }
  };
  return Object.fromEntries(await Promise.all([...paths].map(read)));
};

/** The Snapshot's self-contained page: what `assemble` builds for the data and the view build. */
export const snapshotPage = async (
  data: SnapshotData,
  build: LoadedViewBuild,
  fs: SnapshotFileSystem,
): Promise<string> => {
  const selection = selectChunks(data.document, build.manifest, targetOf(data));
  const licences = await noticeTexts(selection, build.folder, fs);
  return assemble(data, build.manifest, { chunks: build.sources, licences }).srcdoc;
};
