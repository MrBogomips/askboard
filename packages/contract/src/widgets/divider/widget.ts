// The Divider's registry entry (atoms, design decisions 1 and 10): its schema, check, wording,
// example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema
// set module (the registry's import rule). A Divider gives no result, edits nothing and derives
// nothing.

import type { WidgetType } from "../registry.ts";
import { dividerPropsProblems } from "./checks.ts";
import dividerProps from "./divider-props.json" with { type: "json" };
import { DIVIDER_EXPECTED, DIVIDER_FIELDS } from "./wording.ts";

export const DIVIDER_WIDGET: WidgetType = {
  type: "divider",
  noun: "a Divider",
  props: dividerProps,
  propsProblems: dividerPropsProblems,
  wording: { expected: DIVIDER_EXPECTED, fields: DIVIDER_FIELDS },
  example: { item: { type: "divider", id: "rule", props: {} } },
  help: {
    mouse: "It is a line between two items: there is nothing to click or type.",
    answer: "Nothing: a divider gives no answer.",
  },
  skill: { use: "a rule that separates the items of a question; its props are empty" },
};
