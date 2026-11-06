// The chart's bars (design decision 9; DESIGN.md Widgets, Gantt): per task the graph scheduled, a
// 14px bar in `gantt-bar`, or in `critical` on the critical path, with a 6px handle on its end
// that resizes it in a Gantt with its own tasks; the press that drags either is `bar-drag.ts`'s. A
// task of no duration, a plan's milestone, is a diamond on its start. A
// task the user changed takes the 2px `change` outline, offset by 1px (`gantt-user-change`).
// While a bar is dragged it is drawn where it would land (`model/preview.ts`), and a move shows
// its earliest start as the guide, a full-height 2px dashed line with its date. In a plan, each
// task that has moved from the agent's dates has its baseline under its bar: those dates as a 2px
// dashed `border-strong` line, which stays where it is while the task moves (review F-12, F-14). Geometry as SVG attributes, colours and widths as token
// classes (AD-8).

import { formatShortDate } from "@askboard/contract";
import { useLocale, useStrings } from "@askboard/view/catalog";
import { memo, type PointerEvent } from "react";
import type { DragKind } from "./bar-drag.ts";
import type { ChartSpan } from "./model/layout.ts";
import { type BarBox, barBox, baselineBox, type RowBox, type RowBoxes } from "./model/layout.ts";
import { xOf, type Zoom } from "./model/scale.ts";
import type { Baseline, TaskSchedule } from "./model/schedule.ts";
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

/** A drawn baseline: its task, the agent's dates for it and its box under the task's bar. */
export type DrawnBaseline = {
  readonly id: string;
  readonly start: string;
  readonly finish: string;
  readonly box: BarBox;
};

/** The baselines of the rows that have one, in the rows' order. */
export const drawnBaselines = (
  rows: readonly GanttRow[],
  baselines: readonly (Baseline | undefined)[],
  layout: RowBoxes,
  span: ChartSpan,
  zoom: Zoom,
): readonly DrawnBaseline[] =>
  rows.flatMap((task, index) => {
    const baseline = baselines[index];
    const row = layout.boxes[index];
    if (baseline === undefined || row === undefined) return [];
    const { startDate: start, finishDate: finish } = baseline;
    return [
      { id: task.id, start, finish, box: baselineBox(start, finish, span.origin, zoom, row) },
    ];
  });

/** The baseline: the agent's dates as a 2px dashed `border-strong` line under the bar. */
export const BaselineShape = memo(({ baseline }: { readonly baseline: DrawnBaseline }) => {
  const y = baseline.box.y + baseline.box.height / 2;
  return (
    <line
      data-gantt-baseline={baseline.id}
      data-start={baseline.start}
      data-finish={baseline.finish}
      x1={baseline.box.x}
      y1={y}
      x2={baseline.box.x + baseline.box.width}
      y2={y}
      className="pointer-events-none stroke-border-strong stroke-2 [stroke-dasharray:4_3]"
    />
  );
});

/** Where the press lands: the bar, or its end's handle. */
export type Press = (taskId: string, kind: DragKind, event: PointerEvent<SVGElement>) => void;

type BarShapeProps = {
  readonly bar: DrawnBar;
  /** Where the bar is drawn while it is dragged; its own box otherwise. */
  readonly drawn: BarBox;
  /** Whether the user changed the task: its bar takes the change outline. */
  readonly changed: boolean;
  /** Whether the task only follows the plan's Tree: a dotted outline, no change border. */
  readonly derived: boolean;
  /** Whether the user may drag it; a read-only Gantt's bars do not move. */
  readonly draggable: boolean;
  /** Whether its end resizes it: only a Gantt's own tasks take a duration. */
  readonly resizable: boolean;
  readonly onPress: Press;
  readonly onMove: (event: PointerEvent<SVGElement>) => void;
  readonly onRelease: (event: PointerEvent<SVGElement>) => void;
  readonly onCancel: () => void;
};

/** The outline's inset from the bar: a 2px stroke centred 2px out leaves a 1px gap. */
const OUTLINE = 2;

/** A milestone, a task of no duration, as a diamond as high as a bar, centred on its start. */
const diamondPoints = ({ x, y, height }: BarBox): string => {
  const half = height / 2;
  return `${x - half},${y + half} ${x},${y} ${x + half},${y + half} ${x},${y + height}`;
};

const Bar = ({ bar, drawn, changed, derived, draggable, resizable, ...on }: BarShapeProps) => {
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
      {drawn.width === 0 ? (
        <polygon
          data-gantt-bar={bar.id}
          data-start={bar.start}
          data-finish={bar.finish}
          data-critical={bar.critical}
          data-milestone=""
          points={diamondPoints(drawn)}
          className={`${bar.critical ? "fill-critical" : "fill-gantt-bar"} ${draggable ? "cursor-grab" : ""}`}
          {...pointer("move")}
        />
      ) : (
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
      )}
      {changed ? (
        <rect
          data-gantt-change={bar.id}
          x={drawn.x - OUTLINE}
          y={drawn.y - OUTLINE}
          width={drawn.width + 2 * OUTLINE}
          height={drawn.height + 2 * OUTLINE}
          className="pointer-events-none fill-none stroke-change stroke-2"
        />
      ) : null}
      {derived && !changed ? (
        <rect
          data-gantt-derived={bar.id}
          x={drawn.x - OUTLINE}
          y={drawn.y - OUTLINE}
          width={drawn.width + 2 * OUTLINE}
          height={drawn.height + 2 * OUTLINE}
          className="pointer-events-none fill-none stroke-change stroke-1 [stroke-dasharray:1_2]"
        />
      ) : null}
      {draggable && resizable ? (
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
};

export const BarShape = memo(Bar);

/**
 * The earliest start a moved bar may take, shown while it is dragged: a full-height 2px dashed
 * line in `foreground-secondary` with its date, "earliest 11/6" (review F-14).
 */
export const Guide = ({
  bar,
  span,
  zoom,
  height,
}: {
  readonly bar: DrawnBar;
  readonly span: ChartSpan;
  readonly zoom: Zoom;
  /** The chart's height, which the guide spans. */
  readonly height: number;
}) => {
  const text = useStrings();
  const locale = useLocale();
  const x = xOf(bar.earliest, span.origin, zoom) + 0.5;
  const label = text("gantt.guide.earliest", { date: formatShortDate(bar.earliest, locale) });
  return (
    <g data-gantt-guide="" data-date={bar.earliest} className="pointer-events-none">
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        className="stroke-foreground-secondary stroke-2 [stroke-dasharray:4_3]"
      />
      <text
        data-gantt-guide-label=""
        x={x + 6}
        y={bar.row.top + 9}
        className="fill-foreground-secondary stroke-card stroke-[3px] text-badge [paint-order:stroke]"
      >
        {label}
      </text>
    </g>
  );
};
