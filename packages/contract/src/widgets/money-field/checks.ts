// The MoneyField's checks (atoms, design decisions 1 and 2): its props' limits restated plain for
// the component, with the ones the schema cannot say (exactly one currency field, `max` not below
// `min`), and of a result, the shape the schema takes and what the item's props add: the item's
// currency, at most the currency's minor units in decimals, and `min` and `max` compared as
// decimals, never as binary floats.
//
// Plain ECMAScript with no JSON and no Ajv: the field chunks bundle it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { AMOUNT_PATTERN, compareDecimal, minorUnitsOf } from "../../locale/amount.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import { MONEY_FIELD_MAX_CURRENCIES, MONEY_FIELD_MIN_CURRENCIES } from "./constants.ts";

const KEYS = ["label", "description", "currency", "currencies", "min", "max"];
const CURRENCY = /^[A-Z]{3}$/;

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

const isAmount = (value: unknown): value is string =>
  typeof value === "string" && AMOUNT_PATTERN.test(value);

const isCurrency = (value: unknown): value is string =>
  typeof value === "string" && CURRENCY.test(value);

// The problems of a `currencies` list: its size, a code that is none, a duplicate.
const currenciesProblems = (currencies: unknown): Problem[] => {
  const at = (path: string, message: string): Problem => ({ path, message });
  const range = `${MONEY_FIELD_MIN_CURRENCIES} to ${MONEY_FIELD_MAX_CURRENCIES}`;
  if (!Array.isArray(currencies)) {
    return [at("/currencies", `currencies is a list of ${range} unique ISO 4217 codes`)];
  }
  const problems: Problem[] = [];
  if (
    currencies.length < MONEY_FIELD_MIN_CURRENCIES ||
    currencies.length > MONEY_FIELD_MAX_CURRENCIES
  ) {
    problems.push(
      at("/currencies", `currencies lists ${currencies.length} codes, and a list has ${range}`),
    );
  }
  currencies.forEach((code, index) => {
    if (!isCurrency(code)) {
      problems.push(
        at(`/currencies/${index}`, "a currency is an ISO 4217 code of three capital letters"),
      );
    }
  });
  if (new Set(currencies).size < currencies.length) {
    problems.push(at("/currencies", "currencies lists a code twice"));
  }
  return problems;
};

/**
 * What is wrong with a MoneyField's props, the schema's rules restated and the two it cannot say:
 * a label of 1 to `ATOM_LABEL_MAX_CHARS` code points, an optional description, exactly one of
 * `currency` (a code) and `currencies` (2 to 10 unique codes), `min` and `max` decimal strings with
 * `max` not below `min`, and no other key.
 */
export const moneyFieldPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a MoneyField's props are an object {label, ...}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => !KEYS.includes(key))
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path: string, message: string) => problems.push({ path, message });
  if (!textWithin(props.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (
    props.description !== undefined &&
    !textWithin(props.description, ATOM_DESCRIPTION_MAX_CHARS)
  ) {
    at(
      "/description",
      `the description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`,
    );
  }
  const { currency, currencies } = props;
  if (currency !== undefined && !isCurrency(currency)) {
    at("/currency", "the currency is an ISO 4217 code of three capital letters");
  }
  if (currencies !== undefined) problems.push(...currenciesProblems(currencies));
  if (currency === undefined && currencies === undefined) {
    at("/currency", "give currency, or currencies for the user to pick from");
  } else if (currency !== undefined && currencies !== undefined) {
    at("/currencies", "give currency or currencies, not both");
  }
  for (const key of ["min", "max"] as const) {
    if (props[key] !== undefined && !isAmount(props[key])) {
      at(`/${key}`, `${key} is a decimal string of at most 15 integer digits and 4 decimals`);
    }
  }
  if (isAmount(props.min) && isAmount(props.max) && compareDecimal(props.min, props.max) > 0) {
    at("/max", `max ${props.max} is below min ${props.min}`);
  }
  return problems;
};

const isResult = (result: unknown): result is { amount: string; currency: string } =>
  isRecord(result) &&
  Object.keys(result).length === 2 &&
  isAmount(result.amount) &&
  isCurrency(result.currency);

// The decimals of an amount's text.
const decimalsOf = (amount: string): number => amount.split(".")[1]?.length ?? 0;

/**
 * What a schema-valid MoneyField result still gets wrong against the item's props: a currency that
 * is not the item's `currency` or one of its `currencies`, more decimals than the currency's minor
 * units, and an amount below `min` or above `max`, compared as decimals. Props that are no
 * MoneyField's refuse the result, since nothing can check it.
 */
export const moneyFieldResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  if (!isRecord(props) || moneyFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no MoneyField's, so its result cannot be checked",
      },
    ];
  }
  if (!isResult(result)) return [];
  const { amount, currency } = result;
  const offered = Array.isArray(props.currencies) ? props.currencies : [props.currency];
  const problems: Problem[] = [];
  const at = (path: string, message: string) => problems.push({ path, message });
  if (!offered.includes(currency)) {
    at("/currency", `the currency ${currency} is not one of the field's: ${offered.join(", ")}`);
  }
  const places = minorUnitsOf(currency);
  if (decimalsOf(amount) > places) {
    const takes = places === 0 ? "no decimals" : `at most ${places} decimals`;
    at("/amount", `${currency} takes ${takes}, and the amount ${amount} has ${decimalsOf(amount)}`);
  }
  if (isAmount(props.min) && compareDecimal(amount, props.min) < 0) {
    at("/amount", `the amount ${amount} is below the field's minimum ${props.min}`);
  }
  if (isAmount(props.max) && compareDecimal(amount, props.max) > 0) {
    at("/amount", `the amount ${amount} is above the field's maximum ${props.max}`);
  }
  return problems;
};

/**
 * Whether `result` has the shape of a MoneyField's result, the schema's rule in plain code: an
 * object of exactly `amount`, a decimal string within the amount pattern, and `currency`, three
 * capital letters. What the item's props add is the check's.
 */
export const moneyFieldResultShape = (result: unknown): boolean => isResult(result);
