// The Timeline (FR-11, latex-kanban-timeline): milestones and date ranges the user moves in time
// and across lanes. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 12), and nothing compiles them when this module loads.

export { timelinePropsProblems } from "./checks.ts";
export {
  TIMELINE_ENTRY_LABEL_MAX_CHARS,
  TIMELINE_LANE_LABEL_MAX_CHARS,
  TIMELINE_MAX_ENTRIES,
  TIMELINE_MAX_LANES,
  TIMELINE_MIN_ENTRIES,
  TIMELINE_MIN_LANES,
  TIMELINE_SCHEMA_IDS,
  TIMELINE_SHAPE,
  type TimelineChange,
  type TimelineChangeField,
  type TimelineEntry,
  type TimelineItem,
  type TimelineLane,
  type TimelineProps,
} from "./constants.ts";
export { TIMELINE_KEYS, type TimelineKeyAction } from "./keys.ts";
export { TIMELINE_WIDGET } from "./widget.ts";
