// The PickField's checks (form-widget, design decisions 2 and 4): its props' limits restated plain
// for the component, with what the schema cannot say (option IDs unique and clear of the view's
// prefix, the counts' order), and of a result, the shape the schema takes, what the item's props
// add (the IDs are the options', a single pick gives one, a multiple pick a list in the options'
// order) and the field check of its counts.
//
// Plain ECMAScript with no JSON and no Ajv: the field chunk bundles it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { ID_PATTERN, VIEW_ID_PREFIX } from "../../constants.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { type FieldCheckFailure, requiredFailure, requiredPropProblems } from "../field-checks.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import { ID_SHAPE } from "../wording-parts.ts";
import { PICK_FIELD_MAX_OPTIONS, PICK_FIELD_MIN_OPTIONS } from "./constants.ts";

const KEYS = ["label", "description", "required", "options", "multiple", "minItems", "maxItems"];
const OPTION_KEYS = ["id", "label", "description"];
const ID = new RegExp(ID_PATTERN);

const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

const isCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= PICK_FIELD_MAX_OPTIONS;

// One option: its keys, ID, label and description, and its ID's prefix and repeat. `seen` holds the
// IDs of the options before it.
const optionProblems = (option: unknown, index: number, seen: Set<string>): Problem[] => {
  const where = `/options/${index}`;
  if (!isRecord(option)) {
    return [{ path: where, message: "an option is an object {id, label, description?}" }];
  }
  const problems: Problem[] = Object.keys(option)
    .filter((key) => !OPTION_KEYS.includes(key))
    .map((key) => ({ path: `${where}/${key}`, message: `unknown field "${key}"` }));
  const at = (path: string, message: string) => problems.push({ path: `${where}${path}`, message });
  const { id } = option;
  if (!isId(id)) {
    at("/id", `the option ID is ${ID_SHAPE}`);
  } else {
    if (id.startsWith(VIEW_ID_PREFIX)) {
      at(
        "/id",
        `the option ID "${id}" starts with "${VIEW_ID_PREFIX}", which the board keeps for the IDs it makes itself`,
      );
    }
    if (seen.has(id)) {
      at(
        "/id",
        `the option ID "${id}" is held twice: each option of a PickField has an ID of its own`,
      );
    }
    seen.add(id);
  }
  if (!textWithin(option.label, ATOM_LABEL_MAX_CHARS)) {
    at("/label", `the option label is a text of 1 to ${ATOM_LABEL_MAX_CHARS} characters`);
  }
  if (
    option.description !== undefined &&
    !textWithin(option.description, ATOM_DESCRIPTION_MAX_CHARS)
  ) {
    at(
      "/description",
      `the option description is a text of 1 to ${ATOM_DESCRIPTION_MAX_CHARS} characters`,
    );
  }
  return problems;
};

// `minItems` and `maxItems`: only with `multiple`, whole numbers from 1, the least not above the
// most, which is not above the number of options.
const countProblems = (props: Readonly<Record<string, unknown>>, options: number): Problem[] => {
  const problems: Problem[] = [];
  const at = (path: string, message: string) => problems.push({ path, message });
  for (const key of ["minItems", "maxItems"] as const) {
    const value = props[key];
    if (value === undefined) continue;
    if (!isCount(value)) {
      at(`/${key}`, `${key} is a whole number from 1 to ${PICK_FIELD_MAX_OPTIONS}`);
    } else if (props.multiple !== true) {
      at(
        `/${key}`,
        `${key} counts the picks of a multiple pick: set multiple, or leave ${key} out`,
      );
    } else if (value > options) {
      at(`/${key}`, `${key} ${value} is above the number of options, ${options}`);
    }
  }
  const { minItems, maxItems } = props;
  if (isCount(minItems) && isCount(maxItems) && minItems > maxItems) {
    at("/minItems", `minItems ${minItems} is above maxItems ${maxItems}`);
  }
  return problems;
};

/**
 * What is wrong with a PickField's props, the schema's rules restated and what it cannot say: a
 * label of 1 to `ATOM_LABEL_MAX_CHARS` code points, an optional description, a boolean `required`
 * and `multiple`, `PICK_FIELD_MIN_OPTIONS` to `PICK_FIELD_MAX_OPTIONS` options each with an ID in
 * the input format's shape that is unique in the item and does not start with the view's prefix, a
 * label and an optional description, counts as `countProblems` reads them, and no other key.
 */
