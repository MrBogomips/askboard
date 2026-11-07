// How a request's wording reads a Value's props (atoms, design decision 1): the expected shape and
// the field list of its one object, keyed `value.props…`. Nothing here validates.

import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";
import { ATOM_LABEL_MAX_CHARS, ATOM_NUMBER_BOUND, ATOM_UNIT_MAX_CHARS } from "../shared/atoms.ts";
import { text } from "../wording-parts.ts";
import { VALUE_MAX_DAYS } from "./constants.ts";

export const VALUE_EXPECTED: Readonly<Record<string, string>> = {
  "value.props":
    "a Value's props {label?, kind, and the kind's fields: value and unit? for number, value for percent, amount and currency for money, date, days}",
  "value.props.label": text(ATOM_LABEL_MAX_CHARS),
  "value.props.kind": '"number", "percent", "money", "date" or "duration"',
  "value.props.value": `a number from -${ATOM_NUMBER_BOUND} to ${ATOM_NUMBER_BOUND}, for a number or a percent (a ratio: 0.185 is 18.5%)`,
  "value.props.unit": `${text(ATOM_UNIT_MAX_CHARS)}, for a number only`,
  "value.props.amount":
    "a decimal string of at most 15 integer digits and 4 decimals, as in 12480.50, for money",
  "value.props.currency": "an ISO 4217 code of three capital letters, as in EUR, for money",
  "value.props.date": `a full-date from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}, for a date`,
  "value.props.days": `a whole number of days from 0 to ${VALUE_MAX_DAYS}, for a duration`,
};

export const VALUE_FIELDS_WORDING: Readonly<Record<string, string>> = {
  "value.props":
    "a Value's props hold only label, kind, and the kind's fields: value, unit, amount, currency, date and days",
};
