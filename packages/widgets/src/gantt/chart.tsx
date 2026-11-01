// The Gantt's chart (design decision 9; DESIGN.md Widgets, Gantt): AskBoard's own SVG, labelled
// with its zoom and not focusable, since the grid carries every keyboard path. The time axis on
// `muted` with its labels and gridlines; per task in a row of the grid a bar in `gantt-bar`, or in
// `critical` on the critical path; finish-to-start elbow arrows, 1px in `gantt-bar`, or 2px in
// `critical` between two critical tasks, each with its arrowhead; in a plan, the baselines under
// the bars. A task the graph cannot schedule has no bar and no arrow. The pointer drags a bar to
// move it, or, in a Gantt with its own tasks, its end to resize it (`bars.tsx`, `bar-drag.ts`);
// the drop reschedules through `drag.ts` and the draft, and the arrows follow once the graph is
// rebuilt. Geometry is written as SVG attributes and colours and widths as classes built from
// DESIGN.md's tokens: no `style` attribute (AD-8).

import { memo, useCallback, useMemo } from "react";
import { type BarDrag, useBarDrag } from "./bar-drag.ts";
import {
  BarShape,
  BaselineShape,
  type DrawnBar,
  drawnBars,
  drawnBaselines,
  Guide,
} from "./bars.tsx";
import { dayNumber } from "./model/date.ts";
import { moveDrop, resizeDrop } from "./model/drag.ts";
import type { ChartSpan } from "./model/layout.ts";
import { AXIS_HEIGHT, arrowPath, type RowBoxes } from "./model/layout.ts";
import type { TaskMarks } from "./model/marks.ts";
import { movedBox, resizedBox } from "./model/preview.ts";
import { PIXELS_PER_DAY, ticks, type Zoom } from "./model/scale.ts";
import type { Baseline, TaskSchedule } from "./model/schedule.ts";
import type { GanttRow } from "./model/tasks.ts";

type Arrow = { readonly from: DrawnBar; readonly to: DrawnBar; readonly critical: boolean };

const arrowsOf = (rows: readonly GanttRow[], bars: ReadonlyMap<string, DrawnBar>): Arrow[] =>
  rows.flatMap((row) => {
    const to = bars.get(row.id);
    if (to === undefined) return [];
    return row.dependencies.flatMap((id) => {
      const from = bars.get(id);
      return from === undefined ? [] : [{ from, to, critical: from.critical && to.critical }];
    });
  });

const markerId = (itemId: string, critical: boolean) =>
  `gantt-${itemId}-${critical ? "critical-arrow" : "arrow"}`;

const Markers = ({ itemId }: { readonly itemId: string }) => (
  <defs>
    <marker
      id={markerId(itemId, false)}
      viewBox="0 0 6 6"
      refX="6"
      refY="3"
      markerWidth="6"
      markerHeight="6"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0,0 L6,3 L0,6 z" className="fill-gantt-bar" />
    </marker>
    <marker
      id={markerId(itemId, true)}
      viewBox="0 0 7 7"
      refX="7"
      refY="3.5"
      markerWidth="7"
      markerHeight="7"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0,0 L7,3.5 L0,7 z" className="fill-critical" />
    </marker>
  </defs>
);

type AxisProps = {
  readonly span: ChartSpan;
  readonly zoom: Zoom;
  readonly width: number;
  readonly layout: RowBoxes;
};

/** The axis band with its labels, a gridline per tick, and a line under each row. */
const Axis = memo(({ span, zoom, width, layout }: AxisProps) => (
  <g>
    <rect x={0} y={0} width={width} height={AXIS_HEIGHT} className="fill-muted" />
    <line
      x1={0}
      y1={AXIS_HEIGHT - 0.5}
      x2={width}
      y2={AXIS_HEIGHT - 0.5}
      className="stroke-border stroke-1"
    />
    {layout.boxes.map((box) => (
      <line
        key={box.top}
        x1={0}
        y1={box.top + box.height - 0.5}
        x2={width}
        y2={box.top + box.height - 0.5}
        className="stroke-border stroke-1"
      />
    ))}
    {ticks(span.origin, span.last, zoom).map((tick) => (
      <g key={tick.date}>
        <line
          x1={tick.x + 0.5}
          y1={0}
          x2={tick.x + 0.5}
          y2={layout.height}
          className="stroke-border stroke-1"
        />
        <text data-gantt-tick="" x={tick.x + 6} y={20} className="fill-muted-foreground text-badge">
          {tick.label}
        </text>
      </g>
    ))}
  </g>
));

