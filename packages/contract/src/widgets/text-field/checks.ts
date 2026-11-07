// The TextField's checks (atoms, design decision 1): its props' limits restated plain for the
// component, and of a result, the shape the schema takes and what the item's props add: the text
// fits `maxLength` in code points and holds no line break unless the field is multiline.
//
// Plain ECMAScript with no JSON and no Ajv: the field chunks bundle it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import { TEXT_FIELD_MAX_CHARS } from "./constants.ts";

const KEYS = ["label", "description", "multiline", "maxLength"];

const textWithin = (value: unknown, max: number): boolean =>
  typeof value === "string" && codePointCount(value) >= 1 && codePointCount(value) <= max;

/**
 * What is wrong with a TextField's props, the schema's rules restated: a label of 1 to
 * `ATOM_LABEL_MAX_CHARS` code points, an optional description of 1 to `ATOM_DESCRIPTION_MAX_CHARS`,
 * a boolean `multiline`, a whole `maxLength` from 1 to `TEXT_FIELD_MAX_CHARS`, and no other key.
 */
export const textFieldPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a TextField's props are an object {label, ...}" }];
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
  if (props.multiline !== undefined && typeof props.multiline !== "boolean") {
    at("/multiline", "multiline is true or false");
  }
  const { maxLength } = props;
  if (
    maxLength !== undefined &&
    !(
      Number.isInteger(maxLength) &&
      (maxLength as number) >= 1 &&
      (maxLength as number) <= TEXT_FIELD_MAX_CHARS
    )
  ) {
    at("/maxLength", `maxLength is a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}`);
  }
  return problems;
};

const LINE_BREAK = /[\n\r]/;

/**
 * What a schema-valid TextField result still gets wrong against the item's props: more code points
 * than `maxLength` (`TEXT_FIELD_MAX_CHARS` when absent), and a line feed or carriage return in a
 * field that is not multiline. Props that are no TextField's refuse the result, since nothing can
 * check it.
 */
export const textFieldResultProblems = (result: unknown, props: unknown): readonly Problem[] => {
  if (!isRecord(props) || textFieldPropsProblems(props).length > 0) {
    return [
      {
        path: "/",
        message: "the item's props are no TextField's, so its result cannot be checked",
      },
    ];
  }
  if (typeof result !== "string") return [];
  const limit = typeof props.maxLength === "number" ? props.maxLength : TEXT_FIELD_MAX_CHARS;
  const count = codePointCount(result);
  const problems: Problem[] = [];
  if (count > limit) {
    problems.push({
      path: "/",
      message: `the text has ${count} characters, over the field's limit of ${limit}`,
    });
  }
  if (props.multiline !== true && LINE_BREAK.test(result)) {
    problems.push({ path: "/", message: "the text holds a line break, and this field takes none" });
  }
  return problems;
};

/**
 * Whether `result` has the shape of a TextField's result, the schema's rule in plain code: a
 * string of 1 to `TEXT_FIELD_MAX_CHARS` code points. What the item's props add is the check's.
 */
export const textFieldResultShape = (result: unknown): boolean =>
  textWithin(result, TEXT_FIELD_MAX_CHARS);
