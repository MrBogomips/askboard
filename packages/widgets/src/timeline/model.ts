// The Timeline's model (latex-kanban-timeline, design decision 10), pure: an entry's move in time
// and across lanes, what a drag's drop makes of its travel, the keyboard's step and order, the
// value the draft holds and the entries that moved. A move keeps a range's length and every date
// within the days a Gantt may name, and every entry at its index in `entries`, so that the diff
// against the props as sent is `set`s of `lane`, `date`, `start` and `end` only (AD-20). Each edit
// gives a new frozen value, or the same value when nothing changes, since the draft record
// compares values by identity. Plain ECMAScript: no DOM, no `Date`.

import type { TimelineEntry, TimelineProps } from "@askboard/contract";
import { dateOfDay, dayNumber, FIRST_DAY, LAST_DAY } from "../shared/time/date.ts";
import { PIXELS_PER_DAY, type Zoom } from "../shared/time/scale.ts";

/** Pixels the pointer travels before a press on an entry becomes a drag: the Gantt's. */
export const TIMELINE_DRAG_THRESHOLD = 3;

const DAY_FIELDS = ["date", "start", "end"] as const;
const MOVE_FIELDS = ["lane", ...DAY_FIELDS] as const;

/** What a drop makes of a drag: nothing to move, or a number of days and a lane to put the entry in. */
export type Drop =
  | { readonly kind: "click" }
  | { readonly kind: "move"; readonly days: number; readonly lane: string | undefined };

// The props with `entry` in place of the entry at `index`: the other entries stay as they were.
const withEntry = (props: TimelineProps, index: number, entry: TimelineEntry): TimelineProps =>
  Object.freeze({
    ...props,
    entries: Object.freeze(props.entries.map((held, at) => (at === index ? entry : held))),
  });

/**
 * The props with the entry `days` later, earlier for a negative count: a range keeps its length,
 * and the move stops where its latest date reaches the last day, or its earliest the first, that a
 * Gantt may name. The same props, by identity, for an entry the item does not hold, a count that is
 * no whole number, or a move that stops where it stands.
 */
export const moveBy = (props: TimelineProps, entryId: string, days: number): TimelineProps => {
  const index = props.entries.findIndex(({ id }) => id === entryId);
  const entry = props.entries[index];
  if (entry === undefined || !Number.isInteger(days)) return props;
  const fields = DAY_FIELDS.filter((field) => typeof entry[field] === "string");
  const numbers = fields.map((field) => dayNumber(entry[field] as string));
  if (fields.length === 0) return props;
  const shift = Math.max(
    FIRST_DAY - Math.min(...numbers),
    Math.min(LAST_DAY - Math.max(...numbers), days),
  );
  if (shift === 0) return props;
  const moved = { ...entry };
  fields.forEach((field, at) => {
    moved[field] = dateOfDay((numbers[at] as number) + shift);
  });
  return withEntry(props, index, Object.freeze(moved));
};

/**
 * The props with the entry in lane `laneId`. The same props, by identity, for an entry or a lane
 * the item does not hold, or an entry already there.
 */
export const moveToLane = (
  props: TimelineProps,
  entryId: string,
  laneId: string,
): TimelineProps => {
  const index = props.entries.findIndex(({ id }) => id === entryId);
  const entry = props.entries[index];
  const holds = props.lanes.some(({ id }) => id === laneId);
  if (entry === undefined || !holds || entry.lane === laneId) return props;
  return withEntry(props, index, Object.freeze({ ...entry, lane: laneId }));
};

/**
 * What a drop makes of a drag's travel at `zoom`: a click for a travel under the threshold in both
 * directions; else the horizontal travel snapped to the nearest whole day (halves away from zero;
 * none while it is itself under the threshold, so a vertical drag moves no days) and the lane
 * under the pointer, `undefined` over none, which leaves the entry's own.
 */
export const dropOf = (
  drag: { readonly dx: number; readonly dy: number; readonly laneAt: string | undefined },
  zoom: Zoom,
): Drop => {
  const across = Math.abs(drag.dx);
  if (across < TIMELINE_DRAG_THRESHOLD && Math.abs(drag.dy) < TIMELINE_DRAG_THRESHOLD) {
    return Object.freeze({ kind: "click" });
  }
  const whole = across < TIMELINE_DRAG_THRESHOLD ? 0 : Math.round(across / PIXELS_PER_DAY[zoom]);
  const days = (drag.dx < 0 ? -whole : whole) || 0;
  return Object.freeze({ kind: "move", days, lane: drag.laneAt });
};

/** The days "Move earlier" and "Move later" take: one at day zoom, a week at the others. */
export const stepOf = (zoom: Zoom): number => (zoom === "day" ? 1 : 7);

/** The IDs of the entries whose lane or days differ from the props as sent, in `entries` order. */
export const movedOf = (sent: TimelineProps, shown: TimelineProps): readonly string[] => {
  const was = new Map(sent.entries.map((entry) => [entry.id, entry]));
  return shown.entries
    .filter((entry) => MOVE_FIELDS.some((field) => was.get(entry.id)?.[field] !== entry[field]))
    .map(({ id }) => id);
};

/**
 * What the draft holds for the item: `edited`, or nothing while no entry differs from `sent` in
 * its lane or days, so that moving every entry back leaves no value and no change.
 */
export const valueFor = (sent: TimelineProps, edited: TimelineProps): TimelineProps | undefined =>
  movedOf(sent, edited).length === 0 ? undefined : edited;

/**
 * The entries in the order the keyboard walks them: by lane in the item's order, then by first day,
 * then by place in `entries`; an entry in no lane of the item last, one with no day after its
 * lane's dated ones.
 */
export const orderOf = (props: TimelineProps): readonly string[] => {
  const lanes = props.lanes.map(({ id }) => id);
  const laneOf = (entry: TimelineEntry): number => {
    const at = lanes.indexOf(entry.lane);
    return at === -1 ? lanes.length : at;
  };
  // Full-dates of four-digit years sort in the order of their days; "￿" sorts after them.
  const startOf = (entry: TimelineEntry): string => entry.date ?? entry.start ?? "￿";
  return props.entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byLane = laneOf(a.entry) - laneOf(b.entry);
      if (byLane !== 0) return byLane;
      const a0 = startOf(a.entry);
      const b0 = startOf(b.entry);
      return a0 === b0 ? a.index - b.index : a0 < b0 ? -1 : 1;
    })
    .map(({ entry }) => entry.id);
};

/**
 * The entry a key makes current: Up and Down the previous and the next of `order`, Home and End the
 * first and last; at an end of the order, the current entry itself; for one the order does not
 * hold, nothing.
 */
export const neighbour = (
  order: readonly string[],
  current: string,
  key: "up" | "down" | "home" | "end",
): string | undefined => {
  const at = order.indexOf(current);
  if (at === -1) return undefined;
  const target = { up: at - 1, down: at + 1, home: 0, end: order.length - 1 }[key];
  return order[Math.max(0, Math.min(order.length - 1, target))];
};
