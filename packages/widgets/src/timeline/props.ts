// A Timeline's props as the component takes them (design decision 10): the view hands props over
// as data, unchecked, so the shape the schema would give is checked here, then the contract's own
// check of what a schema cannot say. A problem throws, naming the item; the item's error boundary
// then fails it and its question never counts as visible (AD-10). The value the draft holds is
// shown only while it is the agent's Timeline with entries moved.

import {
  TIMELINE_MAX_ENTRIES,
  TIMELINE_MAX_LANES,
  TIMELINE_MIN_ENTRIES,
  TIMELINE_MIN_LANES,
  type TimelineProps,
  timelinePropsProblems,
} from "@askboard/contract";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const laneProblem = (lane: unknown, at: number): string | undefined => {
  if (!isRecord(lane)) return `lane ${at + 1} is no object`;
  if (typeof lane.id !== "string") return `lane ${at + 1} has no string ID`;
  if (typeof lane.label !== "string") return `lane ${at + 1} has no string label`;
  return undefined;
};

const entryProblem = (entry: unknown, at: number): string | undefined => {
  if (!isRecord(entry)) return `entry ${at + 1} is no object`;
  if (typeof entry.id !== "string") return `entry ${at + 1} has no string ID`;
  if (typeof entry.label !== "string") return `entry ${at + 1} has no string label`;
  if (typeof entry.lane !== "string") return `entry ${at + 1} has no string lane`;
  for (const field of ["date", "start", "end"]) {
    if (entry[field] !== undefined && typeof entry[field] !== "string") {
      return `the ${field} of entry ${at + 1} is no string`;
    }
  }
  return undefined;
};

// What the schema says: 1 to 20 lanes and 1 to 200 entries, each with the fields the board reads.
const shapeProblem = (props: unknown): string | undefined => {
  if (!isRecord(props)) return "its props are no object";
  const { lanes, entries } = props;
  if (!Array.isArray(lanes)) return "its props hold no list of lanes";
  if (!Array.isArray(entries)) return "its props hold no list of entries";
  if (lanes.length < TIMELINE_MIN_LANES || lanes.length > TIMELINE_MAX_LANES) {
    return `a Timeline holds ${TIMELINE_MIN_LANES} to ${TIMELINE_MAX_LANES} lanes, and this one holds ${lanes.length}`;
  }
  if (entries.length < TIMELINE_MIN_ENTRIES || entries.length > TIMELINE_MAX_ENTRIES) {
    return `a Timeline holds ${TIMELINE_MIN_ENTRIES} to ${TIMELINE_MAX_ENTRIES} entries, and this one holds ${entries.length}`;
  }
  return (
    lanes.map(laneProblem).find((problem) => problem !== undefined) ??
    entries.map(entryProblem).find((problem) => problem !== undefined)
  );
};

/** The props as an agent's Timeline, or an error naming the item and the problem. */
export const checkedTimelineProps = (itemId: string, props: unknown): TimelineProps => {
  const shape = shapeProblem(props);
  const problems =
    shape === undefined
      ? timelinePropsProblems(props).map(({ path, message }) => `${path}: ${message}`)
      : [shape];
  if (problems.length === 0) return props as TimelineProps;
  throw new Error(`the Timeline "${itemId}" refuses its props: ${problems.join("; ")}`);
};

// Whether `edited` is the agent's Timeline with entries moved: the same lanes and the same entries,
// each with its own label and kind (a milestone stays one, a range stays one), in the same order.
const sameTimeline = (sent: TimelineProps, edited: TimelineProps): boolean =>
  sent.lanes.length === edited.lanes.length &&
  sent.entries.length === edited.entries.length &&
  sent.lanes.every(
    (lane, at) => lane.id === edited.lanes[at]?.id && lane.label === edited.lanes[at]?.label,
  ) &&
  sent.entries.every((entry, at) => {
    const held = edited.entries[at];
    return (
      held?.id === entry.id &&
      held.label === entry.label &&
      (held.date === undefined) === (entry.date === undefined) &&
      (held.start === undefined) === (entry.start === undefined) &&
      (held.end === undefined) === (entry.end === undefined)
    );
  });

/**
 * The Timeline to show: the value the draft holds, while it is the agent's Timeline with entries
 * moved, else the agent's own. A value that is anything else was never made by this component.
 */
export const shownProps = (itemId: string, sent: TimelineProps, value: unknown): TimelineProps => {
  if (value === undefined) return sent;
  try {
    const edited = checkedTimelineProps(itemId, value);
    return sameTimeline(sent, edited) ? edited : sent;
  } catch {
    return sent;
  }
};
