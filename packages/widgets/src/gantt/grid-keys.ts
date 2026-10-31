// The grid's keys (proposal, open question 18; EXPERIENCE Accessibility Floor): read on a body
// cell itself, so that an editor inside a cell keeps its own, through `model/keys.ts` in
// navigation: the arrow keys, Home and End move the Tab stop; Enter or F2 opens the editor of an
// editable start or duration, or the predecessors panel of an editable "Depends on"; Delete or
// Backspace on a start clears its request. A key the grid acts on has its browser action
// prevented; any other key is left to the browser.

import type { KeyboardEvent } from "react";
import type { CellEditing } from "./editing.ts";
import { type GridFocusState, isCellTarget } from "./grid-focus.ts";
import { keyPressOf } from "./key-press.ts";
import { moveFocus } from "./model/focus.ts";
import { gridKeyAction } from "./model/keys.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";

type GridKeysArgs = {
  readonly rows: readonly GanttRow[];
  readonly focus: GridFocusState;
  readonly editing: CellEditing;
  /** Clears a task's requested start. */
  readonly onClear: (row: GanttRow) => void;
  /** Opens a task's predecessors panel. */
  readonly onOpenPanel: (row: GanttRow) => void;
};

/** The columns whose cells open an editor in place. */
const isEditedColumn = (column: GanttColumn): column is "start" | "duration" =>
  column === "start" || column === "duration";

export const gridKeyHandler =
  ({ rows, focus, editing, onClear, onOpenPanel }: GridKeysArgs) =>
  (event: KeyboardEvent<HTMLTableElement>): void => {
    const press = keyPressOf(event);
    const { stop, size } = focus;
    if (stop === undefined || press === undefined || !isCellTarget(event.target)) return;
    const row = rows[stop.row];
    const column = GANTT_COLUMNS[stop.column];
    if (row === undefined || column === undefined) return;
    const editable = row.cells[stop.column]?.editable === true;
    const action = gridKeyAction(press, { mode: "navigate", column, editable });
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "move") focus.moveTo(moveFocus(stop, action.move, size));
    else if (action.kind === "edit" && isEditedColumn(column)) editing.begin(row, column);
    else if (action.kind === "edit" && column === "dependencies") onOpenPanel(row);
    else if (action.kind === "clear") onClear(row);
  };
