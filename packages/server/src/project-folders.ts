// The project folders, created at a session's first accepted ask (AD-14, Project folders;
// settings-languages design decision 13, open question A4): `.askboard/` under the session project
// root with its three folders, and its `.gitignore` only when that file is created, so a user's
// own is never touched. `bench/` is the benchmark's, which creates it.

import { lstat, mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { ASKBOARD_FOLDER, ASKBOARD_GITIGNORE, ASKBOARD_SUBFOLDERS } from "@askboard/contract";
import { errorCode } from "./file-errors.ts";

export type FolderResult =
  /** What this call created, relative to the project root. */
  | { readonly kind: "ready"; readonly created: readonly string[] }
  /** No session project root: nothing is created (AD-12). */
  | { readonly kind: "no-project" }
  | { readonly kind: "failed"; readonly path: string; readonly code: string };

const GITIGNORE = ".gitignore";

/** Creates a folder that may exist; true when this call created it. */
const createFolder = async (path: string): Promise<boolean> => {
  try {
    await mkdir(path);
    return true;
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }
};

/** Creates `.gitignore` with an exclusive create, which follows no link; false when it exists. */
const createGitignore = async (path: string): Promise<boolean> => {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }
  try {
    await handle.writeFile(`${ASKBOARD_GITIGNORE.join("\n")}\n`, "utf8");
  } finally {
    await handle.close();
  }
  return true;
};

/**
 * Creates `.askboard/` and its folders under `projectRoot` when missing. The root itself is never
 * created, so a missing root fails; a `.askboard` that is not a real folder, such as a symbolic link
 * out of the project, fails too.
 */
export const ensureProjectFolders = async (
  projectRoot: string | undefined,
): Promise<FolderResult> => {
  if (projectRoot === undefined) return { kind: "no-project" };
  const created: string[] = [];
  let path = join(projectRoot, ASKBOARD_FOLDER);
  try {
    if (await createFolder(path)) created.push(ASKBOARD_FOLDER);
    if (!(await lstat(path)).isDirectory()) return { kind: "failed", path, code: "ENOTDIR" };
    for (const folder of ASKBOARD_SUBFOLDERS) {
      path = join(projectRoot, ASKBOARD_FOLDER, folder);
      if (await createFolder(path)) created.push(`${ASKBOARD_FOLDER}/${folder}`);
    }
    path = join(projectRoot, ASKBOARD_FOLDER, GITIGNORE);
    if (await createGitignore(path)) created.push(`${ASKBOARD_FOLDER}/${GITIGNORE}`);
    return { kind: "ready", created };
  } catch (error) {
    return { kind: "failed", path, code: errorCode(error) };
  }
};
