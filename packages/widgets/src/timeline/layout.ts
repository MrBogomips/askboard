// The Timeline's layout (latex-kanban-timeline, design decision 10), plain numbers that the
// component writes as attributes: the axis's span, from the first date as sent or as shown to the
// Gantt's tail past the last, so that a move never leaves the axis; the zoom the Timeline opens at;
// lanes as bands of tracks, entries in order of start, then of `entries`, each on the first track
// of its lane where its box overlaps no other; and an entry's shape and label. A box is the shape
// (a range's days, a milestone's diamond) plus its label after it, estimated at 7 pixels a
// character and cut at 200; a range holds its label inside when it fits there. Rows and bars take
// the Gantt's heights. Plain ECMAScript: no DOM, no `Date`.

import { GANTT_FIRST_DATE, type TimelineEntry, type TimelineProps } from "@askboard/contract";
import { AXIS_HEIGHT, BAR_HEIGHT, chartSpan, ROW_HEIGHT } from "../gantt/model/layout.ts";
import { dayNumber } from "../shared/time/date.ts";
import { openingZoom, PIXELS_PER_DAY, xOf, type Zoom } from "../shared/time/scale.ts";

/** A track is one row high, as a Gantt's row is. */
export const TRACK_HEIGHT = ROW_HEIGHT;
/** A milestone's diamond: as wide as a bar is high. */
export const MILESTONE_WIDTH = 14;
/** A label's estimate, and its cut: 7 pixels a character, at most 200 pixels. */
export const LABEL_CHAR_WIDTH = 7;
export const LABEL_MAX_WIDTH = 200;
/** From a shape to its label after it, and from a range's edge to its label inside it. */
const LABEL_GAP = 6;
const LABEL_PADDING = 6;
/** The least room between two boxes on one track. */
const TRACK_GAP = 4;

export type TimelineSpan = { readonly origin: string; readonly last: string };

export type LaneBand = {
  readonly id: string;
  readonly label: string;
  readonly top: number;
  readonly tracks: number;
  readonly height: number;
};

export type PlacedEntry = {
  readonly id: string;
  readonly kind: "range" | "milestone";
  /** The index of the entry's lane in the item's `lanes`. */
  readonly lane: number;
  readonly track: number;
  /** The shape's box: a bar, or a diamond's bounds. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: { readonly x: number; readonly width: number; readonly inside: boolean };
  /** The right edge of the entry's box, its label included. */
  readonly right: number;
};

export type TimelineLayout = {
  readonly width: number;
  readonly height: number;
  readonly axis: number;
  readonly lanes: readonly LaneBand[];
  readonly entries: readonly PlacedEntry[];
};

type Days = { readonly first: string; readonly last: string; readonly range: boolean };

/** An entry's first and last days: a milestone's `date` twice, a range's `start` and `end`. */
const daysOf = (entry: TimelineEntry): Days | undefined => {
  const { date, start, end } = entry;
  if (typeof start === "string" && typeof end === "string") {
    return { first: start, last: end, range: true };
  }
  return typeof date === "string" ? { first: date, last: date, range: false } : undefined;
};

const datesOf = (props: TimelineProps): string[] =>
  props.entries.flatMap((entry) => {
    const days = daysOf(entry);
    return days === undefined ? [] : [days.first, days.last];
  });

/**
 * The axis's first and last days: the earliest date among the props as sent and as shown, to the
 * Gantt's tail past the latest, within the days a Gantt may name. A Timeline with no day starts
 * at the first day.
 */
export const spanOf = (sent: TimelineProps, shown: TimelineProps): TimelineSpan => {
  // Sorted, full-dates of four-digit years come in the order of their days.
  const dates = [...datesOf(sent), ...datesOf(shown)].sort();
  return chartSpan(dates[0] ?? GANTT_FIRST_DATE, dates);
};

/** The zoom a Timeline opens at: the finest at which the span of its props as sent fits `width`. */
export const openingZoomOf = (sent: TimelineProps, width: number): Zoom => {
  const { origin, last } = spanOf(sent, sent);
  return openingZoom(dayNumber(last) - dayNumber(origin) + 1, width);
};

/** A label's estimated width: 7 pixels a character, in code points, cut at 200. */
export const labelWidth = (label: string): number =>
  Math.min(LABEL_MAX_WIDTH, LABEL_CHAR_WIDTH * [...label].length);

