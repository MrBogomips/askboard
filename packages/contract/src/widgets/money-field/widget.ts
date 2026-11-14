// The MoneyField's registry entry (atoms, design decisions 1 and 2): its schemas, checks, shape,
// wording, example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a
// schema set module (the registry's import rule). A MoneyField edits nothing and derives nothing:
// it gives a result, an amount as a decimal string with its currency.

import type { WidgetType } from "../registry.ts";
import {
  moneyFieldFieldCheck,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
} from "./checks.ts";
import moneyFieldProps from "./money-field-props.json" with { type: "json" };
import moneyFieldResult from "./money-field-result.json" with { type: "json" };
import { MONEY_FIELD_EXPECTED, MONEY_FIELD_FIELDS } from "./wording.ts";

export const MONEY_FIELD_WIDGET: WidgetType = {
  type: "money-field",
  noun: "a MoneyField",
  props: moneyFieldProps,
  propsProblems: moneyFieldPropsProblems,
  fieldCheck: moneyFieldFieldCheck,
  result: {
    schema: moneyFieldResult,
    shape: moneyFieldResultShape,
    problems: moneyFieldResultProblems,
  },
  wording: { expected: MONEY_FIELD_EXPECTED, fields: MONEY_FIELD_FIELDS },
  example: {
    item: {
      type: "money-field",
      id: "fee",
      props: { label: "Budget", currency: "EUR", min: "0" },
    },
  },
  help: {
    mouse: "Type an amount, and pick the currency where more than one is offered.",
    answer: "The agent receives the amount and its currency.",
  },
  skill: {
    use: "an amount of money the user types, in one currency or one picked from a list",
    notes: [
      "Give `currency`, or `currencies` (2 to 10 codes) for the user to pick from, never both. `min` and `max` are decimal strings. The result is `{amount, currency}` with `amount` a decimal string.",
    ],
  },
};
