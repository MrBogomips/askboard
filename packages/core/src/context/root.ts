// The root an ask's pointers resolve against (excerpts, design decision 4, Root; AD-12): the
// session project root gates it, so without `CLAUDE_PROJECT_DIR` no folder stands in, not even the
// origin's (proposal B2; E4 cross-review, H1). With one, an owned ask's origin root wins, so a
// subagent in its own worktree reads from that worktree (AD-5).

import type { Binding } from "../push/ports.ts";

/** The ask's root, or undefined when every pointer of the ask is `no-root`. */
export const rootOf = (
  projectRoot: string | undefined,
  owner: Binding | undefined,
): string | undefined =>
  projectRoot === undefined ? undefined : (owner?.origin?.root ?? projectRoot);
