// The Toggle (FR-13, atoms): an on or off choice, whose result is a boolean. Its schemas are
// standalone: they belong to no schema set until the entry is registered (design decision 10), and
// nothing compiles them when this module loads.

export { togglePropsProblems, toggleResultShape } from "./checks.ts";
export {
  TOGGLE_SCHEMA_IDS,
  type ToggleItem,
  type ToggleProps,
  type ToggleResult,
} from "./constants.ts";
export { TOGGLE_WIDGET } from "./widget.ts";
