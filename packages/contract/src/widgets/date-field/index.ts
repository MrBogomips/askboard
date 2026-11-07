// The DateField (FR-13, atoms): a label and a calendar day typed in the ask's locale or picked,
// whose result is a full-date. Its schemas are standalone: they belong to no schema set until the
// entry is registered (design decision 10), and nothing compiles them when this module loads.

export {
  dateFieldPropsProblems,
  dateFieldResultProblems,
  dateFieldResultShape,
} from "./checks.ts";
export {
  DATE_FIELD_SCHEMA_IDS,
  type DateFieldItem,
  type DateFieldProps,
  type DateFieldResult,
} from "./constants.ts";
export { DATE_FIELD_WIDGET } from "./widget.ts";
