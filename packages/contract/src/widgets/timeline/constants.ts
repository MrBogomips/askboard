// The Timeline's constants and types (latex-kanban-timeline, design decision 5): the limits of its
// props, the schemas' IDs, its element shape and the shapes of an item and a change. Each frozen
// constant is marked pure, so that a view chunk drops those it does not use.

import type { ElementShape } from "../element-diff.ts";

export const TIMELINE_MIN_LANES = 1;
export const TIMELINE_MAX_LANES = 20;
export const TIMELINE_MIN_ENTRIES = 1;
export const TIMELINE_MAX_ENTRIES = 200;
export const TIMELINE_LANE_LABEL_MAX_CHARS = 60;
export const TIMELINE_ENTRY_LABEL_MAX_CHARS = 200;

export const TIMELINE_SCHEMA_IDS = /* @__PURE__ */ Object.freeze({
  props: "urn:askboard:input:timeline-props",
  changes: "urn:askboard:output:timeline-changes",
} as const);

/**
 * The Timeline's shape for the one generic diff (AD-20): its entries as a flat list, so that a
 * moved entry is `set`s of its `lane`, `date`, `start` and `end`. The lanes are no elements.
 */
export const TIMELINE_SHAPE: ElementShape = /* @__PURE__ */ Object.freeze({ elements: "entries" });

export type TimelineLane = { readonly id: string; readonly label: string };

/**
 * An entry: a milestone holds `date` alone, a range `start` and `end` (inclusive, on or after
 * `start`), each an RFC 3339 full-date.
 */
export type TimelineEntry = {
  readonly id: string;
  readonly label: string;
  /** The ID of the lane the entry is in. */
  readonly lane: string;
  readonly date?: string;
  readonly start?: string;
  readonly end?: string;
};

export type TimelineProps = {
  readonly lanes: readonly TimelineLane[];
  readonly entries: readonly TimelineEntry[];
};

export type TimelineItem = {
  readonly type: "timeline";
  readonly id: string;
  readonly props: TimelineProps;
};

/** The fields of an entry a change may set. */
export type TimelineChangeField = "lane" | "date" | "start" | "end";

/** A Timeline's only changes: an entry's lane, or one of its dates. */
export type TimelineChange = {
  readonly op: "set";
  /** `<item>.<entry>.lane`, `.date`, `.start` or `.end`. */
  readonly target: string;
  /** The ID of a lane for `lane`, a full-date for the others. */
  readonly value: string;
};
