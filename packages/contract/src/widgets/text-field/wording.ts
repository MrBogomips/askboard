// How a request's wording reads a TextField's props (atoms, design decision 1): the expected shape
// and the field list of its one object, keyed `text-field.props…`. Nothing here validates.

import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { PATTERN_MAX_CHARS, PATTERN_TEXT_MAX_CHARS } from "../shared/pattern.ts";
import { text } from "../wording-parts.ts";
import { TEXT_FIELD_MAX_CHARS } from "./constants.ts";

export const TEXT_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "text-field.props":
    "a TextField's props {label, description?, required?, multiline?, minLength?, maxLength?, pattern?}",
  "text-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "text-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "text-field.props.required":
    "true, for a field that must hold a value before the question is answered",
  "text-field.props.multiline": "true, for a field whose text may hold line breaks",
  "text-field.props.minLength": `a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}, the fewest characters the text may hold, not above the most it holds`,
  "text-field.props.pattern": `a regular expression of 1 to ${PATTERN_MAX_CHARS} characters, read with the u flag and unanchored, that the text must match: no backreference, lookahead or lookbehind, and no repeated group holding a quantifier or a |; a field with a pattern holds at most ${PATTERN_TEXT_MAX_CHARS} characters`,
  "text-field.props.maxLength": `a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}, the most characters the text may hold, ${TEXT_FIELD_MAX_CHARS} when absent`,
};

export const TEXT_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "text-field.props":
    "a TextField's props hold only label, description, required, multiline, minLength, maxLength and pattern",
};
