// The Gantt's props as its component takes them (design decision 9, AD-10): nothing checked them on
// their way to the view, since the input format does not admit a Gantt yet, so the component checks
// them as the agent's. The view compiles no schema: Ajv compiles with `new Function`, which the
// view's policy forbids, so these guards say in plain code what the props schema says of a Gantt's
// own tasks, and the contract's `ganttPropsProblems` adds what no schema can. A Gantt plan waits
// for task group 7. Plain ECMAScript.

import {
  GANTT_LABEL_MAX_CHARS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
  ganttPropsProblems,
  ID_PATTERN,
} from "@askboard/contract";
import type { GanttOwnProps } from "./tasks.ts";

/** A problem with the props: where, as a JSON Pointer, and what. */
export type PropsProblem = { readonly path: string; readonly message: string };

type Json = Record<string, unknown>;

/** A field's check: undefined when the value is fine, else what is wrong with it. */
type Check = (value: unknown) => string | undefined;

type Fields = {
  readonly checks: Readonly<Record<string, Check>>;
  readonly required: readonly string[];
};

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ID = new RegExp(ID_PATTERN);
// The props schema's `fullDate`; whether the day exists is the contract's check.
const FULL_DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

const isId = (value: unknown): boolean => typeof value === "string" && ID.test(value);

const fullDate: Check = (value) =>
  typeof value === "string" && FULL_DATE.test(value)
    ? undefined
    : "is not a full-date (YYYY-MM-DD)";

const id: Check = (value) => (isId(value) ? undefined : `is not an ID (${ID_PATTERN})`);

// Characters as the schema counts them: code points, not UTF-16 units.
const label: Check = (value) => {
  const length = typeof value === "string" ? [...value].length : 0;
  return length >= 1 && length <= GANTT_LABEL_MAX_CHARS
    ? undefined
    : `is not a text of 1 to ${GANTT_LABEL_MAX_CHARS} characters`;
};

const duration: Check = (value) =>
  Number.isInteger(value) &&
  (value as number) >= GANTT_MIN_DURATION &&
  (value as number) <= GANTT_MAX_DURATION
    ? undefined
    : `is not a whole number of working days from ${GANTT_MIN_DURATION} to ${GANTT_MAX_DURATION.toLocaleString("en-US")}`;

const predecessors: Check = (value) =>
  Array.isArray(value) && value.length <= GANTT_MAX_PREDECESSORS && value.every(isId)
    ? undefined
    : `is not a list of at most ${GANTT_MAX_PREDECESSORS} task IDs`;

const taskList: Check = (value) =>
  Array.isArray(value) && value.length <= GANTT_MAX_TASKS
    ? undefined
    : `is not a list of at most ${GANTT_MAX_TASKS} tasks`;

const NOT_YET: Check = () => "names a Tree, and the view shows no Gantt plan yet";

const PROPS: Fields = {
  checks: { start: fullDate, workPackages: NOT_YET, tasks: taskList },
  required: ["start", "tasks"],
};

const TASK: Fields = {
  checks: { id, label, duration, start: fullDate, dependencies: predecessors },
  required: ["id", "label", "duration"],
};

// An object's fields against a table: unknown and missing fields, then each field's check.
const fieldProblems = (value: Json, path: string, { checks, required }: Fields) => [
  ...Object.keys(value)
    .filter((field) => !Object.hasOwn(checks, field))
    .map((field) => ({ path: `${path}/${field}`, message: `unknown field "${field}"` })),
  ...Object.entries(checks).flatMap(([field, check]): PropsProblem[] => {
    if (!Object.hasOwn(value, field)) {
      return required.includes(field)
        ? [{ path: `${path}/${field}`, message: `missing field "${field}"` }]
        : [];
    }
    const problem = check(value[field]);
    return problem === undefined ? [] : [{ path: `${path}/${field}`, message: problem }];
  }),
];

const taskProblems = (task: unknown, index: number): PropsProblem[] => {
  const path = `/tasks/${index}`;
  return isRecord(task)
    ? fieldProblems(task, path, TASK)
    : [{ path, message: "is not a task: an object with an ID, a name and a duration" }];
};

/**
 * Everything wrong with a Gantt's own tasks as the agent's props: what the props schema refuses,
 * then the contract's checks. Empty for props the component can render.
 */
export const ownGanttProblems = (props: unknown): readonly PropsProblem[] => {
  if (!isRecord(props)) return [{ path: "/", message: "the props are not an object" }];
  const tasks = Array.isArray(props.tasks) ? props.tasks : [];
  return [
    ...fieldProblems(props, "", PROPS),
    ...tasks.flatMap(taskProblems),
    ...ganttPropsProblems(props, "agent"),
  ];
};

/** The item's props, once they have no problem; else it throws, naming the item and each one. */
export const ownGanttOf = (item: {
  readonly id: string;
  readonly props: unknown;
}): GanttOwnProps => {
  const problems = ownGanttProblems(item.props);
  if (problems.length > 0) {
    const listed = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Gantt "${item.id}" refuses its props: ${listed}`);
  }
  return item.props as GanttOwnProps;
};
