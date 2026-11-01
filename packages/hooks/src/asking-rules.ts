// The asking rules' predicates (AD-16, FR-30): one per rule of the contract's closed set, over an
// AskUserQuestion input, implemented here once; the skills' texts come from `contract` (AD-6).
// true sends the question to AskBoard.

import { ASKING_RULES, type AskingRule } from "@askboard/contract";

const PREDICATES: Readonly<Record<AskingRule, (input: unknown) => boolean>> = {
  none: () => false,
  always: () => true,
  "with-references": () => {
    throw new Error(
      "the asking rule with-references has no predicate until configuration defines it",
    );
  },
};

/**
 * Whether `rule` sends an AskUserQuestion call with this input to AskBoard. A rule outside the
 * closed set is refused as unknown; `with-references` throws until its predicate exists, and
 * nothing can select it before then.
 */
export const sendsToAskBoard = (rule: string, input: unknown): boolean => {
  if (!Object.hasOwn(PREDICATES, rule)) {
    throw new Error(
      `unknown asking rule ${JSON.stringify(rule)}: the rules are ${ASKING_RULES.join(", ")}`,
    );
  }
  return PREDICATES[rule as AskingRule](input);
};
