// How a request's wording reads a NumberField's props (atoms, design decision 1): the expected
// shape and the field list of its one object, keyed `number-field.props…`. Nothing here validates.

import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  ATOM_NUMBER_BOUND,
  ATOM_UNIT_MAX_CHARS,
} from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";
import { NUMBER_FIELD_STEP_MAX } from "./constants.ts";

const BOUND = `a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}`;

export const NUMBER_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "number-field.props":
    "a NumberField's props {label, description?, min?, max?, step?, integer?, unit?}",
  "number-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "number-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "number-field.props.min": `${BOUND}, the lowest value`,
  "number-field.props.max": `${BOUND}, the highest value, not below min`,
  "number-field.props.step": `a number above 0 and at most ${NUMBER_FIELD_STEP_MAX}: values lie on it, counted from min, else from 0`,
  "number-field.props.integer": "true, for a field that takes whole numbers",
  "number-field.props.unit": text(ATOM_UNIT_MAX_CHARS),
};

export const NUMBER_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "number-field.props":
    "a NumberField's props hold only label, description, min, max, step, integer and unit",
};
