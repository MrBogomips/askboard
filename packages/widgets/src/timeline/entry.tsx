// One entry of the Timeline's chart (view-and-widgets spec: Timeline layout, Timeline moves by drag;
// DESIGN.md: Timeline): a range as a `gantt-bar` bar, a milestone as a diamond in `foreground`, and
// its label after it or inside a range that holds it, cut at 200 pixels. It is one option of the
// chart, the current one (or the first, while none is) holding the chart's Tab stop, with the whole
// label in its accessible name. A moved entry takes the change outline and the current one its
// ring. The press that drags it is `shared/pointer-drag.ts`'s; while it is dragged it is drawn
// shifted by the preview. Its label is the agent's content, shown as text (AD-8).

import type { PointerEvent } from "react";
import {
  CHANGE_OUTLINE,
  CURRENT_RING,
  ENTRY,
  ENTRY_GRAB,
  ENTRY_LABEL,
  MILESTONE,
  RANGE,
} from "./classes.ts";
import type { PlacedEntry } from "./layout.ts";
import { shownLabel } from "./text.ts";

/** The outline's distance from the shape: a 2px stroke centred 2px out leaves a 1px gap. */
const OUTLINE = 2;
/** The ring's distance from the shape and its label. */
const RING = 3;

const diamond = ({ x, y, width, height }: PlacedEntry, grow: number): string => {
  const [cx, cy] = [x + width / 2, y + height / 2];
  const half = width / 2 + grow;
  return `${cx - half},${cy} ${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half}`;
};

export const TimelineEntryShape = ({
  placed,
  label,
  name,
  laneId,
  days,
  moved,
  current,
  stop,
  shift,
  editable,
  entryRef,
  onFocus,
  onPress,
  onMove,
  onRelease,
  onCancel,
}: {
  readonly placed: PlacedEntry;
  /** The entry's label, whole. */
  readonly label: string;
  /** Its accessible name: label, days and lane. */
  readonly name: string;
  readonly laneId: string;
  /** Its days as the drawing reports them: a milestone's date, a range's start and end. */
  readonly days: { readonly date?: string; readonly start?: string; readonly end?: string };
  /** Not where the agent put it, in time or in lane. */
  readonly moved: boolean;
  /** The user made it the current entry. */
  readonly current: boolean;
  /** It holds the chart's Tab stop. */
  readonly stop: boolean;
  /** Where the pointer has dragged it to, from its place; none while it is not dragged. */
  readonly shift: { readonly dx: number; readonly dy: number } | undefined;
  /** The Timeline can change: the entry drags. */
  readonly editable: boolean;
  /** Hands the entry's element to the chart, for its focus. */
  readonly entryRef: (node: SVGGElement | null) => void;
  /** The entry took the focus or a press: it is the current one. */
  readonly onFocus: () => void;
  readonly onPress: (event: PointerEvent<SVGGElement>) => void;
  readonly onMove: (event: PointerEvent<SVGGElement>) => void;
  readonly onRelease: (event: PointerEvent<SVGGElement>) => void;
  readonly onCancel: () => void;
}) => {
  const range = placed.kind === "range";
  const shapeClass = `${range ? RANGE : MILESTONE} ${editable ? ENTRY_GRAB : ""}`;
  const pointer = editable
    ? {
        onPointerDown: onPress,
        onPointerMove: onMove,
        onPointerUp: onRelease,
        onPointerCancel: onCancel,
        onLostPointerCapture: onCancel,
      }
    : {};
  return (
    <g
      ref={entryRef}
      role="option"
      aria-label={name}
      aria-selected={current}
      aria-current={current ? "true" : undefined}
      tabIndex={stop ? 0 : -1}
      data-timeline-entry={placed.id}
      data-kind={placed.kind}
      data-lane={laneId}
      data-date={days.date}
      data-start={days.start}
      data-end={days.end}
      data-change={moved ? "moved" : undefined}
      data-dragging={shift === undefined ? undefined : ""}
      transform={shift === undefined ? undefined : `translate(${shift.dx} ${shift.dy})`}
      className={ENTRY}
      onFocus={onFocus}
      {...pointer}
    >
      {range ? (
        <rect
          data-timeline-shape=""
          x={placed.x}
          y={placed.y}
          width={placed.width}
          height={placed.height}
          className={shapeClass}
        />
      ) : (
        <polygon data-timeline-shape="" points={diamond(placed, 0)} className={shapeClass} />
      )}
      {moved ? (
        range ? (
          <rect
            data-timeline-change=""
            x={placed.x - OUTLINE}
            y={placed.y - OUTLINE}
            width={placed.width + 2 * OUTLINE}
            height={placed.height + 2 * OUTLINE}
            className={CHANGE_OUTLINE}
          />
        ) : (
          <polygon
            data-timeline-change=""
            points={diamond(placed, OUTLINE)}
            className={CHANGE_OUTLINE}
          />
        )
      ) : null}
      <text
        data-timeline-label=""
        x={placed.label.x}
        y={placed.y + placed.height / 2}
        dominantBaseline="central"
        className={ENTRY_LABEL}
      >
        {shownLabel(label)}
      </text>
      {current ? (
        <rect
          data-timeline-current=""
          x={placed.x - RING}
          y={placed.y - RING}
          width={placed.right - placed.x + 2 * RING}
          height={placed.height + 2 * RING}
          className={CURRENT_RING}
        />
      ) : null}
    </g>
  );
};
