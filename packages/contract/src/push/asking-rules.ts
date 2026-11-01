// The asking rules (AD-16, FR-30; open question 1): which of an agent's AskUserQuestion calls
// AskBoard takes instead. The set is closed; the rule in effect comes from configuration (E8), and
// until the session process reads it, the rule is `none`. Each rule's predicate is implemented
// once, in `hooks` (AD-16).

/** The closed set, in AD-16's order. */
export const ASKING_RULES = ["none", "always", "with-references"] as const;

export type AskingRule = (typeof ASKING_RULES)[number];
