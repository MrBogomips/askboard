// The Value's checks (atoms, design decision 1): its props' limits, restated plain for the
// component, and what the schema cannot say: that a date exists within the Gantt's days. Plain
// ECMAScript with no JSON and no Ajv: the value chunk bundles it. Nothing here throws on a value
// it cannot read; it gives a problem for it.

import { AMOUNT_PATTERN, minorUnitsProblem } from "../../locale/amount.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { isGanttDate } from "../gantt/checks.ts";
import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";
import {
  ATOM_LABEL_MAX_CHARS,
  ATOM_NUMBER_BOUND,
  ATOM_UNIT_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import {
  VALUE_FIELDS,
  VALUE_KIND_FIELDS,
  VALUE_KINDS,
  VALUE_MAX_DAYS,
  VALUE_REQUIRED_FIELDS,
  type ValueKind,
} from "./constants.ts";

const CURRENCY = /^[A-Z]{3}$/;

const isKind = (kind: unknown): kind is ValueKind =>
  typeof kind === "string" && (VALUE_KINDS as readonly string[]).includes(kind);

const boundedNumber = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -ATOM_NUMBER_BOUND &&
  value <= ATOM_NUMBER_BOUND;

// The problem of one field's value, restated from the schema, or undefined when it is fine.
const fieldProblem = (field: string, value: unknown): string | undefined => {
  switch (field) {
    case "label":
      return typeof value === "string" &&
        codePointCount(value) >= 1 &&
        codePointCount(value) <= ATOM_LABEL_MAX_CHARS
        ? undefined
        : `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`;
    case "value":
      return boundedNumber(value)
        ? undefined
        : `the value is a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`;
    case "unit":
      return typeof value === "string" &&
        codePointCount(value) >= 1 &&
        codePointCount(value) <= ATOM_UNIT_MAX_CHARS
        ? undefined
        : `the unit is a text of 1 to ${ATOM_UNIT_MAX_CHARS} characters`;
    case "amount":
      return typeof value === "string" && AMOUNT_PATTERN.test(value)
        ? undefined
        : "the amount is a decimal string of at most 15 integer digits and 4 decimals, as in 12480.50, and no finer than its currency takes";
    case "currency":
      return typeof value === "string" && CURRENCY.test(value)
        ? undefined
        : "the currency is an ISO 4217 code of three capital letters";
    case "date":
      return isGanttDate(value)
        ? undefined
        : `the date is a day that exists, from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
    default:
      return Number.isInteger(value) &&
        (value as number) >= 0 &&
        (value as number) <= VALUE_MAX_DAYS
        ? undefined
        : `the days are a whole number from 0 to ${VALUE_MAX_DAYS}`;
  }
};

/**
 * What is wrong with a Value's props, the schema's rules restated and the date's existence: a
 * known `kind`, the fields the kind requires, no field of another kind, and each field within its
 * bounds. A date outside the Gantt's days, or one that does not exist (`2026-02-30`), is a problem
 * the schema's pattern lets through.
 */
export const valuePropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Value's props are an object {label?, kind, ...}" }];
  }
  const { kind } = props;
  if (!isKind(kind)) {
    return [{ path: "/kind", message: `the kind is one of ${VALUE_KINDS.join(", ")}` }];
  }
  const held = VALUE_KIND_FIELDS[kind];
  const problems: Problem[] = [];
  for (const key of Object.keys(props)) {
    if (key === "kind" || key === "label") continue;
    const known = (VALUE_FIELDS as readonly string[]).includes(key);
    if (!known) problems.push({ path: `/${key}`, message: `unknown field "${key}"` });
    else if (!held.includes(key)) {
      problems.push({ path: `/${key}`, message: `a ${kind} Value holds no "${key}"` });
    }
  }
  for (const field of VALUE_REQUIRED_FIELDS[kind]) {
    if (props[field] === undefined) {
      problems.push({ path: `/${field}`, message: `a ${kind} Value requires "${field}"` });
    }
  }
  for (const field of ["label", ...held]) {
    if (props[field] === undefined) continue;
    const problem = fieldProblem(field, props[field]);
    if (problem !== undefined) problems.push({ path: `/${field}`, message: problem });
  }
  // An amount finer than its currency: shown rounded, it would read as a figure the agent did not
  // give.
  const { amount, currency } = props;
  if (
    kind === "money" &&
    problems.length === 0 &&
    typeof amount === "string" &&
    typeof currency === "string"
  ) {
    const finer = minorUnitsProblem(amount, currency);
    if (finer !== undefined) problems.push({ path: "/amount", message: finer });
  }
  return problems;
};
