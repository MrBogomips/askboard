// The DateField's checks (atoms, design decision 1): its props' limits restated plain for the
// component, with the ones the schema cannot say (the days exist within the Gantt's days, max not
// before min), and of a result, the shape the schema takes and that the day exists, lies within
// the Gantt's days and within the item's `min` and `max`.
//
// Plain ECMAScript with no JSON and no Ajv: the field chunks bundle it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { type FieldCheckFailure, requiredFailure, requiredPropProblems } from "../field-checks.ts";
import { isGanttDate } from "../gantt/checks.ts";
import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";

const KEYS = ["label", "description", "min", "max", "required"];
const DAYS = `a day that exists, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

/**
 * What is wrong with a DateField's props, the schema's rules restated and the days' existence: a
 * label of 1 to `ATOM_LABEL_MAX_CHARS` code points, an optional description, `min` and `max` days
 * that exist within the Gantt's days, `max` not before `min`, and no other key.
 */
export const dateFieldPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a DateField's props are an object {label, ...}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => !KEYS.includes(key))
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path: string, message: string) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
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
    if (props[key] !== undefined && !isGanttDate(props[key])) {
      at(`/${key}`, `${key} is ${DAYS}`);
    }
  }
  if (isGanttDate(props.min) && isGanttDate(props.max) && props.max < props.min) {
    at("/max", `max ${props.max} is before min ${props.min}`);
  }
  return problems;
};

/**
 * What a schema-valid DateField result still gets wrong against the item's props: a day that does
 * not exist or lies outside the Gantt's days, before `min` or after `max`. Props that are no
 * DateField's refuse the result, since nothing can check it.
 */
export const dateFieldResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  if (!isRecord(props) || dateFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no DateField's, so its result cannot be checked",
      },
    ];
  }
  if (typeof result !== "string") return [];
  const at = (message: string): readonly Problem[] => [{ path: "/", message }];
  if (!isGanttDate(result)) return at(`${JSON.stringify(result)} is not ${DAYS}`);
  const { min, max } = props as { min?: string; max?: string };
  if (min !== undefined && result < min)
    return at(`${result} is before the field's first day ${min}`);
  if (max !== undefined && result > max)
    return at(`${result} is after the field's last day ${max}`);
  return [];
};

/**
 * Whether `result` has the shape of a DateField's result, the schema's rule in plain code: a
 * full-date's text with a month from 01 to 12 and a day from 01 to 31. Whether the day exists is
 * the check's.
 */
export const dateFieldResultShape = (result: unknown): boolean =>
  typeof result === "string" && /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(result);

/**
 * The DateField's field check (form-widget, design decision 2): `required`, the one check it has.
 * A value that fails only it still fits.
 */
export const dateFieldFieldCheck = (
  result: unknown,
  props: unknown,
): FieldCheckFailure | undefined => requiredFailure(props, result);

/** The bound a DateField's day breaks (table-widget, design decision 3). */
export type DateFieldBound = "min" | "max";

/**
 * The bound a day breaks against a DateField's props, or `undefined` when it breaks none: before
 * `min` or after `max`, in `dateFieldResultProblems`' own order. A day that does not exist or lies
 * outside the Gantt's days breaks no bound of the item; nor does a value that is no day, or props
 * that are no DateField's.
 */
export const dateFieldBound = (date: unknown, props: unknown): DateFieldBound | undefined => {
  if (!isGanttDate(date)) return undefined;
  if (!isRecord(props) || dateFieldPropsProblems(props).length > 0) return undefined;
  const { min, max } = props as { min?: string; max?: string };
  if (min !== undefined && date < min) return "min";
  return max !== undefined && date > max ? "max" : undefined;
};
