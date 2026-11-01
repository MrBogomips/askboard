// Resolving a path under the real root one component at a time (excerpts, design decision 3, step
// 3). `realpath` answers where it can. When it cannot, for a path that does not exist or for a
// Unix socket, whose real path Bun's `realpath` refuses on macOS, this walk answers instead. It
// follows links as the system does, but looks only at the root, what lies under it and the root's
// own ancestors, which exist since the root does: where the next step would leave them, it stops,
// with no call, and the pointer is outside-root. So its answer never depends on what lies outside
// the root, and a link leading out is outside-root whether or not its target exists (design
// decision 4). A component missing inside the root is not-found.

import type { SourceFs } from "./fs.ts";
import { isRefused, type Refused, unless } from "./refused.ts";

// The most links one resolution follows, as the systems' own limits on a path's links.
const LINKS_MAX = 40;

const parentOf = (path: string): string => path.slice(0, path.lastIndexOf("/")) || "/";

const childOf = (path: string, name: string): string =>
  path === "/" ? `/${name}` : `${path}/${name}`;

/** The real path of what `path`, relative to `realRoot`, names under the root, or why not. */
export const walkWithin = async (
  fs: SourceFs,
  realRoot: string,
  path: string,
): Promise<string | Refused> => {
  const prefix = realRoot === "/" ? "/" : `${realRoot}/`;
  const inside = (at: string): boolean => at !== realRoot && at.startsWith(prefix);
  const looked = (at: string): boolean =>
    at === realRoot || inside(at) || realRoot.startsWith(at === "/" ? "/" : `${at}/`);
  const pending = path.split("/");
  let at = realRoot;
  let links = 0;
  for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
    if (name === "" || name === ".") continue;
    const next = name === ".." ? parentOf(at) : childOf(at, name);
    if (!looked(next)) return { refused: "outside-root" };
    if (name === "..") {
      at = next;
      continue;
    }
    const stats = await unless(() => fs.lstat(next), "not-found");
    if (isRefused(stats)) return stats;
    if (stats.isSymbolicLink()) {
      links += 1;
      if (links > LINKS_MAX) return { refused: "not-found" };
      const target = await unless(() => fs.readlink(next), "not-found");
      if (isRefused(target)) return target;
      if (target.startsWith("/")) at = "/";
      pending.unshift(...target.split("/"));
    } else if (pending.length > 0 && !stats.isDirectory()) {
      return { refused: "not-found" };
    } else {
      at = next;
    }
  }
  return inside(at) ? at : { refused: "outside-root" };
};
