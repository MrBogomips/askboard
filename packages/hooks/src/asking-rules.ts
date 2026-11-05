// The asking rules' predicates (AD-16, FR-30): one per rule of the contract's closed set, over an
// AskUserQuestion input, implemented here once; the skills' texts come from `contract` (AD-6).
// true sends the question to AskBoard.

import { ASKING_RULES, type AskingRule, hasReference } from "@askboard/contract";

type Fields = Readonly<Record<string, unknown>>;

const QUESTION_FIELDS = ["question", "header"] as const;
const OPTION_FIELDS = ["label", "description", "preview"] as const;

/** The objects of `value` when it is a list; nothing otherwise, so a malformed input reads empty. */
const objectsOf = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.filter((item): item is Fields => typeof item === "object" && item !== null)
    : [];

/** Whether any of `fields` of `object` is text holding a URL or a project-file pointer. */
const refers = (object: Fields, fields: readonly string[]): boolean =>
  fields.some((field) => {
    const text = object[field];
    return typeof text === "string" && hasReference(text);
  });

/**
 * with-references (settings-languages design decision 12): any question's `question` or `header`,
 * or any option's `label`, `description` or `preview`, holds a reference, as the contract defines
 * it. The input is read structurally: what is not a list of objects, or not text, holds none, so a
 * malformed input proceeds.
 */
const withReferences = (input: unknown): boolean => {
  if (typeof input !== "object" || input === null) return false;
  return objectsOf((input as Fields).questions).some(
    (question) =>
      refers(question, QUESTION_FIELDS) ||
      objectsOf(question.options).some((option) => refers(option, OPTION_FIELDS)),
  );
};

const PREDICATES: Readonly<Record<AskingRule, (input: unknown) => boolean>> = {
  none: () => false,
  always: () => true,
  "with-references": withReferences,
};

/**
 * Whether `rule` sends an AskUserQuestion call with this input to AskBoard. A rule outside the
 * closed set is refused as unknown.
 */
export const sendsToAskBoard = (rule: string, input: unknown): boolean => {
  if (!Object.hasOwn(PREDICATES, rule)) {
    throw new Error(
      `unknown asking rule ${JSON.stringify(rule)}: the rules are ${ASKING_RULES.join(", ")}`,
    );
  }
  return PREDICATES[rule as AskingRule](input);
};
