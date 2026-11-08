// The graph sources by widget type (widget-registry, design decision 11; AD-13): a table from an
// item type to the function that maps a board item of that type onto what `buildGraph` reads. The
// Tree and the Gantt have their own mapping in `board.ts`; a computing widget added later appends
// one entry here, returning existing graph item kinds or a kind it adds. `compute` imports no
// registry: a test checks that every registered type that declares derived values is a Tree, a
// Gantt or a type of this table. The Table's entry (table-widget) is appended last.

import type { BoardSourceItem } from "./board.ts";
import type { GraphItem } from "./source.ts";
import { tableSource } from "./table-source.ts";

/** The graph items of one board item of a type; the item is as the input format writes it. */
export type BoardSource = (item: BoardSourceItem) => readonly GraphItem[];

/** The sources of the types other than Tree and Gantt, by item type. */
export const BOARD_SOURCES: Readonly<Record<string, BoardSource>> = /* @__PURE__ */ Object.freeze({
  table: tableSource,
});
