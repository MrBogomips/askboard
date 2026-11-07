// What the grid's editors do with what the user types (design decision 8; view spec, "Gantt
// editing in the grid", "Gantt durations"): a start read by the contract's date entry in the ask's locale and
// refused when it is no day, not a working day, or before the earliest start its predecessors
// allow; an empty start clears the request, and the earliest start itself holds none, as a drop
// there does, except that the day the agent's own request schedules the task on gives that request
// back; a duration read by the shared number parser and refused unless whole and in range.
// Each gives the Gantt's next value through `edits.ts`, the same value when nothing changes, or
// the reason for its refusal. A start and a duration go into a Gantt's own task or a plan's entry
// alike, a plan's duration being a request. Plain ECMAScript: the working-day calendar is `compute`'s.

import { firstWorkingDateFrom, isWorkingDate } from "@askboard/compute";
import {
  GANTT_MAX_DURATION,
  GANTT_MIN_DURATION,
  type GanttProps,
  type Locale,
} from "@askboard/contract";
import { parseNumber } from "../../shared/number.ts";
import { type DateFormat, gridDate, parseDateEntry } from "../../shared/time/date.ts";
import { clearDuration, clearStart, requestStart, setDuration } from "./edits.ts";
import type { TaskSchedule } from "./schedule.ts";
import { type GanttColumn, type GanttRow, isOwnGantt, planEntry } from "./tasks.ts";

/** The columns the grid edits in place; the predecessors open their panel instead. */
export type EditedColumn = Extract<GanttColumn, "start" | "duration">;

export type Entry<V extends GanttProps = GanttProps> =
  | { readonly kind: "value"; readonly value: V }
  | { readonly kind: "refused"; readonly reason: string };

const accepted = <V extends GanttProps>(value: V): Entry<V> => ({ kind: "value", value });

const refused = (reason: string): Entry<never> => ({ kind: "refused", reason });

const wholeNumber = (format: DateFormat): string =>
  format.text("gantt.entry.whole", {
    min: GANTT_MIN_DURATION,
    max: GANTT_MAX_DURATION.toLocaleString(format.language),
  });

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
  format: DateFormat,
): Entry<V> => {
  const { locale } = format;
  const parsed = parseDateEntry(text, format);
  if (parsed.kind === "refused") return refused(parsed.reason);
  if (parsed.kind === "empty") return accepted(clearStart(value, sent, taskId));
  const day = parsed.date;
  if (!isWorkingDate(day)) {
    return refused(format.text("gantt.entry.notWorking", { date: gridDate(day, locale) }));
  }
  if (schedule?.kind !== "scheduled") return accepted(requestStart(value, sent, taskId, day));
  // Full-dates of four-digit years compare as their days do.
  if (day < schedule.earliestDate) {
    return refused(
      format.text("gantt.entry.earliest", {
        date: gridDate(schedule.earliestDate, locale),
      }),
    );
  }
  if (day === schedule.startDate) return accepted(value);
  return accepted(landOn(value, sent, taskId, day, schedule.earliestDate));
};

/**
 * What a typed duration does to a task: a Gantt's own task takes it as its duration; a plan's
 * entry takes it as a request, cleared when it is the duration the estimates give, which
 * `schedule` holds; an empty field in a plan clears the request (design decision 2).
 */
export const durationEntry = <V extends GanttProps>(
  value: V,
  sent: V,
  taskId: string,
  schedule: TaskSchedule | undefined,
  text: string,
  format: DateFormat,
): Entry<V> => {
  const parsed = parseNumber(text, format.locale, format.language);
  if (parsed.kind === "refused") return refused(parsed.reason);
  if (parsed.kind === "empty") {
    return isOwnGantt(value)
      ? refused(wholeNumber(format))
      : accepted(clearDuration(value, sent, taskId));
  }
  const days = parsed.value;
  if (!Number.isInteger(days) || days < GANTT_MIN_DURATION || days > GANTT_MAX_DURATION) {
    return refused(wholeNumber(format));
  }
  const estimate = schedule?.kind === "scheduled" ? schedule.estimate : undefined;
  return accepted(setDuration(value, sent, taskId, days, estimate));
};

/** The text an editor opens with: the start the grid shows, or the duration. */
export const entryText = (
  column: EditedColumn,
  row: GanttRow,
  schedule: TaskSchedule | undefined,
  locale: Locale = "en-US",
): string => {
  if (column === "duration") {
    const days = row.duration ?? (schedule?.kind === "scheduled" ? schedule.duration : undefined);
    return days === undefined ? "" : String(days);
  }
  if (schedule?.kind === "scheduled") return gridDate(schedule.startDate, locale);
  return row.start === undefined ? "" : gridDate(row.start, locale);
};
