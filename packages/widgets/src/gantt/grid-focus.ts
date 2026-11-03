// The grid's roving focus (proposal, open question 18; EXPERIENCE Accessibility Floor, Tab order):
// one body cell holds the grid's Tab stop, the first until the user moves; the keys move it
// through `model/focus.ts`, and a cell the user clicks or tabs to takes it. The focused cell is
// view state: it never reaches the draft record.

import { type FocusEvent, type RefObject, useCallback, useRef, useState } from "react";
import { clampFocus, type GridFocus, type GridSize } from "./model/focus.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";

const COLUMN_ATTRIBUTE = "data-gantt-column";
const ROW_ATTRIBUTE = "data-gantt-row";

/** A body cell's element, found by its row's task and its column. Task IDs need no escaping. */
export const cellElement = (
  table: HTMLTableElement | null,
  taskId: string,
  column: GanttColumn,
): HTMLElement | null =>
  table?.querySelector<HTMLElement>(
    `[${ROW_ATTRIBUTE}="${taskId}"] > [${COLUMN_ATTRIBUTE}="${column}"]`,
  ) ?? null;

/** The body cell an element is, by its row and column; undefined for anything else. */
const cellPosition = (target: EventTarget, rows: readonly GanttRow[]): GridFocus | undefined => {
  if (!(target instanceof Element) || !target.hasAttribute(COLUMN_ATTRIBUTE)) return undefined;
  const taskId = target.parentElement?.getAttribute(ROW_ATTRIBUTE);
  const row = rows.findIndex((candidate) => candidate.id === taskId);
  const column = GANTT_COLUMNS.indexOf(target.getAttribute(COLUMN_ATTRIBUTE) as GanttColumn);
  return row < 0 || column < 0 ? undefined : { row, column };
};

/** Whether an event's target is a body cell itself, not a control inside one. */
export const isCellTarget = (target: EventTarget): boolean =>
  target instanceof Element && target.hasAttribute(COLUMN_ATTRIBUTE);

export type GridFocusState = {
  readonly table: RefObject<HTMLTableElement | null>;
  /** The cell that holds the Tab stop; undefined while the grid has no row. */
  readonly stop: GridFocus | undefined;
  readonly size: GridSize;
  /** Moves the Tab stop to a cell and focuses it. */
  readonly moveTo: (focus: GridFocus) => void;
  /** Gives the Tab stop to a cell the focus reached by a click or a Tab. */
  readonly onFocus: (event: FocusEvent<HTMLTableElement>) => void;
};

export const useGridFocus = (rows: readonly GanttRow[]): GridFocusState => {
  const table = useRef<HTMLTableElement>(null);
  const [focus, setFocus] = useState<GridFocus>({ row: 0, column: 0 });
  const size: GridSize = { rows: rows.length, columns: GANTT_COLUMNS.length };
  const stop = clampFocus(focus, size);
  const moveTo = useCallback(
    (next: GridFocus) => {
      setFocus(next);
      const row = rows[next.row];
      const column = GANTT_COLUMNS[next.column];
      if (row !== undefined && column !== undefined) {
        cellElement(table.current, row.id, column)?.focus();
      }
    },
    [rows],
  );
  const onFocus = useCallback(
    (event: FocusEvent<HTMLTableElement>) => {
      const reached = cellPosition(event.target, rows);
      if (reached === undefined) return;
      setFocus((held) =>
        held.row === reached.row && held.column === reached.column ? held : reached,
      );
    },
    [rows],
  );
  return { table, stop, size, moveTo, onFocus };
};
