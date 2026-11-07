// How a request's wording reads a TextField's props (atoms, design decision 1): the expected shape
// and the field list of its one object, keyed `text-field.props…`. Nothing here validates.

import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";
import { TEXT_FIELD_MAX_CHARS } from "./constants.ts";

export const TEXT_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "text-field.props": "a TextField's props {label, description?, multiline?, maxLength?}",
  "text-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "text-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "text-field.props.multiline": "true, for a field whose text may hold line breaks",
  "text-field.props.maxLength": `a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}, the most characters the text may hold, ${TEXT_FIELD_MAX_CHARS} when absent`,
};

export const TEXT_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "text-field.props": "a TextField's props hold only label, description, multiline and maxLength",
};
