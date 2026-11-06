// The Gantt's validators (design decision 2): its schema, through the contract's shared validator,
// since the schema sets list it (widget-answers, design decision 3), then its checks. Nothing
// happens when this module loads: `src/validate.ts` re-exports it, and the cycle is safe while no
// module of it makes a call at its top level.

import { SCHEMA_IDS } from "../../sets.ts";
import { type Checked, type Problem, validateAgainst } from "../../validate.ts";
import { type GanttOrigin, ganttChangesProblems, ganttPropsProblems } from "./checks.ts";
import type { GanttChange, GanttProps } from "./index.ts";

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
  const checked = validateAgainst<GanttProps>(SCHEMA_IDS.ganttProps, value);
  return together(checked, ganttPropsProblems(value, origin));
};

/** A Gantt's changes, against its props as sent or as edited. */
export const validateGanttChanges = (
  itemId: string,
  value: unknown,
  ganttProps: unknown,
): Checked<readonly GanttChange[]> => {
  const checked = validateAgainst<readonly GanttChange[]>(SCHEMA_IDS.ganttChanges, value);
  return together(checked, ganttChangesProblems(itemId, value, ganttProps));
};
