// How a request's wording reads a PickField's props (form-widget, design decision 4): the expected
// shape and the field list of its objects, keyed `pick-field.props…`. Nothing here validates.

import { VIEW_ID_PREFIX } from "../../constants.ts";
import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { ID_SHAPE, text } from "../wording-parts.ts";
import { PICK_FIELD_MAX_OPTIONS, PICK_FIELD_MIN_OPTIONS } from "./constants.ts";

export const PICK_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "pick-field.props":
    "a PickField's props {label, description?, required?, options, multiple?, minItems?, maxItems?}",
  "pick-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "pick-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "pick-field.props.required":
    "true, for a field that must hold a value before the question is answered",
  "pick-field.props.options": `a list of ${PICK_FIELD_MIN_OPTIONS} to ${PICK_FIELD_MAX_OPTIONS} options, each {id, label, description?}`,
  "pick-field.props.options[]": "an option {id, label, description?}",
  "pick-field.props.options[].id": `${ID_SHAPE}, unique among the PickField's options and not starting with "${VIEW_ID_PREFIX}"`,
  "pick-field.props.options[].label": text(ATOM_LABEL_MAX_CHARS),
  "pick-field.props.options[].description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "pick-field.props.multiple": "true, for a pick of several options, shown as checkboxes",
  "pick-field.props.minItems": `a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}, the fewest options a multiple pick holds, given only with multiple`,
  "pick-field.props.maxItems": `a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}, the most options a multiple pick holds, not above the number of options, given only with multiple`,
};

export const PICK_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "pick-field.props":
    "a PickField's props hold only label, description, required, options, multiple, minItems and maxItems",
  "pick-field.props.options[]": "an option holds only id, label and description",
};
