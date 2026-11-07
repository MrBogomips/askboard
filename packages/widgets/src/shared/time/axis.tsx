// The time axis a widget draws above its rows (gantt-widget design decision 9, moved here by
// latex-kanban-timeline design decision 10 for the Timeline): a band on `muted` with a label and a
// gridline per tick, in the ask's locale, a line under each row, and at day zoom a column on each
// weekend day. Geometry is written as SVG attributes and colours and widths as classes built from
// DESIGN.md's tokens: no `style` attribute (AD-8).

import { useLocale } from "@askboard/view/catalog";
import { memo } from "react";
import {
  axisTicks,
  labelLines,
  PIXELS_PER_DAY,
  type Tick,
  weekendDays,
  xOf,
  type Zoom,
} from "./scale.ts";

/** Where a label's lines sit in the axis band: one line, or two, the weekday over the day. */
const LINE_Y = { one: 20, first: 14, second: 28 } as const;

/**
 * A tick's label: one line, or at day zoom the weekday over the day, so that it fits its column.
 * The first line keeps its trailing space, so that the text reads `mer 11` whole.
 */
const TickLabel = ({ tick, zoom }: { readonly tick: Tick; readonly zoom: Zoom }) => {
  const [first, second] = labelLines(tick.label, zoom);
  const x = tick.x + 6;
  return (
    <text data-gantt-tick="" x={x} y={LINE_Y.one} className="fill-muted-foreground text-badge">
      {second === undefined ? (
        first
      ) : (
        <>
          <tspan x={x} y={LINE_Y.first}>{`${first} `}</tspan>
          <tspan x={x} y={LINE_Y.second}>
            {second}
          </tspan>
        </>
      )}
    </text>
  );
};

export type AxisProps = {
  /** The first and the last day of the span, which the axis covers from its left edge. */
  readonly origin: string;
  readonly last: string;
  readonly zoom: Zoom;
  /** The drawing's width, in px. */
  readonly width: number;
  /** The height of the band holding the labels. */
  readonly axisHeight: number;
  /** The height of the whole drawing: the gridlines and the weekend columns reach it. */
  readonly height: number;
  /** The rows under the band, each with a line at its bottom. Keep the list stable between draws. */
  readonly rows: readonly { readonly top: number; readonly height: number }[];
  /**
   * The room left of the origin day, in px: the days, their gridlines and labels start this far in,
   * while the band and the lines under the rows still run from the left edge (the Timeline's, so
   * that a milestone on the first day draws whole; none for the Gantt).
   */
  readonly inset?: number;
};

/** The axis band with its labels, a gridline per tick, and a line under each row. */
export const Axis = memo(
  ({ origin, last, zoom, width, axisHeight, height, rows, inset = 0 }: AxisProps) => {
    const locale = useLocale();
    return (
      <g>
        <rect x={0} y={0} width={width} height={axisHeight} className="fill-muted" />
        <line
          x1={0}
          y1={axisHeight - 0.5}
          x2={width}
          y2={axisHeight - 0.5}
          className="stroke-border stroke-1"
        />
        <g transform={inset === 0 ? undefined : `translate(${inset} 0)`}>
          {zoom === "day"
            ? weekendDays(origin, last).map((date) => (
                <rect
                  key={date}
                  data-gantt-weekend={date}
                  x={xOf(date, origin, zoom)}
                  y={axisHeight}
                  width={PIXELS_PER_DAY[zoom]}
                  height={height - axisHeight}
                  className="fill-muted"
                />
              ))
            : null}
        </g>
        {rows.map((row) => (
          <line
            key={row.top}
            x1={0}
            y1={row.top + row.height - 0.5}
            x2={width}
            y2={row.top + row.height - 0.5}
            className="stroke-border stroke-1"
          />
        ))}
        <g data-axis-days="" transform={inset === 0 ? undefined : `translate(${inset} 0)`}>
          {axisTicks(origin, last, zoom, locale).map((tick) => (
            <g key={tick.date}>
              <line
                x1={tick.x + 0.5}
                y1={0}
                x2={tick.x + 0.5}
                y2={height}
                className="stroke-border stroke-1"
              />
              <TickLabel tick={tick} zoom={zoom} />
            </g>
          ))}
        </g>
      </g>
    );
  },
);