type Box = { readonly left: number; readonly right: number };

// An entry as the layout takes it: where it stands, before its track and lane are known.
type Drawn = Omit<PlacedEntry, "lane" | "track" | "y"> & { readonly first: string };

// An entry's shape on the axis, and its label inside or after it.
const drawn = (entry: TimelineEntry, days: Days, origin: string, zoom: Zoom): Drawn => {
  const perDay = PIXELS_PER_DAY[zoom];
  const width = days.range
    ? (dayNumber(days.last) - dayNumber(days.first) + 1) * perDay
    : MILESTONE_WIDTH;
  const x = days.range
    ? xOf(days.first, origin, zoom)
    : xOf(days.first, origin, zoom) + perDay / 2 - MILESTONE_WIDTH / 2;
  const text = labelWidth(entry.label);
  const inside = days.range && width >= text + 2 * LABEL_PADDING;
  const labelX = inside ? x + LABEL_PADDING : x + width + LABEL_GAP;
  return {
    id: entry.id,
    kind: days.range ? "range" : "milestone",
    first: days.first,
    x,
    width,
    height: BAR_HEIGHT,
    label: { x: labelX, width: text, inside },
    right: inside ? x + width : labelX + text,
  };
};

const overlaps = (box: Box, other: Box): boolean =>
  box.left < other.right + TRACK_GAP && other.left < box.right + TRACK_GAP;

// The first track of `tracks` where `box` overlaps no other, which `box` then joins; a new track
// when every one is taken.
const takeTrack = (tracks: Box[][], box: Box): number => {
  const free = tracks.findIndex((held) => held.every((other) => !overlaps(box, other)));
  const at = free === -1 ? tracks.length : free;
  if (free === -1) tracks.push([]);
  (tracks[at] as Box[]).push(box);
  return at;
};

/**
 * The layout of the props at `zoom` over `span`: the lanes under the axis, one band each, a row
 * high for each track; each entry in its lane's band, in the order of `entries`. An entry in no
 * lane of the item, or holding no day, which the contract refuses, is left out.
 */
export const layoutOf = (props: TimelineProps, span: TimelineSpan, zoom: Zoom): TimelineLayout => {
  const laneIds = props.lanes.map(({ id }) => id);
  const items = props.entries.flatMap((entry, index) => {
    const days = daysOf(entry);
    const lane = laneIds.indexOf(entry.lane);
    return days === undefined || lane === -1
      ? []
      : [{ index, lane, shape: drawn(entry, days, span.origin, zoom) }];
  });
  const tracks = laneIds.map((): Box[][] => []);
  const trackOf = new Map<string, number>();
  const byStart = [...items].sort((a, b) =>
    a.shape.first < b.shape.first ? -1 : a.shape.first > b.shape.first ? 1 : a.index - b.index,
  );
  for (const { lane, shape } of byStart) {
    trackOf.set(
      shape.id,
      takeTrack(tracks[lane] as Box[][], { left: shape.x, right: shape.right }),
    );
  }
  let top = AXIS_HEIGHT;
  const lanes = props.lanes.map(({ id, label }, at): LaneBand => {
    const count = Math.max(1, (tracks[at] as Box[][]).length);
    const band = Object.freeze({ id, label, top, tracks: count, height: count * TRACK_HEIGHT });
    top += band.height;
    return band;
  });
  const entries = items.map(({ lane, shape }): PlacedEntry => {
    const track = trackOf.get(shape.id) as number;
    const { first: _first, ...rest } = shape;
    const row = (lanes[lane] as LaneBand).top + track * TRACK_HEIGHT;
    return Object.freeze({ ...rest, lane, track, y: row + (TRACK_HEIGHT - BAR_HEIGHT) / 2 });
  });
  const spanWidth = (dayNumber(span.last) - dayNumber(span.origin) + 1) * PIXELS_PER_DAY[zoom];
  return Object.freeze({
    width: Math.max(spanWidth, ...entries.map(({ right }) => right)),
    height: top,
    axis: AXIS_HEIGHT,
    lanes: Object.freeze(lanes),
    entries: Object.freeze(entries),
  });
};

/** The ID of the lane whose band holds `y`, from the top of the chart; none above or below them. */
export const laneAt = (layout: TimelineLayout, y: number): string | undefined =>
  layout.lanes.find((lane) => y >= lane.top && y < lane.top + lane.height)?.id;
