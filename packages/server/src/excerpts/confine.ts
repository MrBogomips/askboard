// Confinement, steps 1 to 3 of design decision 3 (proposal B3; board-host spec, Pointers resolve
// only inside the root). The grammar first, touching nothing on disk. Then the root's real path,
// taken at each call since a worktree can vanish, and the candidate's: the root's real path, `/`
// and the pointer's path, made real. The candidate is inside only when its real path starts with
// the real root plus `/`, compared as exact strings, with no case folding: on a case-insensitive
// volume both real paths come from the same call, so an in-root name in another case still lies
// under the real root, and a path outside has a different real prefix in any case.

import { isAbsolute } from "node:path";
import { type Pointer, readPointer } from "@askboard/contract";
import type { SourceFs } from "./fs.ts";
import { isRefused, type Refused, unless } from "./refused.ts";

/** A pointer whose file lies inside the root, and that file's real path. */
export type Located = { readonly realPath: string; readonly pointer: Pointer };

/**
 * Finds a pointer's file inside `root`. With no root, or one that is not an absolute path, every
 * pointer is `no-root`; an invalid pointer is `invalid-pointer`; neither calls the file system.
 */
export const locate = async (
  fs: SourceFs,
  root: string | undefined,
  text: string,
): Promise<Located | Refused> => {
  if (root === undefined || !isAbsolute(root)) return { refused: "no-root" };
  const pointer = readPointer(text);
  if ("invalid" in pointer) return { refused: "invalid-pointer" };
  const realRoot = await unless(() => fs.realpath(root), "not-found");
  if (isRefused(realRoot)) return realRoot;
  const prefix = realRoot.endsWith("/") ? realRoot : `${realRoot}/`;
  const realPath = await unless(() => fs.realpath(`${prefix}${pointer.path}`), "not-found");
  if (isRefused(realPath)) return realPath;
  return realPath.startsWith(prefix) ? { realPath, pointer } : { refused: "outside-root" };
};
