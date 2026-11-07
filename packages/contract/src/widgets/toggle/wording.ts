// How a request's wording reads a Toggle's props (atoms, design decision 1), keyed
// `toggle.props…`. Nothing here validates.

import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";

export const TOGGLE_EXPECTED: Readonly<Record<string, string>> = {
  "toggle.props": "a Toggle's props {label, description?}",
  "toggle.props.label": text(ATOM_LABEL_MAX_CHARS),
  "toggle.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
};

export const TOGGLE_FIELDS: Readonly<Record<string, string>> = {
  "toggle.props": "a Toggle's props hold only label and description",
};
