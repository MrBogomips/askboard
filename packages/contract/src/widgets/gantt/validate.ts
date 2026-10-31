// The Gantt's validators (design decision 2): its schema, through the seams' shared widget
// validator, which compiles it on the first validation, then its checks. Nothing happens when
// this module loads.

import type { AnySchemaObject } from "ajv/dist/2020";
import type { Checked, Problem } from "../../validate.ts";
import { widgetValidator } from "../validator.ts";
import { type GanttOrigin, ganttChangesProblems, ganttPropsProblems } from "./checks.ts";
import {
  GANTT_SCHEMA_IDS,
  type GanttChange,
  type GanttProps,
  ganttChangesSchema,
  ganttPropsSchema,
} from "./index.ts";

const SCHEMAS = [ganttPropsSchema, ganttChangesSchema] as readonly AnySchemaObject[];

let props: ((value: unknown) => Checked<GanttProps>) | undefined;
let changes: ((value: unknown) => Checked<readonly GanttChange[]>) | undefined;

/** The schema's verdict and the checks' problems as one, each problem once. */
const together = <T>(checked: Checked<T>, problems: readonly Problem[]): Checked<T> => {
  if (checked.ok && problems.length === 0) return checked;
  const fromSchema = checked.ok ? [] : checked.problems;
  const seen = new Set(fromSchema.map(({ path, message }) => `${path}\n${message}`));
  const more = problems.filter(({ path, message }) => !seen.has(`${path}\n${message}`));
  return { ok: false, reason: "schema", problems: [...fromSchema, ...more] };
};

/** A Gantt's props, as the agent sent them or as the user edited them. */
export const validateGanttProps = (value: unknown, origin: GanttOrigin): Checked<GanttProps> => {
  props ??= widgetValidator<GanttProps>(SCHEMAS, GANTT_SCHEMA_IDS.props);
  return together(props(value), ganttPropsProblems(value, origin));
};

/** A Gantt's changes, against its props as sent or as edited. */
export const validateGanttChanges = (
  itemId: string,
  value: unknown,
  ganttProps: unknown,
): Checked<readonly GanttChange[]> => {
  changes ??= widgetValidator<readonly GanttChange[]>(SCHEMAS, GANTT_SCHEMA_IDS.changes);
  return together(changes(value), ganttChangesProblems(itemId, value, ganttProps));
};
