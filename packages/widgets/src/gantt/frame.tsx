// The Gantt's widget frame (design decision 9; DESIGN.md Base controls, Widget frame, and Widgets,
// Gantt): a bordered box holding the toolbar row with the change counter, and a plan's zoom; the
// body, the grid on the left and the chart on the right in a region that scrolls sideways; then
// the legend under them (`chrome.tsx`). A task the user changed takes the change outline on its
// bar and the change fill on its changed cells (`model/kinds.ts`); a read-only Gantt keeps its
// zoom and its navigation and turns its editors, its panel and its pointer edits off (AD-10,
// AD-21). The scrolling region keeps out of the Tab order, so that the grid stays one Tab stop,
// and in a plan the zoom another: the grid carries every keyboard path to the tasks. The frame
// holds the Gantt's view state, the zoom, the grid's focus, its editor and its predecessors panel,
// and lays the chart's rows out under the grid's, a note's line included, so that each bar stays
// beside its row. Only a Gantt's own tasks take a duration: a plan's follow its Tree's estimates.
// Both open a task's predecessors panel from its "Depends on", a plan's offering its Tree's leaves.

import type { GanttProps } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Chart } from "./chart.tsx";
import { Legend, Toolbar } from "./chrome.tsx";
import { type Editing, useCellEditing } from "./editing.ts";
import { Grid } from "./grid.tsx";
import { cellElement, useGridFocus } from "./grid-focus.ts";
import { gridKeyHandler } from "./grid-keys.ts";
import { dayNumber } from "./model/date.ts";
import { clearStart, setDuration } from "./model/edits.ts";
import { landOn } from "./model/entries.ts";
import { chartSpan, rowBoxes } from "./model/layout.ts";
import type { TaskMarks } from "./model/marks.ts";
import { scheduleNote } from "./model/notes.ts";
import { openingZoom, stretchedLast, type Zoom } from "./model/scale.ts";
import { type Baseline, movedBaselines, type TaskSchedule } from "./model/schedule.ts";
import { type GanttColumn, type GanttRow, isOwnGantt } from "./model/tasks.ts";
import { usePanelState } from "./panel-state.ts";
import { useChartBox } from "./use-chart-box.ts";
import { useRowHeight } from "./use-row-height.ts";

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
  const text = useStrings();
  const errors = useMemo(() => {
    const labels = new Map(rows.map((row) => [row.id, row.label]));
    return rows.flatMap((row, index) => {
      const note = scheduleNote(itemId, row, schedules[index], labels, text);
      return note === undefined ? [] : [[row.id, note] as const];
    });
  }, [itemId, rows, schedules, text]);
  const refusal = editing?.refusal;
  const taskId = editing?.taskId;
  return useMemo(
    () =>
      new Map([...errors, ...(refusal === undefined ? [] : [[taskId ?? "", refusal] as const])]),
    [errors, refusal, taskId],
  );
};

export type FrameProps = {
  readonly itemId: string;
  readonly questionId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** A plan's baselines, in the rows' order; undefined for a Gantt with its own tasks. */
  readonly baselines: readonly (Baseline | undefined)[] | undefined;
  /** What the user changed, by task, and how many tasks the toolbar counts. */
  readonly marks: ReadonlyMap<string, TaskMarks>;
  readonly count: number;
  /** The tasks that follow the plan's Tree, which the counter names after the user's changes. */
  readonly derived: number;
  /** The Gantt as it stands, and as the agent sent it, of one kind. */
  readonly current: GanttProps;
  readonly sent: GanttProps;
  /** Puts the Gantt's next value into the draft. */
  readonly onCommit: (value: GanttProps) => void;
  /** Whether its toolbar offers the zoom: a plan's does; a standalone Gantt shows the week. */
  readonly zoomable: boolean;
  /** Whether the Gantt takes edits: false while its question is answered, sent or locked. */
  readonly editable: boolean;
};

/**
 * The axis's span: from the plan's start, or an earlier start, past the last finish, a baseline's
 * included, so that the agent's dates stay on the axis when the tasks end sooner.
 */
