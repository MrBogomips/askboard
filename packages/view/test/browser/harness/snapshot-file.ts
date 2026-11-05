// A Snapshot file for the browser tests: the data run through `assemble` with the real view
// build's chunk and notice texts, written under a temporary folder, to open from `file://`.

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SnapshotData } from "@askboard/contract";
import { assemble, selectChunks, targetOf } from "../../../src/assemble/index.ts";
import { DIST_VIEW, readViewBuild, sha256Hex } from "./view-build.ts";

/** The page `assemble` writes for the data, from `dist/view/`. */
export const snapshotPage = async (data: SnapshotData): Promise<string> => {
  const build = await readViewBuild();
  const chunks: Record<string, string> = {};
  for (const text of build.files.values()) chunks[sha256Hex(text)] = text;
  const licences: Record<string, string> = {};
  const selection = selectChunks(data.document, build.manifest, targetOf(data));
  for (const { chunk } of selection) {
    for (const { path } of chunk.licences) {
      licences[path] = await readFile(join(DIST_VIEW, path), "utf8");
    }
  }
  return assemble(data, build.manifest, { chunks, licences }).srcdoc;
};

/** Writes the Snapshot under `dir` (a new temporary folder by default) and gives its path. */
export const writeSnapshot = async (
  data: SnapshotData,
  dir?: string,
  name = "snapshot.html",
): Promise<string> => {
  const folder = dir ?? (await mkdtemp(join(tmpdir(), "askboard-snapshot-")));
  await mkdir(folder, { recursive: true });
  const path = join(folder, name);
  await writeFile(path, await snapshotPage(data));
  return path;
};
