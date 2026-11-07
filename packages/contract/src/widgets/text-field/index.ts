// The TextField (FR-13, atoms): a label and a free text, whose result is the text. Its schemas are
// standalone: they belong to no schema set until the entry is registered (design decision 10), and
// nothing compiles them when this module loads.

export {
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
} from "./checks.ts";
export {
  TEXT_FIELD_MAX_CHARS,
  TEXT_FIELD_SCHEMA_IDS,
  type TextFieldItem,
  type TextFieldProps,
  type TextFieldResult,
} from "./constants.ts";
export { TEXT_FIELD_WIDGET } from "./widget.ts";
