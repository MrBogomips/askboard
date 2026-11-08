// The TextField's registry entry (atoms, design decisions 1 and 10): its schemas, checks, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A TextField edits nothing and derives nothing:
// it gives a result, the text.

import type { WidgetType } from "../registry.ts";
import { PATTERN_MAX_REPEATS, PATTERN_TEXT_MAX_CHARS } from "../shared/pattern.ts";
import {
  textFieldFieldCheck,
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
} from "./checks.ts";
import textFieldProps from "./text-field-props.json" with { type: "json" };
import textFieldResult from "./text-field-result.json" with { type: "json" };
import { TEXT_FIELD_EXPECTED, TEXT_FIELD_FIELDS } from "./wording.ts";

export const TEXT_FIELD_WIDGET: WidgetType = {
  type: "text-field",
  noun: "a TextField",
  props: textFieldProps,
  propsProblems: textFieldPropsProblems,
  fieldCheck: textFieldFieldCheck,
  result: {
    schema: textFieldResult,
    shape: textFieldResultShape,
    problems: textFieldResultProblems,
  },
  wording: { expected: TEXT_FIELD_EXPECTED, fields: TEXT_FIELD_FIELDS },
  example: {
    item: {
      type: "text-field",
      id: "reviewer",
      props: {
        label: "Reviewer's name",
        description: "As it should appear in the log.",
        maxLength: 80,
      },
    },
  },
  skill: {
    use: "a short or long free text the user types, such as a name or a comment",
    notes: [
      "`multiline` allows line breaks; `maxLength` (up to 10,000 characters) caps the text. The result is the text itself, and an empty field gives none.",
      "`minLength` sets the fewest characters; `required` makes an answer wait for a value. `pattern` must be matched by the text, unanchored; a field with a `pattern` holds at most " +
        String(PATTERN_TEXT_MAX_CHARS) +
        " characters.",
      "A `pattern` is a regular expression with no backreference, lookaround or repeated group holding a quantifier or a `|`, and at most " +
        String(PATTERN_MAX_REPEATS) +
        " repetitions: each `?`, `*`, `+`, `{n,}`, `{n,m}`, group holding a `|` and a missing leading `^` counts one.",
    ],
  },
};
