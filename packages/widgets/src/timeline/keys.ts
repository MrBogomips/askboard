// The Timeline at the keyboard (view-and-widgets spec: Timeline at the keyboard; design decision
// 10): Up, Down, Home and End move the current entry and never an entry; "Move earlier" and "Move
// later" act while the entry has a day to go to, "Move to lane…" while there is another lane, and
// none while the Timeline is read-only or no entry is current. Pure.

import type { TimelineProps } from "@askboard/contract";
import type { Zoom } from "../shared/time/scale.ts";
import { moveBy, stepOf } from "./model.ts";

type EntryKey = "up" | "down" | "home" | "end";

const KEYS: Readonly<Record<string, EntryKey>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "home",
  End: "end",
};

/** The key as the model takes it, or none for any other key. */
export const timelineKeyOf = (key: string): EntryKey | undefined =>
  Object.hasOwn(KEYS, key) ? KEYS[key] : undefined;

/** The tools of the toolbar, each enabled or not. */
export type TimelineTools = {
  readonly earlier: boolean;
  readonly later: boolean;
  readonly lane: boolean;
};

const OFF: TimelineTools = { earlier: false, later: false, lane: false };

/**
 * Which tools act for `current` at `zoom`: a day move acts while the step moves the entry at all
 * (it stops at the Gantt's first and last days), the lane menu while the item has another lane.
 */
export const timelineTools = (
  props: TimelineProps,
  current: string | undefined,
  disabled: boolean,
  zoom: Zoom,
): TimelineTools => {
  if (disabled || current === undefined) return OFF;
  if (!props.entries.some(({ id }) => id === current)) return OFF;
  const step = stepOf(zoom);
  return {
    earlier: moveBy(props, current, -step) !== props,
    later: moveBy(props, current, step) !== props,
    lane: props.lanes.length > 1,
  };
};

/** The lanes "Move to lane…" lists: all but the current entry's, in the agent's order. */
export const otherLanes = (
  props: TimelineProps,
  current: string | undefined,
): readonly { readonly id: string; readonly label: string }[] => {
  const own = props.entries.find(({ id }) => id === current)?.lane;
  return own === undefined
    ? []
    : props.lanes.filter(({ id }) => id !== own).map(({ id, label }) => ({ id, label }));
};
