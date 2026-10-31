// The chart's bars (design decision 9; DESIGN.md Widgets, Gantt): per task the graph scheduled, a
// 14px bar in `gantt-bar`, or in `critical` on the critical path, with a 6px handle on its end
// that resizes it in a Gantt with its own tasks; the press that drags either is `bar-drag.ts`'s.
// While a bar is dragged it is drawn where it would land (`model/preview.ts`), and a move shows
// its earliest start as the guide, a 1px dashed line in `muted-foreground` over its row (proposal,
// open question 7). Geometry as SVG attributes, colours and widths as token classes (AD-8).

import { memo, type PointerEvent } from "react";
import type { DragKind } from "./bar-drag.ts";
import type { ChartSpan } from "./model/layout.ts";
import { type BarBox, barBox, ROW_HEIGHT, type RowBox, type RowBoxes } from "./model/layout.ts";
import { xOf, type Zoom } from "./model/scale.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import type { GanttRow } from "./model/tasks.ts";

/** A drawn task: its bar, its row, its dates and whether it is on the critical path. */
export type DrawnBar = {
  readonly id: string;
  readonly box: BarBox;
  readonly row: RowBox;
  readonly start: string;
  readonly finish: string;
  /** The earliest start its predecessors allow, where a move stops. */
  readonly earliest: string;
  readonly critical: boolean;
};

/** The resize handle's width, on the bar's end. */
export const HANDLE_WIDTH = 6;

/** The bars of the tasks the graph scheduled, by task ID, in the rows' order. */
export const drawnBars = (
  rows: readonly GanttRow[],
  schedules: readonly TaskSchedule[],
  layout: RowBoxes,
  span: ChartSpan,
  zoom: Zoom,
): ReadonlyMap<string, DrawnBar> => {
  const bars = new Map<string, DrawnBar>();
  rows.forEach((task, index) => {
    const schedule = schedules[index];
    const row = layout.boxes[index];
    if (schedule?.kind !== "scheduled" || row === undefined) return;
    const { startDate: start, finishDate: finish, earliestDate: earliest, critical } = schedule;
    const box = barBox(start, finish, span.origin, zoom, row);
    bars.set(task.id, { id: task.id, box, row, start, finish, earliest, critical });
  });
  return bars;
};

/** Where the press lands: the bar, or its end's handle. */
export type Press = (taskId: string, kind: DragKind, event: PointerEvent<SVGElement>) => void;

type BarShapeProps = {
  readonly bar: DrawnBar;
  /** Where the bar is drawn while it is dragged; its own box otherwise. */
  readonly drawn: BarBox;
  /** Whether the user may drag it; a read-only Gantt's bars do not move. */
  readonly draggable: boolean;
  readonly onPress: Press;
  readonly onMove: (event: PointerEvent<SVGElement>) => void;
  readonly onRelease: (event: PointerEvent<SVGElement>) => void;
  readonly onCancel: () => void;
};

export const BarShape = memo(({ bar, drawn, draggable, ...on }: BarShapeProps) => {
  const pointer = (kind: DragKind) =>
    draggable
      ? {
          onPointerDown: (event: PointerEvent<SVGElement>) => on.onPress(bar.id, kind, event),
          onPointerMove: on.onMove,
          onPointerUp: on.onRelease,
          onPointerCancel: on.onCancel,
          onLostPointerCapture: on.onCancel,
        }
      : {};
  return (
    <g>
      <rect
        data-gantt-bar={bar.id}
        data-start={bar.start}
        data-finish={bar.finish}
        data-critical={bar.critical}
        x={drawn.x}
        y={drawn.y}
        width={drawn.width}
        height={drawn.height}
        className={`${bar.critical ? "fill-critical" : "fill-gantt-bar"} ${draggable ? "cursor-grab" : ""}`}
        {...pointer("move")}
      />
      {draggable ? (
        <rect
          data-gantt-handle={bar.id}
          x={drawn.x + drawn.width - HANDLE_WIDTH}
          y={drawn.y}
          width={HANDLE_WIDTH}
          height={drawn.height}
          className="cursor-ew-resize fill-transparent"
          {...pointer("resize")}
        />
      ) : null}
    </g>
  );
});

/** The earliest start a moved bar may take, over its row. */
export const Guide = ({
  bar,
  span,
  zoom,
}: {
  readonly bar: DrawnBar;
  readonly span: ChartSpan;
  readonly zoom: Zoom;
}) => {
  const x = xOf(bar.earliest, span.origin, zoom) + 0.5;
  return (
    <line
      data-gantt-guide=""
      data-date={bar.earliest}
      x1={x}
      y1={bar.row.top}
      x2={x}
      y2={bar.row.top + ROW_HEIGHT}
      className="stroke-muted-foreground stroke-1 [stroke-dasharray:3_3]"
    />
  );
};
