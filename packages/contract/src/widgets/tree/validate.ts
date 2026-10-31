// The Tree's validators (design decision 2): each the widget validator of its schema, then the
// Tree's checks, returning E1's `Checked`. No Ajv and no error mapping of their own. Each widget
// validator is made on the first call, not at import: `src/validate.ts` re-exports this module and
// `../validator.ts` imports from it, and the cycle is safe only while no module of it makes a call
// at its top level.

import type { Change } from "../../schemas/output/index.ts";
import type { Checked } from "../../validate.ts";
import { widgetValidator } from "../validator.ts";
import { treeChangesProblems, treePropsProblems } from "./checks.ts";
import type { TreeOrigin, TreeProps } from "./index.ts";
import treeChanges from "./tree-changes.json" with { type: "json" };
import treeProps from "./tree-props.json" with { type: "json" };

let propsSchema: ((value: unknown) => Checked<TreeProps>) | undefined;
let changesSchema: ((value: unknown) => Checked<readonly Change[]>) | undefined;

/** Validates a Tree's props as the agent sent them or as the user edited them (`origin`). */
export const validateTreeProps = (value: unknown, origin: TreeOrigin): Checked<TreeProps> => {
  propsSchema ??= widgetValidator<TreeProps>([treeProps], treeProps.$id);
  const checked = propsSchema(value);
  if (!checked.ok) return checked;
  const problems = treePropsProblems(checked.value, origin);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};

/** Validates the changes of the Tree `itemId`, whose props were sent as `props` (AD-20). */
export const validateTreeChanges = (
  itemId: string,
  value: unknown,
  props: TreeProps,
): Checked<readonly Change[]> => {
  changesSchema ??= widgetValidator<readonly Change[]>([treeChanges], treeChanges.$id);
  const checked = changesSchema(value);
  if (!checked.ok) return checked;
  const problems = treeChangesProblems(itemId, checked.value, props);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};
