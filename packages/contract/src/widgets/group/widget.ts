// The Group's registry entry (layouts, design decisions 1 and 3): its schema, wording, example and
// teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module
// (the registry's import rule). A Group gives no result, edits nothing and derives nothing; its
// schema says all of its rules, so it has no check of its own.

import type { WidgetType } from "../registry.ts";
import { noPropsProblems } from "../shared/layouts.ts";
import groupProps from "./group-props.json" with { type: "json" };
import { GROUP_EXPECTED, GROUP_FIELDS } from "./wording.ts";

export const GROUP_WIDGET: WidgetType = {
  type: "group",
  noun: "a Group",
  props: groupProps,
  propsProblems: noPropsProblems,
  wording: { expected: GROUP_EXPECTED, fields: GROUP_FIELDS },
  example: {
    item: {
      type: "group",
      id: "arrange-group",
      props: {
        title: "Contact",
        description: "How we reach you about this request.",
        items: [{ type: "text-field", id: "arrange-group-phone", props: { label: "Phone" } }],
      },
    },
  },
  help: {
    mouse: "It frames related items under a title: use the items inside it.",
    answer: "Nothing of its own: each item in the group gives its own answer.",
  },
  skill: {
    use: "a titled box around related items, read as one group",
    notes: [
      "`title` names the group for the user and for assistive technology; `description` is optional. `items` hold atoms, widgets and other layouts.",
    ],
  },
};
