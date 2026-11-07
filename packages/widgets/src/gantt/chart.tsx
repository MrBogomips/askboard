// The Gantt's chart (design decision 9; DESIGN.md Widgets, Gantt): AskBoard's own SVG, labelled
// with its zoom and not focusable, since the grid carries every keyboard path. The time axis on
// `muted` with its labels and gridlines; per task in a row of the grid a bar in `gantt-bar`, or in
// `critical` on the critical path; finish-to-start elbow arrows, 1px in `gantt-bar`, or 2px in
// `critical` on a tight link between two critical tasks (`critical-link.ts`), each with its
// arrowhead; in a plan, the baselines under the bars. A task the graph cannot schedule has no bar
// and no arrow. The pointer drags a bar to move it, or its end to resize it (`bars.tsx`, `shared/pointer-drag.ts`); the drop reschedules through `drag.ts` and the draft,
// and the arrows follow once the graph is rebuilt. Geometry is written as SVG attributes and colours
// and widths as classes built from DESIGN.md's tokens: no `style` attribute (AD-8).

import { useStrings } from "@askboard/view/catalog";
import { memo, useCallback, useMemo } from "react";
import { usePointerDrag } from "../shared/pointer-drag.ts";
import { Axis } from "../shared/time/axis.tsx";
import { dayNumber } from "../shared/time/date.ts";
import { PIXELS_PER_DAY, type Zoom } from "../shared/time/scale.ts";
import {
  type BarDrag,
  BarShape,
  BaselineShape,
  type DrawnBar,
  drawnBars,
  drawnBaselines,
  Guide,
  ResizeFeedback,
} from "./bars.tsx";
import { isCriticalLink } from "./model/critical-link.ts";
import { moveDrop, resizeDrop } from "./model/drag.ts";
import type { ChartSpan } from "./model/layout.ts";
import { arrowMarkerId, arrowPath, type RowBoxes } from "./model/layout.ts";
import { looksCritical } from "./model/legend.ts";
import type { TaskMarks } from "./model/marks.ts";
import { movedBox, resizedBox } from "./model/preview.ts";
import type { Baseline, TaskSchedule } from "./model/schedule.ts";
import type { GanttRow } from "./model/tasks.ts";
import { ZOOM_LABELS } from "./zoom.tsx";

type Arrow = { readonly from: DrawnBar; readonly to: DrawnBar; readonly critical: boolean };

const arrowsOf = (rows: readonly GanttRow[], bars: ReadonlyMap<string, DrawnBar>): Arrow[] =>
  rows.flatMap((row) => {
    const to = bars.get(row.id);
    if (to === undefined) return [];
    return row.dependencies.flatMap((id) => {
      const from = bars.get(id);
      return from === undefined ? [] : [{ from, to, critical: isCriticalLink(from, to) }];
    });
  });

const Markers = memo(({ itemId }: { readonly itemId: string }) => (
  <defs>
    <marker
      id={arrowMarkerId(itemId, false)}
      viewBox="0 0 6 6"
      refX="6"
      refY="3"
      markerWidth="6"
      markerHeight="6"
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0,0 L6,3 L0,6 z" className="fill-border-strong" />
    </marker>
    <marker
      id={arrowMarkerId(itemId, true)}
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
));

const ArrowPath = memo(
  ({
    itemId,
    arrow,
    highlight,
  }: {
    readonly itemId: string;
    readonly arrow: Arrow;
    readonly highlight: boolean;
  }) => {
    const critical = looksCritical(arrow.critical, highlight);
    return (
      <path
        data-gantt-arrow=""
        data-from={arrow.from.id}
        data-to={arrow.to.id}
        data-critical={arrow.critical}
        d={arrowPath(arrow.from.box, arrow.to.box)}
        markerEnd={`url(#${arrowMarkerId(itemId, critical)})`}
        className={
          critical
            ? "fill-none stroke-critical stroke-2"
            : "fill-none stroke-border-strong stroke-1"
        }
      />
    );
  },
);

/**
 * The arrows between the drawn bars, built again only when the bars are: a pointer move draws the
 * dragged bar again, never the arrows, which follow once the drop has rebuilt the graph.
 */
const Arrows = memo(
  ({
    itemId,
    arrows,
    highlight,
  }: {
    readonly itemId: string;
    readonly arrows: readonly Arrow[];
    readonly highlight: boolean;
  }) => (
    <g>
      {arrows.map((arrow) => (
        <ArrowPath
          key={`${arrow.from.id}>${arrow.to.id}`}
          itemId={itemId}
          arrow={arrow}
          highlight={highlight}
        />
      ))}
    </g>
  ),
);

const isDerived = (mark: TaskMarks | undefined): boolean => mark?.derived === true && !mark.changed;

