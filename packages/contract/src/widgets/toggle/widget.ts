// The Toggle's registry entry (atoms, design decisions 1 and 10): its schemas, checks, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A Toggle edits nothing and derives nothing: it
// gives a result, on or off, and an untouched Toggle gives none.

import type { WidgetType } from "../registry.ts";
import { toggleFieldCheck, togglePropsProblems, toggleResultShape } from "./checks.ts";
import toggleProps from "./toggle-props.json" with { type: "json" };
import toggleResult from "./toggle-result.json" with { type: "json" };
import { TOGGLE_EXPECTED, TOGGLE_FIELDS } from "./wording.ts";

export const TOGGLE_WIDGET: WidgetType = {
  type: "toggle",
  noun: "a Toggle",
  props: toggleProps,
  propsProblems: togglePropsProblems,
  fieldCheck: toggleFieldCheck,
  result: { schema: toggleResult, shape: toggleResultShape },
  wording: { expected: TOGGLE_EXPECTED, fields: TOGGLE_FIELDS },
  example: {
    item: {
      type: "toggle",
      id: "notify",
      props: { label: "Notify me when it ships" },
    },
  },
  help: {
    mouse: "Click it to switch it on or off; Clear takes your choice back.",
    answer:
      "The agent receives on or off. Off is an answer; a switch you did not touch gives none.",
  },
  skill: {
    use: "an on or off choice the user sets, such as a switch or a yes or no",
    notes: [
      "The result is `true` or `false`; `false` is an answer. A Toggle the user leaves untouched gives no result.",
    ],
  },
};
