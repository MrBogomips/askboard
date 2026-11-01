// The Gantt's props as its component takes them (design decision 9, AD-10): nothing checked them on
// their way to the view, since the input format does not admit a Gantt yet, so the component checks
// them as the agent's. The view compiles no schema: Ajv compiles with `new Function`, which the
// view's policy forbids, so these guards say in plain code what the props schema says of a Gantt's
// own tasks and of a plan's entries, and the contract's `ganttPropsProblems` adds what no schema
// can, such as which form of `tasks` goes with `workPackages`. A plan's link to its Tree is
// `link.ts`'s. Plain ECMAScript.

import {
  GANTT_LABEL_MAX_CHARS,
  GANTT_MAX_DURATION,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  GANTT_MIN_DURATION,
  type GanttProps,
  ganttPropsProblems,
  ID_PATTERN,
} from "@askboard/contract";

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

// A Gantt's own tasks are a list; a plan's entries, a map by task ID. Which goes with
// `workPackages` is the contract's check.
const tasks: Check = (value) => {
  const count = Array.isArray(value)
    ? value.length
    : isRecord(value)
      ? Object.keys(value).length
      : Number.POSITIVE_INFINITY;
  return count <= GANTT_MAX_TASKS
    ? undefined
    : `is not a list of at most ${GANTT_MAX_TASKS} tasks, nor a map of at most ${GANTT_MAX_TASKS} entries by task ID`;
};

const PROPS: Fields = {
  checks: { start: fullDate, workPackages: id, tasks },
  required: ["start", "tasks"],
};

const TASK: Fields = {
  checks: { id, label, duration, start: fullDate, dependencies: predecessors },
  required: ["id", "label", "duration"],
};

/** A plan's entry: what the plan says of a task its Tree names and orders. */
const ENTRY: Fields = {
  checks: { start: fullDate, dependencies: predecessors },
  required: [],
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

// The path as the contract's checks write it: the key itself, which a task ID needs no escape in.
const entryProblems = ([key, entry]: [string, unknown]): PropsProblem[] => {
  const path = `/tasks/${key}`;
  const problems: PropsProblem[] = isId(key)
    ? []
    : [{ path, message: `is not a task ID (${ID_PATTERN})` }];
  if (isRecord(entry)) return [...problems, ...fieldProblems(entry, path, ENTRY)];
  const message = "is not a plan entry: an object with a requested start and predecessors";
  return [...problems, { path, message }];
};

/** Each element's problems: a Gantt's own tasks by index, a plan's entries by task ID. */
const elementProblems = (tasks: unknown): PropsProblem[] => {
  if (Array.isArray(tasks)) return tasks.flatMap(taskProblems);
  return isRecord(tasks) ? Object.entries(tasks).flatMap(entryProblems) : [];
};

/**
 * Everything wrong with a Gantt's props as the agent's, a Gantt's own tasks or a plan's entries:
 * what the props schema refuses, then the contract's checks. Empty for props the component can
 * render.
 */
export const ganttProblems = (props: unknown): readonly PropsProblem[] => {
  if (!isRecord(props)) return [{ path: "/", message: "the props are not an object" }];
  return [
    ...fieldProblems(props, "", PROPS),
    ...elementProblems(props.tasks),
    ...ganttPropsProblems(props, "agent"),
  ];
};

/** The item's props, once they have no problem; else it throws, naming the item and each one. */
export const ganttPropsOf = (item: {
  readonly id: string;
  readonly props: unknown;
}): GanttProps => {
  const problems = ganttProblems(item.props);
  if (problems.length > 0) {
    const listed = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Gantt "${item.id}" refuses its props: ${listed}`);
  }
  return item.props as GanttProps;
};
