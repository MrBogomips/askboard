// The grid's keys (proposal, open question 18; EXPERIENCE Accessibility Floor): read on a body
// cell itself, so that an editor inside a cell keeps its own, through `model/keys.ts` in
// navigation: the arrow keys, Home and End move the Tab stop; Enter or F2 opens the editor of an
// editable start or duration, or the predecessors panel of an editable "Depends on"; Delete or
// Backspace on a start clears its request. Each of the grid's own keys has its browser action
// prevented, also where it does nothing, as Backspace on a name or in a read-only Gantt, which
// WebKit would take for "go back"; any other key is left to the browser.

import type { KeyboardEvent } from "react";
import type { CellEditing } from "./editing.ts";
import { type GridFocusState, isCellTarget } from "./grid-focus.ts";
import { keyPressOf } from "./key-press.ts";
import { moveFocus } from "./model/focus.ts";
import { gridKeyAction, isGridKey } from "./model/keys.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";

type GridKeysArgs = {
  readonly rows: readonly GanttRow[];
  readonly focus: GridFocusState;
  readonly editing: CellEditing;
  /** Clears a task's requested start, or a plan task's requested duration. */
  readonly onClear: (row: GanttRow, column: "start" | "duration") => void;
  /** Whether a row's duration is a request to clear: a plan task's that holds one. */
  readonly hasRequest: (row: GanttRow) => boolean;
  /** Opens a task's predecessors panel. */
  readonly onOpenPanel: (row: GanttRow) => void;
  /** Whether the Gantt takes edits; a read-only Gantt's keys only move the focus. */
  readonly editable: boolean;
};

/** The columns whose cells open an editor in place. */
const isEditedColumn = (column: GanttColumn): column is "start" | "duration" =>
  column === "start" || column === "duration";

const isRequestColumn = (column: GanttColumn): column is "start" | "duration" =>
  column === "start" || column === "duration";

export const gridKeyHandler =
  ({
    rows,
    focus,
    editing,
    onClear,
    hasRequest,
    onOpenPanel,
    editable: takesEdits,
  }: GridKeysArgs) =>
  (event: KeyboardEvent<HTMLTableElement>): void => {
    const press = keyPressOf(event);
    const { stop, size } = focus;
    if (stop === undefined || press === undefined || !isCellTarget(event.target)) return;
    const row = rows[stop.row];
    const column = GANTT_COLUMNS[stop.column];
    if (row === undefined || column === undefined) return;
    const editable = takesEdits && row.cells[stop.column]?.editable === true;
    const clearable = hasRequest(row);
    const action = gridKeyAction(press, { mode: "navigate", column, editable, clearable });
    if (isGridKey(press)) event.preventDefault();
    if (action === undefined) return;
    if (action.kind === "move") focus.moveTo(moveFocus(stop, action.move, size));
    else if (action.kind === "edit" && isEditedColumn(column)) editing.begin(row, column);
    else if (action.kind === "edit" && column === "dependencies") onOpenPanel(row);
    else if (action.kind === "clear" && isRequestColumn(column)) onClear(row, column);
  };
