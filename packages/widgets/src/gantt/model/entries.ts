// What the grid's editors do with what the user types (design decision 8; view spec, "Gantt
// editing in the grid", "Gantt durations"): a start read by the Gantt's own en-US date parser and
// refused when it is no day, not a working day, or before the earliest start its predecessors
// allow; an empty start clears the request, and the earliest start itself holds none, as a drop
// there does; a duration read by the shared number parser and refused unless whole and in range.
// Each gives the Gantt's next value through `edits.ts`, the same value when nothing changes, or
// the reason for its refusal. Plain ECMAScript: the working-day calendar is `compute`'s.

import { isWorkingDate } from "@askboard/compute";
import { GANTT_MAX_DURATION, GANTT_MIN_DURATION } from "@askboard/contract";
import { numberEcho, parseNumber } from "../../shared/number.ts";
import { echoDate, gridDate, parseDateEntry } from "./date.ts";
import { clearStart, requestStart, setDuration } from "./edits.ts";
import type { TaskSchedule } from "./schedule.ts";
import type { GanttColumn, GanttOwnProps, GanttRow } from "./tasks.ts";

/** The columns the grid edits in place; the predecessors open their panel instead. */
export type EditedColumn = Extract<GanttColumn, "start" | "duration">;

export type Entry =
  | { readonly kind: "value"; readonly value: GanttOwnProps }
  | { readonly kind: "refused"; readonly reason: string };

const accepted = (value: GanttOwnProps): Entry => ({ kind: "value", value });

const refused = (reason: string): Entry => ({ kind: "refused", reason });

const WHOLE = `A duration is a whole number of working days, from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION.toLocaleString("en-US")}.`;

/**
 * The task on a day: a request for it, or, on its earliest start, no request, unless the agent
 * itself asked for that day, whose request then comes back, so that a move undone holds no change.
 */
export const landOn = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  day: string,
  earliest: string | undefined,
): GanttOwnProps => {
  if (day !== earliest) return requestStart(value, sent, taskId, day);
  const agent = sent.tasks.find((task) => task.id === taskId)?.start;
  return agent === day ? requestStart(value, sent, taskId, day) : clearStart(value, sent, taskId);
};

/** What a typed start does to the task, scheduled as `schedule` says. */
export const startEntry = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  schedule: TaskSchedule | undefined,
  text: string,
): Entry => {
  const parsed = parseDateEntry(text);
  if (parsed.kind === "refused") return refused(parsed.reason);
  if (parsed.kind === "empty") return accepted(clearStart(value, sent, taskId));
  const day = parsed.date;
  if (!isWorkingDate(day)) {
    return refused(`${gridDate(day)} is not a working day: pick a day from Monday to Friday.`);
  }
  if (schedule?.kind !== "scheduled") return accepted(requestStart(value, sent, taskId, day));
  // Full-dates of four-digit years compare as their days do.
  if (day < schedule.earliestDate) {
    return refused(
      `The earliest start its predecessors allow is ${gridDate(schedule.earliestDate)}.`,
    );
  }
  if (day === schedule.startDate) return accepted(value);
  return accepted(landOn(value, sent, taskId, day, schedule.earliestDate));
};

/** What a typed duration does to the task. */
export const durationEntry = (
  value: GanttOwnProps,
  sent: GanttOwnProps,
  taskId: string,
  text: string,
): Entry => {
  const parsed = parseNumber(text);
  if (parsed.kind === "refused") return refused(parsed.reason);
  if (parsed.kind === "empty") return refused(WHOLE);
  const days = parsed.value;
  if (!Number.isInteger(days) || days < GANTT_MIN_DURATION || days > GANTT_MAX_DURATION) {
    return refused(WHOLE);
  }
  return accepted(setDuration(value, sent, taskId, days));
};

/** The text an editor opens with: the start the grid shows, or the duration. */
export const entryText = (
  column: EditedColumn,
  row: GanttRow,
  schedule: TaskSchedule | undefined,
): string => {
  if (column === "duration") return row.duration === undefined ? "" : String(row.duration);
  if (schedule?.kind === "scheduled") return gridDate(schedule.startDate);
  return row.start === undefined ? "" : gridDate(row.start);
};

/** The echo beside an editor: the day or the number it reads, or nothing. */
export const entryEcho = (column: EditedColumn, text: string): string | undefined => {
  if (column === "start") {
    const parsed = parseDateEntry(text);
    return parsed.kind === "date" ? echoDate(parsed.date) : undefined;
  }
  const parsed = parseNumber(text);
  return parsed.kind === "number" ? numberEcho(parsed.value) : undefined;
};
