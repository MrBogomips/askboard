// The Gantt's grid (design decision 9; EXPERIENCE Widgets, Gantt): a table whose role is `grid`,
// so that its rows, cells and column headers take their roles from the HTML, labelled by its
// question's text; a header row of 32px in `text-label` on `muted` ("Task", "Start", "Duration",
// "Depends on"; provisional) and one row of 36px per task, lined up with its row of the chart: its
// name, its start as the grid's date (`12/9/2026`), its duration in working days, right-aligned,
// and its predecessors' names, over their panel while it is open; a note, such as a refused
// entry's reason, takes a line under its row. A plan's duration is its work package's PERT
// estimate from the graph, a value no key edits, and the row of a package the user added in its
// Tree takes the added mark, the change bar on its left edge (DESIGN.md, Change highlight). Every
// agent string renders as text (AD-8). The grid is one Tab stop (`grid-focus.ts`); its keys are
// read on its cells only, so that an editor or a panel inside a cell keeps its own
// (`grid-keys.ts`).

import type { GanttProps, Locale } from "@askboard/contract";
import { questionTextId, useLocale } from "@askboard/view/catalog";
import type { FocusEventHandler, KeyboardEventHandler, Ref } from "react";
import { CellEditor, noteId } from "./cell-editor.tsx";
import type { CellEditing } from "./editing.ts";
import { gridDate } from "./model/date.ts";
import type { GridFocus } from "./model/focus.ts";
import type { TaskMarks } from "./model/marks.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import { GANTT_COLUMNS, type GanttColumn, type GanttRow } from "./model/tasks.ts";
import { PredecessorsPanel } from "./panel.tsx";
import type { PanelState } from "./panel-state.ts";

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

/** A cell the user changed: the change fill and text, with the change border (DESIGN.md). */
const CHANGED = "bg-change-subtle text-change-text inset-ring inset-ring-change";

/** A row the user added: the change bar on its left edge, as the Tree's added row has it. */
const ADDED = "shadow-[inset_2px_0_0_0_var(--change)]";

/** Whether the user changed what a cell shows, by its column. */
const changedIn = (column: GanttColumn, mark: TaskMarks | undefined): boolean =>
  mark !== undefined && column !== "task" && mark[column];

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
  locale: Locale = "en-US",
): string => {
  if (column === "task") return row.label;
  if (column === "dependencies") {
    return row.dependencies.map((id) => names.get(id) ?? id).join(", ");
  }
  const scheduled = schedule?.kind === "scheduled" ? schedule : undefined;
  if (column === "duration") {
    // A task's own duration, or a plan's, which the graph gives from its estimates.
    const days = row.duration ?? scheduled?.duration;
    return days === undefined ? "" : String(days);
  }
  return scheduled === undefined ? "" : gridDate(scheduled.startDate, locale);
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
  /** Every row, which the row's predecessors panel offers. */
  readonly rows: readonly GanttRow[];
  readonly schedule: TaskSchedule | undefined;
  readonly names: ReadonlyMap<string, string>;
  /** The column of the cell that holds the grid's Tab stop, if it is in this row. */
  readonly stop: number | undefined;
  readonly editing: CellEditing;
  readonly panels: PanelState;
  /** The Gantt as it stands, which an open panel checks its boxes against. */
  readonly current: GanttProps;
  /** What the user changed in the task. */
  readonly mark: TaskMarks | undefined;
  /** Whether the Gantt takes edits: a read-only one opens no editor and no panel. */
  readonly editable: boolean;
};

/** The predecessors panel of the row, if it is open, in its "Depends on" cell. */
const RowPanel = ({ itemId, row, rows, panels, current, editable }: TaskRowProps) => {
  const { panel } = panels;
  if (!editable || panel?.taskId !== row.id) return null;
  return (
    <PredecessorsPanel
      itemId={itemId}
      row={row}
      current={current}
      rows={rows}
      panel={panel}
      onToggle={panels.toggle}
      onDone={panels.done}
      onCancel={panels.cancel}
    />
  );
};

const TaskRow = (props: TaskRowProps) => {
  const locale = useLocale();
  const { itemId, row, schedule, names, stop, editing, mark } = props;
  const edited = props.editable && editing.editing?.taskId === row.id ? editing.editing : undefined;
  const added = mark?.added === true;
  return (
    <tr
      data-gantt-row={row.id}
      data-gantt-added={added ? "" : undefined}
      className="h-[36px] border-t border-border text-body text-foreground"
    >
      {row.cells.map(({ column, editable }, index) => (
        <td
          key={column}
          data-gantt-column={column}
          data-editable={props.editable && editable && edited?.column !== column ? true : undefined}
          // While its editor is open, the editor holds the cell's Tab stop.
          tabIndex={index === stop && edited?.column !== column ? 0 : -1}
          className={`${COLUMN[column]} ${FACE[column]} ${CELL} ${changedIn(column, mark) ? CHANGED : ""} ${added && column === "task" ? ADDED : ""}`}
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
            <span className="block truncate">{cellText(column, row, schedule, names, locale)}</span>
          )}
          {column === "dependencies" ? <RowPanel {...props} /> : null}
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
  readonly panels: PanelState;
  readonly current: GanttProps;
  /** What the user changed, by task. */
  readonly marks: ReadonlyMap<string, TaskMarks>;
  readonly editable: boolean;
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
              rows={rows}
              schedule={schedules[index]}
              names={names}
              stop={stop?.row === index ? stop.column : undefined}
              editing={props.editing}
              panels={props.panels}
              current={props.current}
              mark={props.marks.get(row.id)}
              editable={props.editable}
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
