// How a request's wording reads a Gantt's props (widget-answers, design decision 4; widget-registry,
// design decision 5): the expected shape and the field list of each of its objects, keyed
// `gantt.props.tasks[].duration`, how a plan's task map folds into such a key, which task a path is
// in, and the schema errors of `tasks` cleared of the choice between its two forms. Moved here from
// `widgets/wording.ts`, `widgets/paths.ts` and `widgets/request-problems.ts`, word for word; a plan's
// task entry is worded with the `duration` widget-editing-plus gave it.
// Nothing here validates.

import type { ErrorObject } from "ajv/dist/2020";
import { isRecord, type Segments, segmentsOf } from "../../problems.ts";
import { ID_SHAPE, isIndex, text } from "../wording-parts.ts";
import {
  GANTT_LABEL_MAX_CHARS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
} from "./index.ts";

const DAY = "a day YYYY-MM-DD";
const TASK_ID = `${ID_SHAPE}, the ID of a task`;
const PREDECESSORS = `a list of at most ${GANTT_MAX_PREDECESSORS} task IDs, each once: the task's finish-to-start predecessors`;
const DURATION = `a whole number of working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION}`;

export const GANTT_EXPECTED: Readonly<Record<string, string>> = {
  "gantt.props": "a Gantt's props {start, tasks, workPackages?}",
  "gantt.props.start": `${DAY}: the day the plan starts`,
  "gantt.props.workPackages": "the ID of the Tree of the same question whose leaves are the tasks",
  "gantt.props.tasks": `a list of at most ${GANTT_MAX_TASKS} tasks {id, label, duration, start?, dependencies?}, or with workPackages a map from task ID to {duration?, start?, dependencies?}`,
  "gantt.props.tasks[]": "a task {id, label, duration, start?, dependencies?}",
  "gantt.props.tasks[].id": `${TASK_ID}, unique in the Gantt`,
  "gantt.props.tasks[].label": text(GANTT_LABEL_MAX_CHARS),
  "gantt.props.tasks[].duration": DURATION,
  "gantt.props.tasks[].start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks[].dependencies": PREDECESSORS,
  "gantt.props.tasks[].dependencies[]": TASK_ID,
  "gantt.props.tasks.{task}": "what the plan says of the task {duration?, start?, dependencies?}",
  "gantt.props.tasks.{task}.duration": `${DURATION}, which wins over the one the Tree's estimates give`,
  "gantt.props.tasks.{task}.start": `${DAY}: the day on or after which the task starts`,
  "gantt.props.tasks.{task}.dependencies": PREDECESSORS,
  "gantt.props.tasks.{task}.dependencies[]": TASK_ID,
};

export const GANTT_FIELDS: Readonly<Record<string, string>> = {
  "gantt.props": "a Gantt's props hold only start, workPackages and tasks",
  "gantt.props.tasks[]": "a task holds only id, label, duration, start and dependencies",
  "gantt.props.tasks.{task}": "a plan's task holds only duration, start and dependencies",
};

/** A map key of a plan's tasks is `{task}`. */
export const ganttRest = (rest: Segments): Segments =>
  rest[1] === "tasks" && rest.length > 2 && !isIndex(rest[2])
    ? [rest[0] as string, "tasks", "{task}", ...rest.slice(3)]
    : rest;

/** The task a path from a Gantt item is in, worded `task "t1"`, when it has an ID. */
export const ganttElementOf = (item: unknown, rest: Segments): string | undefined => {
  if (!isRecord(item) || rest[1] !== "tasks") return undefined;
  if (!isIndex(rest[2])) return `task "${rest[2]}"`;
  const tasks = isRecord(item.props) ? item.props.tasks : undefined;
  const task: unknown = Array.isArray(tasks) ? tasks[Number(rest[2])] : undefined;
  return isRecord(task) && typeof task.id === "string" ? `task "${task.id}"` : undefined;
};

const valueAt = (value: unknown, segments: Segments): unknown =>
  segments.reduce<unknown>(
    (node, segment) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[segment]
        : undefined,
    value,
  );

const TASKS = "/props/tasks";

/**
 * The schema errors of a request, with those of a Gantt's `tasks` cleared of the choice between
 * its two forms: `tasks` is a list or a map by task ID, so that an `anyOf` error and the `type`
 * error of the form it is not would hide what is wrong with the form it is. A list or a map keeps
 * its own errors; any other value keeps the `anyOf` error alone.
 */
export const ganttSchemaErrors = (
  errors: readonly ErrorObject[],
  value: unknown,
): readonly ErrorObject[] =>
  errors.filter((error) => {
    const { instancePath, keyword } = error;
    if (!instancePath.endsWith(TASKS) || (keyword !== "anyOf" && keyword !== "type")) return true;
    const item = valueAt(value, segmentsOf(instancePath.slice(0, -TASKS.length)));
    if (
      typeof item !== "object" ||
      item === null ||
      (item as { type?: unknown }).type !== "gantt"
    ) {
      return true;
    }
    const tasks = valueAt(item, ["props", "tasks"]);
    return keyword === "anyOf" && (typeof tasks !== "object" || tasks === null);
  });
