// The Value (FR-13, atoms): a figure the agent gives, shown in the ask's locale, which gives no
// answer. Its schema is standalone: it belongs to no schema set until the entry is registered
// (design decision 10), and nothing compiles it when this module loads.

export { valuePropsProblems } from "./checks.ts";
export {
  VALUE_FIELDS,
  VALUE_KIND_FIELDS,
  VALUE_KINDS,
  VALUE_MAX_DAYS,
  VALUE_REQUIRED_FIELDS,
  VALUE_SCHEMA_IDS,
  type ValueItem,
  type ValueKind,
  type ValueProps,
} from "./constants.ts";
export { VALUE_WIDGET } from "./widget.ts";
