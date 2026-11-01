// What the grid's editors do with what the user types (design decision 8; view spec, "Gantt
// editing in the grid", "Gantt durations"): a start read by the Gantt's own en-US date parser and
// refused when it is no day, not a working day, or before the earliest start its predecessors
// allow; an empty start clears the request, and the earliest start itself holds none, as a drop
// there does, except that the day the agent's own request schedules the task on gives that request
// back; a duration read by the shared number parser and refused unless whole and in range.
// Each gives the Gantt's next value through `edits.ts`, the same value when nothing changes, or
// the reason for its refusal. A start goes into a Gantt's own task or a plan's entry alike; a
// plan's durations follow its Tree's estimates, so a typed one is refused there. Plain
// ECMAScript: the working-day calendar is `compute`'s.

import { firstWorkingDateFrom, isWorkingDate } from "@askboard/compute";
import { GANTT_MAX_DURATION, GANTT_MIN_DURATION, type GanttProps } from "@askboard/contract";
import { numberEcho, parseNumber } from "../../shared/number.ts";
import { echoDate, gridDate, parseDateEntry } from "./date.ts";
import { clearStart, requestStart, setDuration } from "./edits.ts";
import type { TaskSchedule } from "./schedule.ts";
import { type GanttColumn, type GanttRow, isOwnGantt, planEntry } from "./tasks.ts";

/** The columns the grid edits in place; the predecessors open their panel instead. */
export type EditedColumn = Extract<GanttColumn, "start" | "duration">;

export type Entry<V extends GanttProps = GanttProps> =
  | { readonly kind: "value"; readonly value: V }
  | { readonly kind: "refused"; readonly reason: string };

const accepted = <V extends GanttProps>(value: V): Entry<V> => ({ kind: "value", value });

const refused = (reason: string): Entry<never> => ({ kind: "refused", reason });

const WHOLE = `A duration is a whole number of working days, from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION.toLocaleString("en-US")}.`;

const PLAN_DURATION = "A plan's durations follow its work packages' estimates in its Tree.";

/** The start the agent asked for a task, in its own task or in its plan's entry. */
const agentStart = (sent: GanttProps, taskId: string): string | undefined =>
  isOwnGantt(sent)
    ? sent.tasks.find((task) => task.id === taskId)?.start
    : planEntry(sent, taskId)?.start;

/**
 * The day a requested start schedules a task on: the first working day from it, never before the
 * earliest start its predecessors allow.
 */
const scheduledFrom = (requested: string, earliest: string | undefined): string => {
  const working = firstWorkingDateFrom(requested);
  // Full-dates of four-digit years compare as their days do.
  return earliest !== undefined && earliest > working ? earliest : working;
};

/**
 * The task on a day: on the day the agent's own request schedules it, that request, as sent, even
 * when it names a weekend or a day before the earliest start, so that a move undone holds no
 * change; else, on its earliest start, no request; else a request for the day.
 */
export const landOn = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  day: string,
  earliest: string | undefined,
): V => {
  const agent = agentStart(sent, taskId);
  if (agent !== undefined && day === scheduledFrom(agent, earliest)) {
    return requestStart(value, sent, taskId, agent);
  }
  return day === earliest
    ? clearStart(value, sent, taskId)
    : requestStart(value, sent, taskId, day);
};

/** What a typed start does to the task, scheduled as `schedule` says. */
export const startEntry = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  schedule: TaskSchedule | undefined,
  text: string,
): Entry<V> => {
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

/** What a typed duration does to one of a Gantt's own tasks; a plan refuses it. */
export const durationEntry = (
  value: GanttProps,
  sent: GanttProps,
  taskId: string,
  text: string,
): Entry => {
  if (!isOwnGantt(value) || !isOwnGantt(sent)) return refused(PLAN_DURATION);
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
