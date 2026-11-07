// The NumberField's checks (atoms, design decision 1): its props' limits restated plain for the
// component, with the one the schema cannot say (max not below min), and of a result, the shape
// the schema takes and what the item's props add: the bounds, a whole number when `integer`, and a
// step counted from `min` (else 0), within a billionth of a step or the doubles' own spacing there,
// and refused where that spacing reaches a quarter step (review 1.8 X-1).
//
// Plain ECMAScript with no JSON and no Ajv: the field chunks bundle it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  ATOM_NUMBER_BOUND,
  ATOM_UNIT_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import {
  NUMBER_FIELD_STEP_MAX,
  NUMBER_FIELD_STEP_TOLERANCE,
  NUMBER_FIELD_STEP_UNDECIDABLE,
} from "./constants.ts";

const KEYS = ["label", "description", "min", "max", "step", "integer", "unit"];

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

const bounded = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -ATOM_NUMBER_BOUND &&
  value <= ATOM_NUMBER_BOUND;

// How far, in steps, the double nearest `min + k * step` may lie from its exact grid point at this
// magnitude: a billionth of a step, or eight units in the last place of the magnitude where those
// are wider (the sum, its rounding and the subtraction each move a double by one such unit).
const stepTolerance = (magnitude: number, step: number): number =>
  Math.max(NUMBER_FIELD_STEP_TOLERANCE, (8 * Number.EPSILON * magnitude) / step);

/**
 * The step `value` is on, counted from `min`, or `undefined` when it is off the grid, or when the
 * doubles at its magnitude are spaced so wide that the check cannot tell (a quarter step or more).
 */
const stepIndex = (value: number, min: number, step: number): number | undefined => {
  const tolerance = stepTolerance(Math.max(Math.abs(min), Math.abs(value)), step);
  const quotient = (value - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) &&
    tolerance < NUMBER_FIELD_STEP_UNDECIDABLE &&
    Math.abs(quotient - whole) <= tolerance
    ? whole
    : undefined;
};

/**
 * What is wrong with a NumberField's props, the schema's rules restated and `max` not below `min`:
 * a label of 1 to `ATOM_LABEL_MAX_CHARS` code points, an optional description, `min` and `max`
 * within `ATOM_NUMBER_BOUND` either way, a `step` above 0 and at most `NUMBER_FIELD_STEP_MAX`, a
 * boolean `integer`, a unit of 1 to `ATOM_UNIT_MAX_CHARS` code points, and no other key.
 */
export const numberFieldPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a NumberField's props are an object {label, ...}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => !KEYS.includes(key))
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path: string, message: string) => problems.push({ path, message });
  if (!textWithin(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (
    props.description !== undefined &&
    !textWithin(props.description, ATOM_DESCRIPTION_MAX_CHARS)
  ) {
    at(
      "/description",
      `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`,
    );
  }
  for (const key of ["min", "max"] as const) {
    if (props[key] !== undefined && !bounded(props[key])) {
      at(`/${key}`, `${key} is a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`);
    }
  }
  const { step } = props;
  if (
    step !== undefined &&
    !(
      typeof step === "number" &&
      Number.isFinite(step) &&
      step > 0 &&
      step <= NUMBER_FIELD_STEP_MAX
    )
  ) {
    at("/step", `step is a number above 0 and at most ${NUMBER_FIELD_STEP_MAX}`);
  }
  if (props.integer !== undefined && typeof props.integer !== "boolean") {
    at("/integer", "integer is true or false");
  }
  if (props.unit !== undefined && !textWithin(props.unit, ATOM_UNIT_MAX_CHARS)) {
    at("/unit", `the unit is a text of 1 to ${ATOM_UNIT_MAX_CHARS} characters`);
  }
  if (bounded(props.min) && bounded(props.max) && props.max < props.min) {
    at("/max", `max ${props.max} is below min ${props.min}`);
  }
  return [...problems, ...stepProblems(props)];
};

// A step the doubles cannot tell from half of one between the item's own bounds is refused: the
// bounds' magnitude, with 0 for one that is absent, sets the spacing (review 1.8 X-1).
const stepProblems = (props: Record<string, unknown>): Problem[] => {
  const { step, min, max } = props;
  if (typeof step !== "number" || !(step > 0) || !Number.isFinite(step)) return [];
  const magnitude = Math.max(bounded(min) ? Math.abs(min) : 0, bounded(max) ? Math.abs(max) : 0);
  return stepTolerance(magnitude, step) < NUMBER_FIELD_STEP_UNDECIDABLE
    ? []
    : [
        {
          path: "/step",
          message: `step ${step} is too fine for bounds this large: the numbers up to ${magnitude} cannot tell a value on the step from one off it`,
        },
      ];
};

/**
 * What a schema-valid NumberField result still gets wrong against the item's props: outside `min`
 * to `max`, not whole when the item is `integer`, and not on a step of `step` counted from `min`
 * (else 0), within a billionth of a step or the doubles' spacing there, and refused where that
 * reaches a quarter step. Props that are no NumberField's refuse the result,
 * since nothing can check it.
 */
export const numberFieldResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  if (!isRecord(props) || numberFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no NumberField's, so its result cannot be checked",
      },
    ];
  }
  if (typeof result !== "number" || !Number.isFinite(result)) return [];
  const at = (message: string): readonly Problem[] => [{ path: "/", message }];
  const { min, max, step } = props as { min?: number; max?: number; step?: number };
  if (min !== undefined && result < min) return at(`${result} is below the field's minimum ${min}`);
  if (max !== undefined && result > max) return at(`${result} is above the field's maximum ${max}`);
  const problems: Problem[] = [];
  if (props.integer === true && !Number.isInteger(result)) {
    problems.push({
      path: "/",
      message: `${result} is not a whole number, and this field takes whole numbers`,
    });
  }
  if (step !== undefined && stepIndex(result, min ?? 0, step) === undefined) {
    problems.push({
      path: "/",
      message: `${result} is not on a step of ${step} from ${min ?? 0}, or is too large for the step to be told`,
    });
  }
  return problems;
};

/**
 * Whether `result` has the shape of a NumberField's result, the schema's rule in plain code: a
 * finite number within `ATOM_NUMBER_BOUND` either way. What the item's props add is the check's.
 */
export const numberFieldResultShape = (result: unknown): boolean => bounded(result);
