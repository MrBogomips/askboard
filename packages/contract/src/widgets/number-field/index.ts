// The NumberField (FR-13, atoms): a label and a number typed in the ask's locale, whose result is
// a JSON number. Its schemas are standalone: they belong to no schema set until the entry is
// registered (design decision 10), and nothing compiles them when this module loads.

export {
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
} from "./checks.ts";
export {
  NUMBER_FIELD_SCHEMA_IDS,
  NUMBER_FIELD_STEP_MAX,
  type NumberFieldItem,
  type NumberFieldProps,
  type NumberFieldResult,
} from "./constants.ts";
export { NUMBER_FIELD_WIDGET } from "./widget.ts";
