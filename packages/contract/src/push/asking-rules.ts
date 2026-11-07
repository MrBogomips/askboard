// The asking rules (AD-16, FR-30; open question 1): which of an agent's AskUserQuestion calls
// AskBoard takes instead. The set is closed; the rule in effect comes from configuration (E8), and
// until the session process reads it, the rule is `none`. Each rule's predicate is implemented
// once, in `hooks` (AD-16). Each rule also has an agent-facing text (askboard-skills, design
// decision 6), which the generated skill writes in the set's order.

import { WITH_REFERENCES_DESCRIPTION } from "./references.ts";

/** The closed set, in AD-16's order. */
export const ASKING_RULES = ["none", "always", "with-references"] as const;

export type AskingRule = (typeof ASKING_RULES)[number];

/**
 * One agent-facing text for each rule of the closed set, in its order, frozen (askboard-skills,
 * design decision 6). `with-references` is the text that describes the hook's predicate.
 */
export const ASKING_RULE_TEXTS: Readonly<Record<AskingRule, string>> = Object.freeze({
  none: "No question is taken from AskUserQuestion: the agent chooses, question by question, where it goes.",
  always: "Every question goes to AskBoard, whatever it holds.",
  "with-references": WITH_REFERENCES_DESCRIPTION,
});