const ArrowPath = ({ itemId, arrow }: { readonly itemId: string; readonly arrow: Arrow }) => (
  <path
    data-gantt-arrow=""
    data-from={arrow.from.id}
    data-to={arrow.to.id}
    data-critical={arrow.critical}
    d={arrowPath(arrow.from.box, arrow.to.box)}
    markerEnd={`url(#${markerId(itemId, arrow.critical)})`}
    className={
      arrow.critical ? "fill-none stroke-critical stroke-2" : "fill-none stroke-gantt-bar stroke-1"
    }
  />
);

export type ChartProps = {
  readonly itemId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** A plan's baselines, in the rows' order; undefined for a Gantt with its own tasks. */
  readonly baselines: readonly (Baseline | undefined)[] | undefined;
  readonly layout: RowBoxes;
  readonly span: ChartSpan;
  readonly zoom: Zoom;
  /** What the user changed, by task: a changed task's bar takes the change outline. */
  readonly marks: ReadonlyMap<string, TaskMarks>;
  /** Whether the bars take pointer edits. */
  readonly editable: boolean;
  /** A bar dropped on a day: its task asks for it, or holds no request on its earliest start. */
  readonly onMove: (taskId: string, day: string, earliest: string) => void;
  /**
   * A bar's end dropped: its task's new duration, in working days. Undefined in a plan, whose
   * durations follow its Tree: its bars have no handle.
   */
  readonly onResize: ((taskId: string, duration: number) => void) | undefined;
};

/** Where the dragged bar is drawn while the pointer moves, from `drag.ts`'s rules. */
const draggedBox = (bar: DrawnBar, drag: BarDrag, span: ChartSpan, zoom: Zoom) => {
  if (drag.kind === "resize") return resizedBox(bar.box, drag.dx, zoom);
  const landing = moveDrop({ start: bar.start, earliest: bar.earliest, dx: drag.dx, zoom });
  return movedBox(bar.box, landing, span.origin, zoom);
};

export const Chart = (props: ChartProps) => {
  const { itemId, rows, schedules, layout, span, zoom, onMove, onResize } = props;
  const width = (dayNumber(span.last) - dayNumber(span.origin) + 1) * PIXELS_PER_DAY[zoom];
  const bars = useMemo(
    () => drawnBars(rows, schedules, layout, span, zoom),
    [rows, schedules, layout, span, zoom],
  );
  const onDrop = useCallback(
    ({ taskId, kind, dx }: BarDrag) => {
      const bar = bars.get(taskId);
      if (bar === undefined) return;
      if (kind === "move") {
        const landing = moveDrop({ start: bar.start, earliest: bar.earliest, dx, zoom });
        if (landing.kind !== "click") onMove(taskId, landing.start, bar.earliest);
        return;
      }
      const resized = resizeDrop({ start: bar.start, finish: bar.finish, dx, zoom });
      if (resized.kind === "duration") onResize?.(taskId, resized.duration);
    },
    [bars, zoom, onMove, onResize],
  );
  const baselines = useMemo(
    () => drawnBaselines(rows, props.baselines ?? [], layout, span, zoom),
    [rows, props.baselines, layout, span, zoom],
  );
  const { drag, press, move, release, cancel } = useBarDrag(onDrop);
  const dragged = drag === undefined ? undefined : bars.get(drag.taskId);
  return (
    <svg
      role="img"
      aria-label={`Gantt chart, ${zoom} zoom`}
      width={width}
      height={layout.height}
      viewBox={`0 0 ${width} ${layout.height}`}
      className="block touch-none select-none"
    >
      <Markers itemId={itemId} />
      <Axis span={span} zoom={zoom} width={width} layout={layout} />
      <g>
        {baselines.map((baseline) => (
          <BaselineShape key={baseline.id} baseline={baseline} />
        ))}
      </g>
      <g>
        {arrowsOf(rows, bars).map((arrow) => (
          <ArrowPath key={`${arrow.from.id}>${arrow.to.id}`} itemId={itemId} arrow={arrow} />
        ))}
      </g>
      <g>
        {[...bars.values()].map((bar) => (
          <BarShape
            key={bar.id}
            bar={bar}
            drawn={bar === dragged && drag ? draggedBox(bar, drag, span, zoom) : bar.box}
            changed={props.marks.get(bar.id)?.changed === true}
            draggable={props.editable}
            resizable={onResize !== undefined}
            onPress={press}
            onMove={move}
            onRelease={release}
            onCancel={cancel}
          />
        ))}
      </g>
      {dragged !== undefined && drag?.kind === "move" ? (
        <Guide bar={dragged} span={span} zoom={zoom} />
      ) : null}
    </svg>
  );
};
