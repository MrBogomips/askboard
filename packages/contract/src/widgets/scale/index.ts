// The Scale (FR-11, approval-scale-ranking): a number on a slider, a range between two numbers or a
// rating, whose result is `{value}` or `{low, high}`. Its schemas are standalone: they belong to no
// schema set until the entry is registered (design decision 10), and nothing compiles them when
// this module loads.

export {
  scalePropsProblems,
  scaleResultProblems,
  scaleStepCount,
  scaleStepIndex,
} from "./checks.ts";
export {
  SCALE_BOUND,
  SCALE_DEFAULT_STEP,
  SCALE_DISPLAYS,
  SCALE_LABEL_MAX_CHARS,
  SCALE_MAX_STEPS,
  SCALE_RATING_MAX_VALUES,
  SCALE_SCHEMA_IDS,
  SCALE_STEP_TOLERANCE,
  SCALE_UNIT_MAX_CHARS,
  type ScaleItem,
  type ScaleProps,
  type ScaleResult,
} from "./constants.ts";
export { SCALE_WIDGET } from "./widget.ts";
