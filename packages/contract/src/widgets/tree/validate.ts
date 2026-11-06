// The Tree's validators (design decision 2): each the contract's shared validation of its schema,
// a set part since widget-answers (design decision 3), then the Tree's checks, returning E1's
// `Checked`. No Ajv and no error mapping of their own. Nothing is called at import: `src/validate.ts`
// re-exports this module, and the cycle is safe only while no module of it makes a call at its top
// level.

import type { Change } from "../../schemas/output/index.ts";
import { SCHEMA_IDS } from "../../sets.ts";
import { type Checked, validateAgainst } from "../../validate.ts";
import { treeChangesProblems, treePropsProblems } from "./checks.ts";
import type { TreeOrigin, TreeProps } from "./index.ts";

/** Validates a Tree's props as the agent sent them or as the user edited them (`origin`). */
export const validateTreeProps = (value: unknown, origin: TreeOrigin): Checked<TreeProps> => {
  const checked = validateAgainst<TreeProps>(SCHEMA_IDS.treeProps, value);
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
  const checked = validateAgainst<readonly Change[]>(SCHEMA_IDS.treeChanges, value);
  if (!checked.ok) return checked;
  const problems = treeChangesProblems(itemId, checked.value, props);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};