const spanOf = (
  start: string,
  schedules: readonly TaskSchedule[],
  baselines: readonly (Baseline | undefined)[],
) => {
  const scheduled = schedules.flatMap((schedule) =>
    schedule.kind === "scheduled" ? [schedule] : [],
  );
  const finishes = [...scheduled, ...baselines.flatMap((baseline) => baseline ?? [])].map(
    (dates) => dates.finishDate,
  );
  return chartSpan(
    start,
    finishes,
    scheduled.map((schedule) => schedule.startDate),
  );
};

/** The shadow on a side of the chart's frame that holds more (view spec, "Gantt overflow cue"). */
const EdgeCue = ({
  side,
  shown,
}: {
  readonly side: "before" | "after";
  readonly shown: boolean;
}) =>
  shown ? (
    <div
      aria-hidden="true"
      data-gantt-more={side}
      className={`pointer-events-none absolute inset-y-0 w-[16px] from-foreground/20 to-transparent ${side === "before" ? "left-0 bg-linear-to-r" : "right-0 bg-linear-to-l"}`}
    />
  ) : null;

export const GanttFrame = (props: FrameProps) => {
  const { itemId, rows, schedules, baselines, marks, current, sent, onCommit, editable } = props;
  // The zoom the user chose, else the one the plan opened at: the finest at which it fits.
  const [chosen, setChosen] = useState<Zoom | undefined>(undefined);
  const [opened, setOpened] = useState<Zoom | undefined>(undefined);
  const zoom = chosen ?? opened ?? "week";
  const scroller = useRef<HTMLDivElement>(null);
  const box = useChartBox(scroller);
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
  // A read-only Gantt shows no editor, and no refusal of one.
  const notes = useNotes(itemId, rows, schedules, editable ? editing.editing : undefined);
  const unit = useRowHeight();
  const layout = useMemo(
    () =>
      rowBoxes(
        rows.map((row) => notes.has(row.id)),
        unit,
      ),
    [rows, notes, unit],
  );
  const span = useMemo(
    () => spanOf(current.start, schedules, baselines ?? []),
    [current.start, schedules, baselines],
  );
  useLayoutEffect(() => {
    if (opened !== undefined || !props.zoomable || !box.width) return;
    const days = dayNumber(span.last) - dayNumber(span.origin) + 1;
    setOpened(openingZoom(days, box.width));
  }, [opened, props.zoomable, box.width, span]);
  // A short span is stretched to the frame's width.
  const shownSpan = useMemo(
    () => ({ origin: span.origin, last: stretchedLast(span, zoom, box.width ?? 0) }),
    [span, zoom, box.width],
  );
  const drawn = useMemo(
    () => (baselines === undefined ? undefined : movedBaselines(baselines, schedules)),
    [baselines, schedules],
  );
  const own = isOwnGantt(current) && isOwnGantt(sent);
  const onKeyDown = gridKeyHandler({
    rows,
    focus,
    editing,
    onClear: (row) => onCommit(clearStart(current, sent, row.id)),
    onOpenPanel: panels.open,
    editable,
  });
  // Only a Gantt's own tasks take a duration: a plan's follow its Tree's estimates.
  const onResize = own
    ? (taskId: string, duration: number) => onCommit(setDuration(current, sent, taskId, duration))
    : undefined;
  return (
    <div className="flex flex-col rounded-md border border-border bg-card">
      <Toolbar
        count={props.count}
        derived={props.derived}
        zoom={props.zoomable ? { zoom, onZoom: setChosen } : undefined}
      />
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
            marks={marks}
            editable={editable}
            table={table}
            stop={focus.stop}
            onKeyDown={onKeyDown}
            onFocus={focus.onFocus}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          <div ref={scroller} tabIndex={-1} className="overflow-x-auto outline-none">
            <Chart
              itemId={itemId}
              rows={rows}
              schedules={schedules}
              baselines={drawn}
              layout={layout}
              span={shownSpan}
              zoom={zoom}
              marks={marks}
              editable={editable}
              onMove={(taskId, day, earliest) =>
                onCommit(landOn(current, sent, taskId, day, earliest))
              }
              onResize={onResize}
            />
          </div>
          <EdgeCue side="before" shown={box.edges.before} />
          <EdgeCue side="after" shown={box.edges.after} />
        </div>
      </div>
      <Legend baseline={drawn?.some((baseline) => baseline !== undefined) === true} />
    </div>
  );
};
