// The Text's registry entry (atoms, design decisions 1 and 10): its schema, check, wording, example
// and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema set module
// (the registry's import rule). A Text gives no result, edits nothing and derives nothing.

import type { WidgetType } from "../registry.ts";
import { textPropsProblems } from "./checks.ts";
import textProps from "./text-props.json" with { type: "json" };
import { TEXT_EXPECTED, TEXT_FIELDS } from "./wording.ts";

export const TEXT_WIDGET: WidgetType = {
  type: "text",
  noun: "a Text",
  props: textProps,
  propsProblems: textPropsProblems,
  wording: { expected: TEXT_EXPECTED, fields: TEXT_FIELDS },
  example: {
    item: {
      type: "text",
      id: "intro",
      props: { text: "The budget below covers **Q3** only.", format: "markdown" },
    },
  },
  skill: {
    use: "a passage of plain text or Markdown the user reads; it gives no answer",
    notes: [
      "`format` is `plain` (the default) or `markdown`. Markdown is shown as data: raw HTML never renders, only http and https links open, and an image shows as a link to its source.",
    ],
  },
};
