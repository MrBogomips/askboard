// The Scale's rules that its schemas cannot say (approval-scale-ranking, design decision 1): max
// above min, the step dividing the scale into whole steps, at most 1,000 of them, a rating of one
// value and at most 11 steps, and, of a result, which form its props take and that each number lies
// on a step between min and max. The step arithmetic is written once and serves props and result.
//
// Plain ECMAScript with no JSON and no Ajv: the scale chunk bundles it. Nothing here throws on a
// value it cannot read: the props check gives no problem for what the schema refuses, and the
// result check refuses a result it has no readable props to check against (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import {
  SCALE_DEFAULT_STEP,
  SCALE_MAX_STEPS,
  SCALE_RATING_MAX_STEPS,
  SCALE_STEP_TOLERANCE,
} from "./constants.ts";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// A count with thousands separators, as the limits read in a message.
const grouped = (count: number): string => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * The number of steps `step` makes of the scale from `min` to `max`, or `undefined` when it does not
 * divide it into whole steps, within a billionth of a step.
 */
export const scaleStepCount = (min: number, max: number, step: number): number | undefined => {
  const quotient = (max - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) &&
    whole >= 1 &&
    Math.abs(quotient - whole) <= SCALE_STEP_TOLERANCE
    ? whole
    : undefined;
};

/**
 * The number of the step `value` is on, counted from `min` (0 is `min` itself), or `undefined` when
 * it is not on a step, within a billionth of a step. A number below `min` or above `max` is on a
 * step outside 0 to the scale's step count.
 */
export const scaleStepIndex = (value: number, min: number, step: number): number | undefined => {
  const quotient = (value - min) / step;
  const whole = Math.round(quotient);
  return Number.isFinite(quotient) && Math.abs(quotient - whole) <= SCALE_STEP_TOLERANCE
    ? whole
    : undefined;
};

/** The props of a Scale as the checks read them: the numbers, the step and the step count. */
type Reading = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly steps: number;
  readonly range: boolean;
};

// The props a result is checked against, or undefined when they are no Scale's.
const reading = (props: unknown): Reading | undefined => {
  if (!isRecord(props)) return undefined;
  const { min, max } = props;
  const step = props.step === undefined ? SCALE_DEFAULT_STEP : props.step;
  if (!finite(min) || !finite(max) || !finite(step) || step <= 0 || max <= min) return undefined;
  const steps = scaleStepCount(min, max, step);
  return steps === undefined ? undefined : { min, max, step, steps, range: props.range === true };
};

const RATING_TEXT = `a rating takes one value of at most ${SCALE_RATING_MAX_STEPS} steps`;

/**
 * What a schema-valid Scale's props still get wrong: `max` not above `min`, a step that leaves the
 * scale in no whole number of steps or in more than 1,000, and a rating with a range or with more
 * than 11 steps. A value the schema refuses gives nothing here: the schema's problem stands.
 */
export const scalePropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) return [];
  const { min, max } = props;
  const step = props.step === undefined ? SCALE_DEFAULT_STEP : props.step;
  if (!finite(min) || !finite(max) || !finite(step) || step <= 0) return [];
  if (max <= min) return [{ path: "/max", message: `max ${max} is not above min ${min}` }];
  // The step's field when it is given, else the bound it divides.
  const at = props.step === undefined ? "/max" : "/step";
  const steps = scaleStepCount(min, max, step);
  if (steps === undefined) {
    const message = `a step of ${step} does not divide the scale from ${min} to ${max} into whole steps`;
    return [{ path: at, message }];
  }
  if (steps > SCALE_MAX_STEPS) {
    const message = `the scale from ${min} to ${max} in steps of ${step} has ${grouped(steps)} steps, over the limit of ${grouped(SCALE_MAX_STEPS)}`;
    return [{ path: at, message }];
  }
  if (props.display !== "rating") return [];
  const problems: Problem[] = [];
  if (props.range === true) {
    problems.push({ path: "/range", message: `${RATING_TEXT}: remove range` });
  }
  if (steps + 1 > SCALE_RATING_MAX_STEPS) {
    problems.push({
      path: "/display",
      message: `${RATING_TEXT}, and the scale from ${min} to ${max} in steps of ${step} has ${steps + 1}`,
    });
  }
  return problems;
};

// The problem of one number of a result: not on a step, or on a step outside the scale.
const numberProblem = (name: string, value: unknown, read: Reading): Problem | undefined => {
  if (!finite(value)) return undefined;
  const index = scaleStepIndex(value, read.min, read.step);
  if (index === undefined) {
    return {
      path: `/${name}`,
      message: `${name} ${value} is not on a step of ${read.step} from ${read.min}`,
    };
  }
  return index < 0 || index > read.steps
    ? { path: `/${name}`, message: `${name} ${value} is outside ${read.min} to ${read.max}` }
    : undefined;
};

/**
 * What a schema-valid Scale result still gets wrong against the item's props: the form the props
 * take (`value`, or `low` and `high` with `range`), each number on a step between `min` and `max`,
 * and `low` not above `high`. Props that are no Scale's refuse the result, since nothing can check it.
 */
export const scaleResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  const read = reading(props);
  if (read === undefined) {
    return [
      { path: "/", message: "the item's props are no Scale's, so its result cannot be checked" },
    ];
  }
  if (!isRecord(result)) return [];
  if (read.range) {
    if ("value" in result) {
      return [{ path: "/value", message: "a Scale with range takes low and high, not value" }];
    }
    const found = [
      numberProblem("low", result.low, read),
      numberProblem("high", result.high, read),
    ].filter((problem): problem is Problem => problem !== undefined);
    if (found.length > 0) return found;
    const low = scaleStepIndex(result.low as number, read.min, read.step) ?? 0;
    const high = scaleStepIndex(result.high as number, read.min, read.step) ?? 0;
    return low > high
      ? [{ path: "/low", message: `low ${result.low} is above high ${result.high}` }]
      : [];
  }
  if ("low" in result || "high" in result) {
    return [{ path: "/low", message: "a Scale without range takes value, not low and high" }];
  }
  const problem = numberProblem("value", result.value, read);
  return problem === undefined ? [] : [problem];
};
