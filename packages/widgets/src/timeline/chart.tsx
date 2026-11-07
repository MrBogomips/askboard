// The Timeline's chart (view-and-widgets spec: Timeline layout, Timeline moves by drag; DESIGN.md:
// Timeline): AskBoard's own SVG, the list of the entries as one listbox. The time axis, the Gantt's,
// under which the lanes are bands, starting `TIMELINE_LEFT_INSET` in from the left edge as the
// entries do, so that a milestone on the first day draws whole; then the entries (`entry.tsx`).
// Geometry is written as SVG attributes and colours and widths as classes built from DESIGN.md's
// tokens: no `style` attribute (AD-8). What the entries and the keys do is the widget's.

import type { TimelineEntry, TimelineProps } from "@askboard/contract";
import { type KeyboardEvent, type PointerEvent, type Ref, useMemo } from "react";
import { Axis } from "../shared/time/axis.tsx";
import type { Zoom } from "../shared/time/scale.ts";
import { CHART } from "./classes.ts";
import { TimelineEntryShape } from "./entry.tsx";
import { TIMELINE_LEFT_INSET, type TimelineLayout, type TimelineSpan } from "./layout.ts";

export const TimelineChart = ({
  svg,
  props,
  layout,
  span,
  zoom,
  labelledBy,
  names,
  moved,
  current,
  stop,
  shifted,
  editable,
  entryRef,
  onKeyDown,
  onCurrent,
  onPress,
  onMove,
  onRelease,
  onCancel,
}: {
  readonly svg: Ref<SVGSVGElement>;
  readonly props: TimelineProps;
  readonly layout: TimelineLayout;
  readonly span: TimelineSpan;
  readonly zoom: Zoom;
  /** The ID of the question's text, which names the chart. */
  readonly labelledBy: string;
  /** Each entry's accessible name, by ID. */
  readonly names: ReadonlyMap<string, string>;
  /** The entries off the agent's place. */
  readonly moved: ReadonlySet<string>;
  /** The user's current entry, if any, and the one holding the Tab stop. */
  readonly current: string | undefined;
  readonly stop: string | undefined;
  /** The entry being dragged and how far it is drawn from its place. */
  readonly shifted: { readonly id: string; readonly dx: number; readonly dy: number } | undefined;
  readonly editable: boolean;
  readonly entryRef: (id: string, node: SVGGElement | null) => void;
  readonly onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  readonly onCurrent: (id: string) => void;
  readonly onPress: (id: string, event: PointerEvent<SVGGElement>) => void;
  readonly onMove: (event: PointerEvent<SVGGElement>) => void;
  readonly onRelease: (event: PointerEvent<SVGGElement>) => void;
  readonly onCancel: () => void;
}) => {
  const rows = useMemo(
    () => layout.lanes.map(({ top, height }) => ({ top, height })),
    [layout.lanes],
  );
  const byId = new Map<string, TimelineEntry>(props.entries.map((entry) => [entry.id, entry]));
  return (
    <svg
      ref={svg}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the entries are drawn, so the list is the drawing's own role.
      role="listbox"
      aria-labelledby={labelledBy}
      aria-orientation="vertical"
      data-timeline-chart=""
      data-zoom={zoom}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={CHART}
      onKeyDown={onKeyDown}
    >
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: the axis holds nothing focusable. */}
      <g aria-hidden="true">
        <Axis
          origin={span.origin}
          last={span.last}
          zoom={zoom}
          width={layout.width}
          axisHeight={layout.axis}
          height={layout.height}
          rows={rows}
          inset={TIMELINE_LEFT_INSET}
        />
      </g>
      {layout.entries.map((placed) => {
        const entry = byId.get(placed.id);
        if (entry === undefined) return null;
        const drag = shifted?.id === placed.id ? shifted : undefined;
        return (
          <TimelineEntryShape
            key={placed.id}
            placed={placed}
            label={entry.label}
            name={names.get(placed.id) ?? entry.label}
            laneId={entry.lane}
            days={{ date: entry.date, start: entry.start, end: entry.end }}
            moved={moved.has(placed.id)}
            current={placed.id === current}
            stop={placed.id === stop}
            shift={drag === undefined ? undefined : { dx: drag.dx, dy: drag.dy }}
            editable={editable}
            entryRef={(node) => entryRef(placed.id, node)}
            onFocus={() => onCurrent(placed.id)}
            onPress={(event) => onPress(placed.id, event)}
            onMove={onMove}
            onRelease={onRelease}
            onCancel={onCancel}
          />
        );
      })}
    </svg>
  );
};
