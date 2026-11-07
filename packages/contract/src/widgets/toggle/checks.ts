// The Toggle's checks (atoms, design decision 1): its props' limits restated plain for the
// component, and the shape of its result. Plain ECMAScript with no JSON and no Ajv. Nothing here
// throws on a value it cannot read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { type FieldCheckFailure, requiredFailure, requiredPropProblems } from "../field-checks.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

/**
 * What is wrong with a Toggle's props, the schema's rules restated: a label of 1 to
 * `ATOM_LABEL_MAX_CHARS` code points, an optional description of 1 to
 * `ATOM_DESCRIPTION_MAX_CHARS`, and no other key.
 */
export const togglePropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Toggle's props are an object {label, description?}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => key !== "label" && key !== "description" && key !== "required")
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  problems.push(...requiredPropProblems(props));
  if (!textWithin(props.label, ATOM_LABEL_MAX_CHARS)) {
    problems.push({
      path: "/label",
      message: `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`,
    });
  }
  if (
    props.description !== undefined &&
    !textWithin(props.description, ATOM_DESCRIPTION_MAX_CHARS)
  ) {
    problems.push({
      path: "/description",
      message: `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`,
    });
  }
  return problems;
};

/** Whether `result` has the shape of a Toggle's result, the schema's rule in plain code: a boolean. */
export const toggleResultShape = (result: unknown): boolean => typeof result === "boolean";

/**
 * The Toggle's field check (form-widget, design decision 2): `required`, the one check it has.
 * A value that fails only it still fits.
 */
export const toggleFieldCheck = (result: unknown, props: unknown): FieldCheckFailure | undefined =>
  requiredFailure(props, result);
