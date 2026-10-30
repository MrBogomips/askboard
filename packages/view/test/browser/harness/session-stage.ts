// Where the session-process target runs the bundle from. The session process serves the view build
// in `view/` beside itself, read when it first asks (design decision 7), so a scenario with a
// test-only build (a probe, a throwing Choice) runs a copy of the bundle beside that build, in a
// temporary folder removed afterwards; `dist/view/` itself is never touched.

import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { VIEW_DIRECTORY, VIEW_MANIFEST_FILE } from "@askboard/contract";
import type { ViewBuild } from "./view-build.ts";

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");

/** The session process's bundle, as `bun run build:server` writes it (design decision 9). */
export const DIST_BUNDLE = join(ROOT, "dist", "askboard.mjs");

export type Stage = {
  /** The bundle the session process runs. */
  readonly entry: string;
  /** Removes the copy, if the stage made one. */
  cleanup(): Promise<void>;
};

/** Writes a view build into a folder: every file it holds, then its manifest as `/m` serves it. */
export const writeViewBuild = async (dir: string, view: ViewBuild): Promise<void> => {
  for (const [path, text] of view.files) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await Bun.write(join(dir, path), text);
  }
  await Bun.write(join(dir, VIEW_MANIFEST_FILE), view.manifestText);
};

/** The bundle to run for this view build: in place when the view beside it is this build. */
export const stageSession = async (view: ViewBuild, bundle = DIST_BUNDLE): Promise<Stage> => {
  if (!(await Bun.file(bundle).exists())) {
    throw new Error(
      `no session process bundle at ${bundle}: run \`bun run build\` first (it writes the bundle and dist/view/)`,
    );
  }
  const beside = Bun.file(join(dirname(bundle), VIEW_DIRECTORY, VIEW_MANIFEST_FILE));
  if ((await beside.exists()) && (await beside.text()) === view.manifestText) {
    return { entry: bundle, cleanup: async () => undefined };
  }
  const dir = await mkdtemp(join(tmpdir(), "askboard-e2e-"));
  const entry = join(dir, basename(bundle));
  await copyFile(bundle, entry);
  await writeViewBuild(join(dir, VIEW_DIRECTORY), view);
  return { entry, cleanup: () => rm(dir, { recursive: true, force: true }) };
};
