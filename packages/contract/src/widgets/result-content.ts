// One definition of "a result that holds nothing" (widget-registry, X-9 to X-11 review): a result
// holds nothing when it is `null`, `""`, or an object or array whose every value holds nothing, at
// any depth. `false`, `0` and any other string or number are content. Core's answer check, the
// registry's `result-empty` rule and the board page share it. Pure: no Ajv, no DOM; iterative, so
// no depth can exhaust the stack.

import { isRecord } from "../problems.ts";

/** Whether `value` holds nothing the user gave: see the header of this module. */
export const resultHoldsNothing = (value: unknown): boolean => {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const next = stack.pop();
    if (Array.isArray(next) || isRecord(next)) {
      for (const child of Object.values(next)) stack.push(child);
    } else if (next !== null && next !== "") return false;
  }
  return true;
};
