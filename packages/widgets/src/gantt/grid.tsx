// The Gantt's grid (design decision 9; EXPERIENCE Widgets, Gantt): a table whose role is `grid`,
// so that its rows, cells and column headers take their roles from the HTML, labelled by its
// question's text; a header row of 32px in `text-label` on `muted` ("Task", "Start", "Duration",
// "Depends on"; provisional) and one row of 36px per task, lined up with its row of the chart: its
// name, its start as the grid's date (`12/9/2026`), its duration in working days and its
// predecessors' names. Every agent string renders as text (AD-8). The grid is one Tab stop: one
// body cell holds it (`grid-focus.ts`), and the arrow keys, Home and End move it between cells,
// with the focus ring, their browser action prevented (proposal, open question 18).

import { questionTextId } from "@askboard/view/catalog";
import type { KeyboardEvent } from "react";
import { isCellTarget, useGridFocus } from "./grid-focus.ts";
import { keyPressOf } from "./key-press.ts";
import { gridDate } from "./model/date.ts";
import { moveFocus } from "./model/focus.ts";
import { gridKeyAction } from "./model/keys.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";

const HEADERS: Readonly<Record<GanttColumn, string>> = {
  task: "Task",
  start: "Start",
  duration: "Duration",
  dependencies: "Depends on",
};

/** Each column's width and alignment; the name takes what the others leave. */
const COLUMN: Readonly<Record<GanttColumn, string>> = {
  task: "px-2 text-left",
  start: "w-[104px] px-2 text-left",
  duration: "w-[80px] px-2 text-right",
  dependencies: "w-[150px] px-2 text-left",
};

/** A body cell: the focus ring on keyboard focus (DESIGN.md, Focus ring). */
const CELL = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

/** The face of each column's values: dates and numbers in the code face. */
const FACE: Readonly<Record<GanttColumn, string>> = {
  task: "",
  start: "font-mono text-code",
  duration: "font-mono text-code",
  dependencies: "",
};

/** What a cell shows, from its row, the row's schedule and every task's name. */
export const cellText = (
  column: GanttColumn,
  row: GanttRow,
  schedule: TaskSchedule | undefined,
  names: ReadonlyMap<string, string>,
): string => {
  if (column === "task") return row.label;
  if (column === "dependencies") {
    return row.dependencies.map((id) => names.get(id) ?? id).join(", ");
  }
  if (column === "duration") return row.duration === undefined ? "" : String(row.duration);
  return schedule?.kind === "scheduled" ? gridDate(schedule.startDate) : "";
};

const HeaderRow = () => (
  <tr className="h-[32px] bg-muted text-label text-muted-foreground uppercase">
    {GANTT_COLUMNS.map((column) => (
      <th key={column} scope="col" className={`${COLUMN[column]} font-semibold`}>
        {HEADERS[column]}
      </th>
    ))}
  </tr>
);

type TaskRowProps = {
  readonly row: GanttRow;
  readonly schedule: TaskSchedule | undefined;
  readonly names: ReadonlyMap<string, string>;
  /** The column of the cell that holds the grid's Tab stop, if it is in this row. */
  readonly stop: number | undefined;
};

const TaskRow = ({ row, schedule, names, stop }: TaskRowProps) => (
  <tr data-gantt-row={row.id} className="h-[36px] border-t border-border text-body text-foreground">
    {row.cells.map(({ column }, index) => (
      <td
        key={column}
        data-gantt-column={column}
        tabIndex={index === stop ? 0 : -1}
        className={`${COLUMN[column]} ${FACE[column]} ${CELL}`}
      >
        <span className="block truncate">{cellText(column, row, schedule, names)}</span>
      </td>
    ))}
  </tr>
);

export type GridProps = {
  readonly questionId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
};

export const Grid = ({ questionId, rows, schedules }: GridProps) => {
  const names = new Map(rows.map((row) => [row.id, row.label]));
  const { table, stop, size, moveTo, onFocus } = useGridFocus(rows);
  // Only a key on a cell itself is the grid's: a control inside a cell keeps its own keys.
  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const press = keyPressOf(event);
    if (stop === undefined || press === undefined || !isCellTarget(event.target)) return;
    const column = GANTT_COLUMNS[stop.column] ?? "task";
    const action = gridKeyAction(press, { mode: "navigate", column, editable: false });
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "move") moveTo(moveFocus(stop, action.move, size));
  };
  return (
    <table
      ref={table}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a grid is a table the user moves through (WAI-ARIA APG, Grid); the table gives its rows, cells and headers their roles.
      role="grid"
      aria-labelledby={questionTextId(questionId)}
      className="w-full table-fixed border-collapse"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <thead>
        <HeaderRow />
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <TaskRow
            key={row.id}
            row={row}
            schedule={schedules[index]}
            names={names}
            stop={stop?.row === index ? stop.column : undefined}
          />
        ))}
      </tbody>
    </table>
  );
};
