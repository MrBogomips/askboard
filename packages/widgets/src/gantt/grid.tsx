// The Gantt's grid (design decision 9; EXPERIENCE Widgets, Gantt): a table whose role is `grid`,
// so that its rows, cells and column headers take their roles from the HTML, labelled by its
// question's text; a header row of 32px in `text-label` on `muted` ("Task", "Start", "Duration",
// "Depends on"; provisional) and one row of 36px per task, lined up with its row of the chart: its
// name, its start as the grid's date (`12/9/2026`), its duration in working days and its
// predecessors' names; a note, such as a refused entry's reason, takes a line under its row. Every
// agent string renders as text (AD-8). The grid is one Tab stop (`grid-focus.ts`); its keys are
// read on its cells only, so that an editor inside a cell keeps its own (`grid-keys.ts`).

import { questionTextId } from "@askboard/view/catalog";
import type { FocusEventHandler, KeyboardEventHandler, Ref } from "react";
import { CellEditor, noteId } from "./cell-editor.tsx";
import type { CellEditing } from "./editing.ts";
import { gridDate } from "./model/date.ts";
import type { GridFocus } from "./model/focus.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";

export const HEADERS: Readonly<Record<GanttColumn, string>> = {
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

/** A body cell: the anchor of its editor's echo, and the focus ring on keyboard focus. */
const CELL =
  "relative focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

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
  readonly itemId: string;
  readonly row: GanttRow;
  readonly schedule: TaskSchedule | undefined;
  readonly names: ReadonlyMap<string, string>;
  /** The column of the cell that holds the grid's Tab stop, if it is in this row. */
  readonly stop: number | undefined;
  readonly editing: CellEditing;
};

const TaskRow = ({ itemId, row, schedule, names, stop, editing }: TaskRowProps) => {
  const edited = editing.editing?.taskId === row.id ? editing.editing : undefined;
  return (
    <tr
      data-gantt-row={row.id}
      className="h-[36px] border-t border-border text-body text-foreground"
    >
      {row.cells.map(({ column }, index) => (
        <td
          key={column}
          data-gantt-column={column}
          // While its editor is open, the editor holds the cell's Tab stop.
          tabIndex={index === stop && edited?.column !== column ? 0 : -1}
          className={`${COLUMN[column]} ${FACE[column]} ${CELL}`}
        >
          {edited?.column === column ? (
            <CellEditor
              itemId={itemId}
              editing={edited}
              label={`${HEADERS[column]}, ${row.label}`}
              onChange={editing.change}
              onCommit={editing.commit}
              onCancel={editing.cancel}
            />
          ) : (
            <span className="block truncate">{cellText(column, row, schedule, names)}</span>
          )}
        </td>
      ))}
    </tr>
  );
};

type NoteRowProps = { readonly itemId: string; readonly taskId: string; readonly note: string };

/** The line under a task's row that holds its note, in the field error's colour. */
const NoteRow = ({ itemId, taskId, note }: NoteRowProps) => (
  <tr data-gantt-note={taskId} className="h-[20px] text-body text-destructive-text">
    <td colSpan={GANTT_COLUMNS.length} className="px-2">
      <span id={noteId(itemId, taskId)} className="block truncate">
        {note}
      </span>
    </td>
  </tr>
);

export type GridProps = {
  readonly itemId: string;
  readonly questionId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** Each task's note, by task ID: what sits under its row. */
  readonly notes: ReadonlyMap<string, string>;
  readonly editing: CellEditing;
  readonly table: Ref<HTMLTableElement>;
  /** The cell that holds the grid's Tab stop. */
  readonly stop: GridFocus | undefined;
  readonly onKeyDown: KeyboardEventHandler<HTMLTableElement>;
  readonly onFocus: FocusEventHandler<HTMLTableElement>;
};

export const Grid = (props: GridProps) => {
  const { itemId, rows, schedules, notes, stop } = props;
  const names = new Map(rows.map((row) => [row.id, row.label]));
  return (
    <table
      ref={props.table}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a grid is a table the user moves through (WAI-ARIA APG, Grid); the table gives its rows, cells and headers their roles.
      role="grid"
      aria-labelledby={questionTextId(props.questionId)}
      className="w-full table-fixed border-collapse"
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
    >
      <thead>
        <HeaderRow />
      </thead>
      <tbody>
        {rows.flatMap((row, index) => {
          const note = notes.get(row.id);
          const task = (
            <TaskRow
              key={row.id}
              itemId={itemId}
              row={row}
              schedule={schedules[index]}
              names={names}
              stop={stop?.row === index ? stop.column : undefined}
              editing={props.editing}
            />
          );
          if (note === undefined) return [task];
          const line = (
            <NoteRow key={`${row.id}:note`} itemId={itemId} taskId={row.id} note={note} />
          );
          return [task, line];
        })}
      </tbody>
    </table>
  );
};
