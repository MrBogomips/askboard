// The Gantt's widget frame (design decision 9; DESIGN.md Base controls, Widget frame, and Widgets,
// Gantt): a bordered box holding the body, the grid on the left and the chart on the right in a
// region that scrolls sideways, then the legend under them: task, critical path and "your change"
// (colour page). The scrolling region keeps out of the Tab order, so that the grid stays the
// Gantt's one Tab stop: the grid carries every keyboard path. The frame holds the grid's view
// state, its focus, its editor and its predecessors panel, and lays the chart's rows out under the
// grid's, a note's line included, so that each bar stays beside its row.

import { useCallback, useMemo } from "react";
import { Chart } from "./chart.tsx";
import { type Editing, useCellEditing } from "./editing.ts";
import { Grid } from "./grid.tsx";
import { cellElement, useGridFocus } from "./grid-focus.ts";
import { gridKeyHandler } from "./grid-keys.ts";
import { clearStart, setDuration } from "./model/edits.ts";
import { landOn } from "./model/entries.ts";
import { chartSpan, rowBoxes } from "./model/layout.ts";
import { scheduleNote } from "./model/notes.ts";
import type { Zoom } from "./model/scale.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import type { GanttColumn, GanttOwnProps, GanttRow } from "./model/tasks.ts";
import { usePanelState } from "./panel-state.ts";

/**
 * The note under each row: a refused entry's reason for the row being edited, else the field
 * error of a task the graph cannot schedule (`model/notes.ts`).
 */
const useNotes = (
  itemId: string,
  rows: readonly GanttRow[],
  schedules: readonly TaskSchedule[],
  editing: Editing | undefined,
): ReadonlyMap<string, string> => {
  const errors = useMemo(() => {
    const labels = new Map(rows.map((row) => [row.id, row.label]));
    return rows.flatMap((row, index) => {
      const note = scheduleNote(itemId, row, schedules[index], labels);
      return note === undefined ? [] : [[row.id, note] as const];
    });
  }, [itemId, rows, schedules]);
  const refusal = editing?.refusal;
  const taskId = editing?.taskId;
  return useMemo(
    () =>
      new Map([...errors, ...(refusal === undefined ? [] : [[taskId ?? "", refusal] as const])]),
    [errors, refusal, taskId],
  );
};

const Swatch = ({ className }: { readonly className: string }) => (
  <span aria-hidden="true" className={`inline-block ${className}`} />
);

const Legend = () => (
  <div className="flex items-center gap-4 border-t border-border px-2 py-1.5 text-badge text-muted-foreground">
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="h-[8px] w-[16px] bg-gantt-bar" />
      task
    </span>
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="h-[8px] w-[16px] bg-critical" />
      critical path
    </span>
    <span className="inline-flex items-center gap-1.5">
      <Swatch className="mx-0.5 h-[6px] w-[12px] outline-2 outline-offset-1 outline-change" />
      your change
    </span>
  </div>
);

export type FrameProps = {
  readonly itemId: string;
  readonly questionId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** The Gantt as it stands, and as the agent sent it. */
  readonly current: GanttOwnProps;
  readonly sent: GanttOwnProps;
  /** Puts the Gantt's next value into the draft. */
  readonly onCommit: (value: GanttOwnProps) => void;
  readonly zoom: Zoom;
};

/** The axis's span: from the plan's start, or an earlier start, past the last finish. */
const spanOf = (start: string, schedules: readonly TaskSchedule[]) => {
  const scheduled = schedules.flatMap((schedule) =>
    schedule.kind === "scheduled" ? [schedule] : [],
  );
  return chartSpan(
    start,
    scheduled.map((schedule) => schedule.finishDate),
    scheduled.map((schedule) => schedule.startDate),
  );
};

export const GanttFrame = (props: FrameProps) => {
  const { itemId, rows, schedules, current, sent, onCommit } = props;
  const focus = useGridFocus(rows);
  const { table } = focus;
  const focusCell = useCallback(
    (taskId: string, column: GanttColumn) => cellElement(table.current, taskId, column)?.focus(),
    [table],
  );
  const editing = useCellEditing({ current, sent, rows, schedules, onCommit, focusCell });
  const panels = usePanelState({
    current,
    sent,
    onCommit,
    focusCell: (taskId) => focusCell(taskId, "dependencies"),
  });
  const notes = useNotes(itemId, rows, schedules, editing.editing);
  const layout = useMemo(() => rowBoxes(rows.map((row) => notes.has(row.id))), [rows, notes]);
  const span = useMemo(() => spanOf(current.start, schedules), [current.start, schedules]);
  const onKeyDown = gridKeyHandler({
    rows,
    focus,
    editing,
    onClear: (row) => onCommit(clearStart(current, sent, row.id)),
    onOpenPanel: panels.open,
  });
  return (
    <div className="flex flex-col rounded-md border border-border bg-card">
      <div className="flex">
        <div className="w-[480px] shrink-0 border-r border-border">
          <Grid
            itemId={itemId}
            questionId={props.questionId}
            rows={rows}
            schedules={schedules}
            notes={notes}
            editing={editing}
            panels={panels}
            current={current}
            table={table}
            stop={focus.stop}
            onKeyDown={onKeyDown}
            onFocus={focus.onFocus}
          />
        </div>
        <div tabIndex={-1} className="min-w-0 flex-1 overflow-x-auto outline-none">
          <Chart
            itemId={itemId}
            rows={rows}
            schedules={schedules}
            layout={layout}
            span={span}
            zoom={props.zoom}
            editable={true}
            onMove={(taskId, day, earliest) =>
              onCommit(landOn(current, sent, taskId, day, earliest))
            }
            onResize={(taskId, duration) => onCommit(setDuration(current, sent, taskId, duration))}
          />
        </div>
      </div>
      <Legend />
    </div>
  );
};
