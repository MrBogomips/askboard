// How a request's wording reads a MoneyField's props (atoms, design decision 1): the expected shape
// and the field list of its one object, keyed `money-field.props…`. Nothing here validates.

import { ATOM_DESCRIPTION_MAX_CHARS, ATOM_LABEL_MAX_CHARS } from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";
import { MONEY_FIELD_MAX_CURRENCIES, MONEY_FIELD_MIN_CURRENCIES } from "./constants.ts";

const CODE = "an ISO 4217 code of three capital letters, as in EUR";
const DECIMAL = "a decimal string of at most 15 integer digits and 4 decimals, as in 12480.50";

export const MONEY_FIELD_EXPECTED: Readonly<Record<string, string>> = {
  "money-field.props":
    "a MoneyField's props {label, description?, currency or currencies, min?, max?}",
  "money-field.props.label": text(ATOM_LABEL_MAX_CHARS),
  "money-field.props.description": text(ATOM_DESCRIPTION_MAX_CHARS),
  "money-field.props.currency": `${CODE}: the one currency, given instead of currencies`,
  "money-field.props.currencies": `a list of ${MONEY_FIELD_MIN_CURRENCIES} to ${MONEY_FIELD_MAX_CURRENCIES} unique ISO 4217 codes the user picks from, given instead of currency`,
  "money-field.props.currencies[]": CODE,
  "money-field.props.min": `${DECIMAL}, the lowest amount`,
  "money-field.props.max": `${DECIMAL}, the highest amount, not below min`,
};

export const MONEY_FIELD_FIELDS: Readonly<Record<string, string>> = {
  "money-field.props":
    "a MoneyField's props hold only label, description, currency, currencies, min and max",
};