export type ChartProps = {
  readonly itemId: string;
  readonly rows: readonly GanttRow[];
  readonly schedules: readonly TaskSchedule[];
  /** A plan's baselines, in the rows' order; undefined for a Gantt with its own tasks. */
  readonly baselines: readonly (Baseline | undefined)[] | undefined;
  readonly layout: RowBoxes;
  readonly span: ChartSpan;
  readonly zoom: Zoom;
  /** The room the chart's frame gives it, in px: a span of fewer whole days than fill it is drawn that wide. */
  readonly room: number;
  /** What the user changed, by task: a changed task's bar takes the change outline. */
  readonly marks: ReadonlyMap<string, TaskMarks>;
  /** Whether the bars take pointer edits. */
  readonly editable: boolean;
  /** Whether the critical path is highlighted (the toolbar's switch). */
  readonly highlight: boolean;
  /**
   * A bar dropped on another day than it starts on: its task asks for it, holds no request on its
   * earliest start, or takes the agent's request back on the day that request schedules it on.
   */
  readonly onMove: (taskId: string, day: string, earliest: string) => void;
  /**
   * A bar's end dropped: its task's new duration, in working days, which a plan's task takes as a
   * request. Undefined where the bars take no handle.
   */
  readonly onResize: ((taskId: string, duration: number) => void) | undefined;
};

/** Where the dragged bar is drawn while the pointer moves, from `drag.ts`'s rules. */
const draggedBox = (bar: DrawnBar, drag: BarDrag, span: ChartSpan, zoom: Zoom) => {
  if (drag.kind === "resize") return resizedBox(bar.box, drag.dx, zoom);
  const landing = moveDrop({ start: bar.start, earliest: bar.earliest, dx: drag.dx, zoom });
  return movedBox(bar.box, landing, span.origin, zoom);
};

/** The live duration and the earliest-end guide of a bar whose end is dragged. */
const ResizeLabel = ({
  bar,
  drag,
  zoom,
  height,
}: {
  readonly bar: DrawnBar;
  readonly drag: BarDrag;
  readonly zoom: Zoom;
  readonly height: number;
}) => {
  const resized = resizeDrop({ start: bar.start, finish: bar.finish, dx: drag.dx, zoom });
  if (resized.kind !== "duration") return null;
  const drawn = resizedBox(bar.box, drag.dx, zoom);
  return (
    <ResizeFeedback
      bar={bar}
      drawn={drawn}
      duration={resized.duration}
      zoom={zoom}
      height={height}
    />
  );
};

export const Chart = (props: ChartProps) => {
  const { itemId, rows, schedules, layout, span, zoom, onMove, onResize } = props;
  const text = useStrings();
  const width = Math.max(
    (dayNumber(span.last) - dayNumber(span.origin) + 1) * PIXELS_PER_DAY[zoom],
    props.room,
  );
  const bars = useMemo(
    () => drawnBars(rows, schedules, layout, span, zoom),
    [rows, schedules, layout, span, zoom],
  );
  const onDrop = useCallback(
    ({ id: taskId, kind, dx }: BarDrag) => {
      const bar = bars.get(taskId);
      if (bar === undefined) return;
      if (kind === "move") {
        const landing = moveDrop({ start: bar.start, earliest: bar.earliest, dx, zoom });
        // A bar landing where it starts did not move: its task keeps what it holds.
        if (landing.kind !== "click" && landing.start !== bar.start) {
          onMove(taskId, landing.start, bar.earliest);
        }
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
  const arrows = useMemo(() => arrowsOf(rows, bars), [rows, bars]);
  const { drag, press, move, release, cancel } = usePointerDrag(onDrop, props.editable);
  const dragged = drag === undefined ? undefined : bars.get(drag.id);
  return (
    <svg
      role="img"
      aria-label={text("gantt.chart.name", { zoom: text(ZOOM_LABELS[zoom]).toLowerCase() })}
      width={width}
      height={layout.height}
      viewBox={`0 0 ${width} ${layout.height}`}
      className="block touch-none select-none"
    >
      <Markers itemId={itemId} />
      <Axis
        origin={span.origin}
        last={span.last}
        zoom={zoom}
        width={width}
        axisHeight={layout.axis}
        height={layout.height}
        rows={layout.boxes}
      />
      <g>
        {baselines.map((baseline) => (
          <BaselineShape key={baseline.id} baseline={baseline} />
        ))}
      </g>
      <Arrows itemId={itemId} arrows={arrows} highlight={props.highlight} />
      <g>
        {[...bars.values()].map((bar) => (
          <BarShape
            key={bar.id}
            bar={bar}
            drawn={bar === dragged && drag ? draggedBox(bar, drag, span, zoom) : bar.box}
            changed={props.marks.get(bar.id)?.changed === true}
            derived={isDerived(props.marks.get(bar.id))}
            draggable={props.editable}
            resizable={onResize !== undefined}
            highlight={props.highlight}
            onPress={press}
            onMove={move}
            onRelease={release}
            onCancel={cancel}
          />
        ))}
      </g>
      {dragged !== undefined && drag?.kind === "move" ? (
        <Guide bar={dragged} span={span} zoom={zoom} height={layout.height} />
      ) : null}
      {dragged !== undefined && drag?.kind === "resize" ? (
        <ResizeLabel bar={dragged} drag={drag} zoom={zoom} height={layout.height} />
      ) : null}
    </svg>
  );
};
