// How a request's wording reads a DateField's props (atoms, design decision 1): the expected shape
// and the field list of its one object, keyed `date-field.props…`. Nothing here validates.

import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";
import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";

const DAYS = `a full-date from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;

export const DATE_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "date-field.props": "a DateField's props {label, description?, min?, max?}",
  "date-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "date-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "date-field.props.min": `${DAYS}, the earliest day`,
  "date-field.props.max": `${DAYS}, the latest day, not before min`,
};

export const DATE_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "date-field.props": "a DateField's props hold only label, description, min and max",
};
