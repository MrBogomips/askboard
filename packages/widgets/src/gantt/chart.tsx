// The Gantt's chart (design decision 9; DESIGN.md Widgets, Gantt): AskBoard's own SVG, labelled
// with its zoom and not focusable, since the grid carries every keyboard path. The time axis on
// `muted` with its labels and gridlines; per task in a row of the grid a bar in `gantt-bar`, or in
// `critical` on the critical path; finish-to-start elbow arrows, 1px in `gantt-bar`, or 2px in
// `critical` between two critical tasks, each with its arrowhead. A task the graph cannot schedule
// has no bar and no arrow. Geometry is written as SVG attributes and colours and widths as classes
// built from DESIGN.md's tokens: no `style` attribute (AD-8).

import { memo } from "react";
import { dayNumber } from "./model/date.ts";
import type { ChartSpan } from "./model/layout.ts";
import { AXIS_HEIGHT, arrowPath, type BarBox, barBox, type RowBoxes } from "./model/layout.ts";
import { PIXELS_PER_DAY, ticks, type Zoom } from "./model/scale.ts";
import type { TaskSchedule } from "./model/schedule.ts";
import type { GanttRow } from "./model/tasks.ts";

/** A drawn task: its bar and whether it is on the critical path. */
export type DrawnBar = {
  readonly id: string;
  readonly box: BarBox;
  readonly start: string;
  readonly finish: string;
  readonly critical: boolean;
};

type Arrow = { readonly from: DrawnBar; readonly to: DrawnBar; readonly critical: boolean };

/** The bars of the tasks the graph scheduled, by task ID, in the rows' order. */
export const drawnBars = (
  rows: readonly GanttRow[],
  schedules: readonly TaskSchedule[],
  layout: RowBoxes,
  span: ChartSpan,
  zoom: Zoom,
): ReadonlyMap<string, DrawnBar> => {
  const bars = new Map<string, DrawnBar>();
  rows.forEach((row, index) => {
    const schedule = schedules[index];
    const box = layout.boxes[index];
    if (schedule?.kind !== "scheduled" || box === undefined) return;
    const { startDate: start, finishDate: finish, critical } = schedule;
    bars.set(row.id, {
      id: row.id,
      box: barBox(start, finish, span.origin, zoom, box),
      start,
      finish,
      critical,
    });
  });
  return bars;
};

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

const Bar = ({ bar }: { readonly bar: DrawnBar }) => (
  <rect
    data-gantt-bar={bar.id}
    data-start={bar.start}
    data-finish={bar.finish}
    data-critical={bar.critical}
    x={bar.box.x}
    y={bar.box.y}
    width={bar.box.width}
    height={bar.box.height}
    className={bar.critical ? "fill-critical" : "fill-gantt-bar"}
  />
);

export type ChartProps = {
  readonly itemId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  readonly layout: RowBoxes;
  readonly span: ChartSpan;
  readonly zoom: Zoom;
};

export const Chart = ({ itemId, rows, schedules, layout, span, zoom }: ChartProps) => {
  const width = (dayNumber(span.last) - dayNumber(span.origin) + 1) * PIXELS_PER_DAY[zoom];
  const bars = drawnBars(rows, schedules, layout, span, zoom);
  return (
    <svg
      role="img"
      aria-label={`Gantt chart, ${zoom} zoom`}
      width={width}
      height={layout.height}
      viewBox={`0 0 ${width} ${layout.height}`}
      className="block select-none"
    >
      <Markers itemId={itemId} />
      <Axis span={span} zoom={zoom} width={width} layout={layout} />
      <g>
        {arrowsOf(rows, bars).map((arrow) => (
          <ArrowPath key={`${arrow.from.id}>${arrow.to.id}`} itemId={itemId} arrow={arrow} />
        ))}
      </g>
      <g>
        {[...bars.values()].map((bar) => (
          <Bar key={bar.id} bar={bar} />
        ))}
      </g>
    </svg>
  );
};
