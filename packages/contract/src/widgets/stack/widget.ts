// The Stack's registry entry (layouts, design decisions 1 and 3): its schema, wording, example and
// teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module
// (the registry's import rule). A Stack gives no result, edits nothing and derives nothing; its
// schema says all of its rules, so it has no check of its own.

import type { WidgetType } from "../registry.ts";
import { noPropsProblems } from "../shared/layouts.ts";
import stackProps from "./stack-props.json" with { type: "json" };
import { STACK_EXPECTED, STACK_FIELDS } from "./wording.ts";

export const STACK_WIDGET: WidgetType = {
  type: "stack",
  noun: "a Stack",
  props: stackProps,
  propsProblems: noPropsProblems,
  wording: { expected: STACK_EXPECTED, fields: STACK_FIELDS },
  example: {
    item: {
      type: "stack",
      id: "arrange-stack",
      props: {
        items: [
          { type: "text", id: "arrange-stack-note", props: { text: "Fill in both fields." } },
          { type: "text-field", id: "arrange-stack-name", props: { label: "Name" } },
        ],
      },
    },
  },
  skill: {
    use: "items one under another in a column, as one block of a question",
    notes: [
      "`items` hold atoms, widgets and other layouts, never excerpts, references, images or molecule references.",
    ],
  },
};
