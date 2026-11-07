// The MoneyField (FR-13, atoms): a label and an amount typed in the ask's locale for a currency,
// whose result is `{amount, currency}` with the amount a decimal string. Its schemas are
// standalone: they belong to no schema set until the entry is registered (design decision 10), and
// nothing compiles them when this module loads.

export {
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
} from "./checks.ts";
export {
  MONEY_FIELD_MAX_CURRENCIES,
  MONEY_FIELD_MIN_CURRENCIES,
  MONEY_FIELD_SCHEMA_IDS,
  type MoneyFieldItem,
  type MoneyFieldProps,
  type MoneyFieldResult,
} from "./constants.ts";
export { MONEY_FIELD_WIDGET } from "./widget.ts";
