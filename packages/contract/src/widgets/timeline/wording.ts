// How a request's wording reads a Timeline's props (latex-kanban-timeline, design decision 5): the
// expected shape and the field list of each of its objects, keyed `timeline.props.entries[].start`,
// and which element a path is in. Nothing here validates.

import { isRecord, type Segments } from "../../problems.ts";
import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  TIMELINE_ENTRY_LABEL_MAX_CHARS,
  TIMELINE_LANE_LABEL_MAX_CHARS,
  TIMELINE_MAX_ENTRIES,
  TIMELINE_MAX_LANES,
  TIMELINE_MIN_ENTRIES,
  TIMELINE_MIN_LANES,
} from "./constants.ts";

const DAY = `a day as YYYY-MM-DD, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;

export const TIMELINE_EXPECTED: Readonly<Record<string, string>> = {
  "timeline.props": "a Timeline's props {lanes, entries}",
  "timeline.props.lanes": `a list of ${TIMELINE_MIN_LANES} to ${TIMELINE_MAX_LANES} lanes, each {id, label}`,
  "timeline.props.lanes[]": "a lane {id, label}",
  "timeline.props.lanes[].id": `${ID_SHAPE}, unique among the Timeline's lanes and entries`,
  "timeline.props.lanes[].label": text(TIMELINE_LANE_LABEL_MAX_CHARS),
  "timeline.props.entries": `a list of ${TIMELINE_MIN_ENTRIES} to ${TIMELINE_MAX_ENTRIES} entries, each {id, label, lane, date} for a milestone or {id, label, lane, start, end} for a range`,
  "timeline.props.entries[]":
    "an entry {id, label, lane, date} or {id, label, lane, start, end}: date alone, or start and end",
  "timeline.props.entries[].id": `${ID_SHAPE}, unique among the Timeline's lanes and entries`,
  "timeline.props.entries[].label": text(TIMELINE_ENTRY_LABEL_MAX_CHARS),
  "timeline.props.entries[].lane": `${ID_SHAPE}, the ID of one of the Timeline's lanes`,
  "timeline.props.entries[].date": `${DAY}, a milestone's day`,
  "timeline.props.entries[].start": `${DAY}, a range's first day`,
  "timeline.props.entries[].end": `${DAY}, a range's last day, inclusive, on or after start`,
};

export const TIMELINE_FIELDS: Readonly<Record<string, string>> = {
  "timeline.props": "a Timeline's props hold only lanes and entries",
  "timeline.props.lanes[]": "a lane holds only id and label",
  "timeline.props.entries[]": "an entry holds only id, label, lane, date, start and end",
};

/** The lane or entry a path from a Timeline item is in, by its ID, worded `entry "checkout"`. */
export const timelineElementOf = (item: unknown, rest: Segments): string | undefined => {
  const key = rest[1];
  if (!isRecord(item) || (key !== "entries" && key !== "lanes") || !isIndex(rest[2])) {
    return undefined;
  }
  const list = isRecord(item.props) ? item.props[key] : undefined;
  const element: unknown = Array.isArray(list) ? list[Number(rest[2])] : undefined;
  const id = isRecord(element) ? element.id : undefined;
  return typeof id === "string" ? `${key === "entries" ? "entry" : "lane"} "${id}"` : undefined;
};