export const pickFieldPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a PickField's props are an object {label, options, ...}" }];
  }
  const problems: Problem[] = Object.keys(props)
    .filter((key) => !KEYS.includes(key))
    .map((key) => ({ path: `/${key}`, message: `unknown field "${key}"` }));
  const at = (path: string, message: string) => problems.push({ path, message });
  problems.push(...requiredPropProblems(props));
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
  if (props.multiple !== undefined && typeof props.multiple !== "boolean") {
    at("/multiple", "multiple is true or false");
  }
  const { options } = props;
  if (
    !Array.isArray(options) ||
    options.length < PICK_FIELD_MIN_OPTIONS ||
    options.length > PICK_FIELD_MAX_OPTIONS
  ) {
    at(
      "/options",
      `options is a list of ${PICK_FIELD_MIN_OPTIONS} to ${PICK_FIELD_MAX_OPTIONS} options`,
    );
  }
  const held: readonly unknown[] = Array.isArray(options) ? options : [];
  const seen = new Set<string>();
  for (const [index, option] of held.entries()) {
    problems.push(...optionProblems(option, index, seen));
  }
  problems.push(...countProblems(props, held.length));
  return problems;
};

/** The IDs of the options of props that are a PickField's, or `undefined` for any other props. */
const optionIds = (props: unknown): readonly string[] | undefined => {
  if (!isRecord(props) || pickFieldPropsProblems(props).length > 0) return undefined;
  return (props.options as readonly { readonly id: string }[]).map(({ id }) => id);
};

/**
 * Whether `result` has the shape of a PickField's result, the schema's rule in plain code: an
 * option ID, or a list of 1 to `PICK_FIELD_MAX_OPTIONS` distinct IDs. That they are the item's is
 * the check of `pickFieldResultProblems`.
 */
export const pickFieldResultShape = (result: unknown): boolean =>
  isId(result) ||
  (Array.isArray(result) &&
    result.length >= 1 &&
    result.length <= PICK_FIELD_MAX_OPTIONS &&
    result.every(isId) &&
    new Set<unknown>(result).size === result.length);

/**
 * What a schema-valid PickField result still gets wrong against the item's props: a single pick
 * that gives a list, a multiple pick that gives one ID, an ID that is no option's, and a list not in
 * the options' order. Props that are no PickField's refuse the result, since nothing can check it.
 */
export const pickFieldResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  const ids = optionIds(props);
  if (ids === undefined || !isRecord(props)) {
    return [
      {
        path: "/",
        message: "the item's props are no PickField's, so its result cannot be checked",
      },
    ];
  }
  const picked: readonly unknown[] = Array.isArray(result) ? result : [result];
  const problems: Problem[] = [];
  if (props.multiple === true && !Array.isArray(result)) {
    problems.push({ path: "/", message: "a multiple pick gives a list of option IDs" });
  } else if (props.multiple !== true && Array.isArray(result)) {
    problems.push({ path: "/", message: "a single pick gives one option ID, not a list" });
  }
  const known = new Set(ids);
  for (const id of picked) {
    if (typeof id === "string" && !known.has(id)) {
      problems.push({ path: "/", message: `"${id}" is no option of this field` });
    }
  }
  if (problems.length === 0 && Array.isArray(result)) {
    const places = result.map((id) => ids.indexOf(id as string));
    if (places.some((place, at) => at > 0 && place < (places[at - 1] as number))) {
      problems.push({ path: "/", message: "the option IDs are not in the order of the options" });
    }
  }
  return problems;
};

/**
 * The PickField's field check (form-widget, design decision 2): `required`, then the counts of a
 * multiple pick. A pick outside them still fits.
 */
export const pickFieldFieldCheck = (
  result: unknown,
  props: unknown,
): FieldCheckFailure | undefined => {
  const required = requiredFailure(props, result);
  if (required !== undefined) return required;
  if (!Array.isArray(result) || !isRecord(props) || props.multiple !== true) return undefined;
  const { minItems, maxItems } = props;
  if (isCount(minItems) && result.length < minItems) return { code: "min-items", min: minItems };
  if (isCount(maxItems) && result.length > maxItems) return { code: "max-items", max: maxItems };
  return undefined;
};
