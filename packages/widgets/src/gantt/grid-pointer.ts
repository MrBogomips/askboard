// The grid's double click (view spec, "Double-click opens a cell's editor"): it does what Enter
// does on the focused cell, through `model/pointer.ts`: the editor of an editable start or
// duration, or the predecessors panel of an editable "Depends on". It reads the body cell under
// the pointer, skips what is inside a cell (an editor, the panel, the pin's button), and, as the
// Tree's does, starts no drag and changes no selection.

import type { MouseEvent } from "react";
import type { CellEditing } from "./editing.ts";
import { doubleClickAction } from "./model/pointer.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";
import type { PanelState } from "./panel-state.ts";

type DoubleClickArgs = {
  readonly rows: readonly GanttRow[];
  readonly editing: CellEditing;
  readonly panels: PanelState;
  /** Whether the Gantt takes edits; a read-only Gantt's double click does nothing. */
  readonly editable: boolean;
};

/** A control inside a cell, whose own double click is not the cell's. */
const INSIDE = "input, button, [data-gantt-panel]";

export const gridDoubleClickHandler =
  ({ rows, editing, panels, editable }: DoubleClickArgs) =>
  (event: MouseEvent<HTMLTableElement>): void => {
    const { target } = event;
    if (!(target instanceof Element) || target.closest(INSIDE) !== null) return;
    const cell = target.closest("[data-gantt-column]");
    const taskId = cell?.parentElement?.getAttribute("data-gantt-row");
    const column = cell?.getAttribute("data-gantt-column") as GanttColumn | null | undefined;
    const row = rows.find((candidate) => candidate.id === taskId);
    const at = column === null || column === undefined ? -1 : GANTT_COLUMNS.indexOf(column);
    if (row === undefined || column === null || column === undefined || at < 0) return;
    const action = doubleClickAction({
      column,
      editable: editable && row.cells[at]?.editable === true,
      busy: editing.editing !== undefined || panels.panel !== undefined,
    });
    if (action?.kind === "edit") editing.begin(row, action.column);
    else if (action?.kind === "panel") panels.open(row);
  };
