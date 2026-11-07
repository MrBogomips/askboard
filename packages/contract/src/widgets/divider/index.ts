// The Divider (FR-13, atoms): a rule between the items of a question, which gives no answer. Its
// schema is standalone: it belongs to no schema set until the entry is registered (design decision
// 10), and nothing compiles it when this module loads.

export { dividerPropsProblems } from "./checks.ts";
export {
  DIVIDER_SCHEMA_IDS,
  type DividerItem,
  type DividerProps,
} from "./constants.ts";
export { DIVIDER_WIDGET } from "./widget.ts";
