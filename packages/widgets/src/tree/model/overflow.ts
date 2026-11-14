// The Tree toolbar's overflow (review F-16; spec, Tree toolbar overflow): the counter gives way
// first, by truncating, down to a minimum; when the tools alone no longer leave it that, the move
// tools go into a "More" menu. The measure is the shared toolbar's (`shared/crowded.ts`); the tools
// that go are the Tree's. Pure: the toolbar measures, this decides.

import type { TreeEdit } from "./edits.ts";

/** The Tree tools that go into "More" (with "Select all" and "Select none"): the four moves. */
export const OVERFLOW_TOOLS: ReadonlySet<TreeEdit> = new Set<TreeEdit>([
  "moveUp",
  "moveDown",
  "indent",
  "outdent",
]);

export { COUNTER_MIN, isCrowded, ROW_PADDING } from "../../shared/crowded.ts";
