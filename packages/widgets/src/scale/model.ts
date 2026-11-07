// The Scale's model (view-and-widgets spec: Scale as a slider, Scale as a rating; design decision
// 8): the arithmetic of a scale's steps, pure, on props the component has already checked. Every
// number it makes lies on a step between `min` and `max` exactly, as the contract's result check
// reads it: a step's value is rounded to the decimals of `min` and `step`, and the top step is
// `max` itself, however the grid's floating-point sum falls (a step that divides the scale only
// within a billionth, 0.1 three times on 0 to 0.3).

import {
  SCALE_DEFAULT_STEP,
  type ScaleProps,
  type ScaleResult,
  scaleStepCount,
} from "@askboard/contract";

const stepOf = (props: ScaleProps): number => props.step ?? SCALE_DEFAULT_STEP;

/** The number of whole steps from `min` to `max`; throws on props that do not divide into them. */
export const stepsOf = (props: ScaleProps): number => {
  const steps = scaleStepCount(props.min, props.max, stepOf(props));
  if (steps === undefined) {
    throw new RangeError(`a step of ${stepOf(props)} does not divide ${props.min} to ${props.max}`);
  }
  return steps;
};

// The fraction digits of a number's shortest text, exponent included: 0.1 is 1, 1e-7 is 7.
const decimalsOf = (value: number): number => {
  const [mantissa = "", exponent = "0"] = String(value).split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
};

// The value of step `index`, 0 to `steps`: the ends exactly, between them rounded to the decimals.
const valueOfStep = (props: ScaleProps, index: number, steps: number): number => {
  if (index <= 0) return props.min;
  if (index >= steps) return props.max;
  const places = Math.min(100, Math.max(decimalsOf(props.min), decimalsOf(stepOf(props))));
  return Number((props.min + index * stepOf(props)).toFixed(places));
};

/** The value of the nearest step to `value`, clamped to `min` to `max`; `min` for a non-number. */
export const snap = (props: ScaleProps, value: number): number => {
  const steps = stepsOf(props);
  const index = Math.round((value - props.min) / stepOf(props));
  return valueOfStep(props, Number.isNaN(index) ? 0 : index, steps);
};

/** The value at `fraction` of the track, 0 at `min` and 1 at `max`, snapped to a step. */
export const valueAt = (props: ScaleProps, fraction: number): number => {
  const clamped = Number.isNaN(fraction) ? 0 : Math.min(1, Math.max(0, fraction));
  return snap(props, props.min + clamped * (props.max - props.min));
};

const FIRST_AT_MIN = new Set(["Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/** The value an unset slider takes on `key`: Home and the arrows give `min`, End `max`, else none. */
export const firstValue = (props: ScaleProps, key: string): number | undefined => {
  if (key === "End") return props.max;
  return FIRST_AT_MIN.has(key) ? props.min : undefined;
};

/**
 * The result of the thumbs' `values`: one for a value, two for a range, which come out low then
 * high. Throws on a count the props do not take.
 */
export const resultOf = (props: ScaleProps, values: readonly number[]): ScaleResult => {
  const [first, second] = values;
  if (props.range === true) {
    if (values.length !== 2 || first === undefined || second === undefined) {
      throw new RangeError("a range takes two numbers");
    }
    return { low: Math.min(first, second), high: Math.max(first, second) };
  }
  if (values.length !== 1 || first === undefined) throw new RangeError("a value takes one number");
  return { value: first };
};

/** The result the first set value makes: a range starts with both thumbs there. */
export const firstResult = (props: ScaleProps, value: number): ScaleResult =>
  resultOf(props, props.range === true ? [value, value] : [value]);

/** The thumbs' values of a held result, or `undefined` when unset or of the other form. */
export const valuesOf = (props: ScaleProps, result: unknown): readonly number[] | undefined => {
  if (typeof result !== "object" || result === null) return undefined;
  const { value, low, high } = result as Record<string, unknown>;
  if (props.range === true) {
    return typeof low === "number" && typeof high === "number" && value === undefined
      ? [low, high]
      : undefined;
  }
  return typeof value === "number" && low === undefined && high === undefined ? [value] : undefined;
};

/** A rating's values, one per step from `min` to `max`. */
export const ratingValues = (props: ScaleProps): readonly number[] => {
  const steps = stepsOf(props);
  return Array.from({ length: steps + 1 }, (_, index) => valueOfStep(props, index, steps));
};
