// What a double click on a grid cell does (view spec, "Double-click opens a cell's editor"): the
// same as Enter on the focused cell, so an editable start or duration opens its editor and an
// editable "Depends on" its panel, and nothing opens on any other cell, in a read-only Gantt, or
// while an editor or a panel is open already. Plain ECMAScript.

import type { GanttColumn } from "./tasks.ts";

export type DoubleClick =
  /** Opens the editor of a start or a duration. */
  | { readonly kind: "edit"; readonly column: "start" | "duration" }
  /** Opens the predecessors panel. */
  | { readonly kind: "panel" };

export const doubleClickAction = (cell: {
  readonly column: GanttColumn;
  /** The cell is the user's to edit, and the Gantt takes edits. */
  readonly editable: boolean;
  /** An editor or a panel is open. */
  readonly busy: boolean;
}): DoubleClick | undefined => {
  if (!cell.editable || cell.busy) return undefined;
  if (cell.column === "start" || cell.column === "duration") {
    return Object.freeze({ kind: "edit", column: cell.column });
  }
  return cell.column === "dependencies" ? Object.freeze({ kind: "panel" }) : undefined;
};
