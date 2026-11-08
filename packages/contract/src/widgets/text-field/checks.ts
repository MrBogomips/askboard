// The TextField's checks (atoms, design decision 1): its props' limits restated plain for the
// component, and of a result, the shape the schema takes and what the item's props add: the text
// fits `maxLength` in code points and holds no line break unless the field is multiline. Since
// form-widget it also holds the field's checks: `required` and `minLength` for `ask-core` and the
// board, and the pattern, which only the board runs (design decisions 2 and 3).
//
// Plain ECMAScript with no JSON and no Ajv: the field chunks bundle it. Nothing here throws on a
// value it cannot read, and a result against props it cannot read is refused (AD-10).

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { type FieldCheckFailure, requiredFailure, requiredPropProblems } from "../field-checks.ts";
import {
  ATOM_DESCRIPTION_MAX_CHARS,
  ATOM_LABEL_MAX_CHARS,
  codePointCount,
} from "../shared/atoms.ts";
import { PATTERN_MAX_CHARS, PATTERN_TEXT_MAX_CHARS, patternProblem } from "../shared/pattern.ts";
import { TEXT_FIELD_MAX_CHARS } from "./constants.ts";

const KEYS = ["label", "description", "multiline", "maxLength", "required", "minLength", "pattern"];

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
  problems.push(...lengthProblems(props), ...patternProblems(props));
  return problems;
};

/**
 * The most code points the field's text holds: `maxLength`, else `PATTERN_TEXT_MAX_CHARS` for a
 * field with a pattern, which the board runs on the text, else `TEXT_FIELD_MAX_CHARS`.
 */
export const textFieldLimit = (props: Readonly<Record<string, unknown>>): number =>
  typeof props.maxLength === "number"
    ? props.maxLength
    : props.pattern === undefined
      ? TEXT_FIELD_MAX_CHARS
      : PATTERN_TEXT_MAX_CHARS;

const isWhole = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;

// `minLength`: a whole number from 1 to the field's own limit, which `maxLength` or a pattern sets.
const lengthProblems = (props: Readonly<Record<string, unknown>>): readonly Problem[] => {
  const { minLength } = props;
  if (minLength === undefined) return [];
  if (!isWhole(minLength, TEXT_FIELD_MAX_CHARS)) {
    return [
      {
        path: "/minLength",
        message: `minLength is a whole number from 1 to ${TEXT_FIELD_MAX_CHARS}`,
      },
    ];
  }
  const limit = textFieldLimit(props);
  return minLength > limit
    ? [
        {
          path: "/minLength",
          message: `minLength ${minLength} is above the most the field holds, ${limit} characters`,
        },
      ]
    : [];
};

// `pattern`: a text of 1 to `PATTERN_MAX_CHARS` code points inside the safe subset, on a field of at
// most `PATTERN_TEXT_MAX_CHARS` characters (NFR-5, AD-8).
const patternProblems = (props: Readonly<Record<string, unknown>>): readonly Problem[] => {
  const { pattern, maxLength } = props;
  if (pattern === undefined) return [];
  if (typeof pattern !== "string" || pattern === "") {
    return [
      {
        path: "/pattern",
        message: `the pattern is a text of 1 to ${PATTERN_MAX_CHARS} characters`,
      },
    ];
  }
  const problems: Problem[] = [];
  const why = patternProblem(pattern);
  if (why !== undefined) problems.push({ path: "/pattern", message: `the pattern ${why}` });
  if (typeof maxLength === "number" && maxLength > PATTERN_TEXT_MAX_CHARS) {
    problems.push({
      path: "/maxLength",
      message: `a field with a pattern holds at most ${PATTERN_TEXT_MAX_CHARS} characters, and maxLength is ${maxLength}`,
    });
  }
  return problems;
};

const LINE_BREAK = /[\n\r]/;

/**
 * What a schema-valid TextField result still gets wrong against the item's props: more code points
 * than `textFieldLimit` (`maxLength`, else `PATTERN_TEXT_MAX_CHARS` for a field with a pattern,
 * else `TEXT_FIELD_MAX_CHARS`), and a line feed or carriage return in a
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
  const limit = textFieldLimit(props);
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

/**
 * The TextField's field check (form-widget, design decision 2): `required`, then `minLength` in code
 * points. It never reads `pattern`: only the board runs that, so the session process runs no agent
 * pattern on user text. A text that fails it still fits.
 */
export const textFieldFieldCheck = (
  result: unknown,
  props: unknown,
): FieldCheckFailure | undefined => {
  const required = requiredFailure(props, result);
  if (required !== undefined) return required;
  if (typeof result !== "string" || !isRecord(props)) return undefined;
  const { minLength } = props;
  return isWhole(minLength, TEXT_FIELD_MAX_CHARS) && codePointCount(result) < minLength
    ? { code: "min-length", min: minLength }
    : undefined;
};

// The patterns compiled so far, by text, at most `COMPILED_MAX`: the oldest goes first. A pattern
// that does not compile is held as `null` and fails every text. A field's own props object keeps its
// compiled pattern as well (`FIELD_LAST`), so this map only serves props objects it has not seen.
const COMPILED_MAX = 64;
const compiled = new Map<string, RegExp | null>();

const compile = (pattern: string): RegExp | null => {
  try {
    return new RegExp(pattern, "u");
  } catch {
    return null;
  }
};

const compiledPattern = (pattern: string): RegExp | null => {
  const known = compiled.get(pattern);
  if (known !== undefined) return known;
  const regex = compile(pattern);
  if (compiled.size >= COMPILED_MAX) {
    const oldest = compiled.keys().next();
    if (!oldest.done) compiled.delete(oldest.value);
  }
  compiled.set(pattern, regex);
  return regex;
};

// The outcome of each run, by pattern and text, at most `PATTERN_OUTCOMES_MAX`: the least recently
// used goes first. It serves a caller that holds no props object of its own to key on. A `Map`,
// never an object's keys, so no text or pattern is a member name; the key is length-prefixed, so no
// two pairs share one.
export const PATTERN_OUTCOMES_MAX = 64;
const outcomes = new Map<string, boolean>();
let runs = 0;

// The last pattern, compiled pattern, text and outcome of each field, by the field's props object
// (form-widget, design decision 3; review X-1): the board hands every reader the document's own
// objects, so the entry of each field stays however many fields the ask holds, and one keystroke
// costs one run, for the field whose text changed. A `WeakMap` is bounded by the live document, so
// it holds no more than the document does; the object is the key, never a text or a pattern. The
// entry is used only while its pattern and text equal the call's.
type FieldLast = {
  readonly pattern: string;
  readonly regex: RegExp | null;
  text?: string;
  holds?: boolean;
};
const FIELD_LAST = new WeakMap<object, FieldLast>();

/** The pattern runs so far: a seam for tests, which count the runs without touching `RegExp`. */
export const patternRunCount = (): number => runs;

/** Forgets every kept outcome of the bounded memo, for tests. */
export const clearPatternOutcomes = (): void => {
  outcomes.clear();
};

// A `WeakMap` hit refreshes the fallback memo's entry, if it holds one, so a field whose entry
// serves the board is not evicted by another field's typing (review X-1, 5.8).
const touchOutcome = (pattern: string, text: string, holds: boolean): void => {
  const key = `${pattern.length}:${pattern}${text}`;
  if (!outcomes.has(key)) return;
  outcomes.delete(key);
  outcomes.set(key, holds);
};

const runPattern = (pattern: string, regex: RegExp, text: string): boolean => {
  const key = `${pattern.length}:${pattern}${text}`;
  const known = outcomes.get(key);
  if (known !== undefined) {
    outcomes.delete(key);
    outcomes.set(key, known);
    return known;
  }
  runs += 1;
  const holds = regex.test(text);
  if (outcomes.size >= PATTERN_OUTCOMES_MAX) {
    const oldest = outcomes.keys().next();
    if (!oldest.done) outcomes.delete(oldest.value);
  }
  outcomes.set(key, holds);
  return holds;
};

// The field's entry for `pattern`, made when it holds none or holds another pattern's.
const lastOf = (props: object, pattern: string): FieldLast => {
  const known = FIELD_LAST.get(props);
  if (known !== undefined && known.pattern === pattern) return known;
  const made: FieldLast = { pattern, regex: compiledPattern(pattern) };
  FIELD_LAST.set(props, made);
  return made;
};

const patternHolds = (props: object, pattern: string, text: string): boolean => {
  const last = lastOf(props, pattern);
  if (last.regex === null) return false;
  if (last.text === text && last.holds !== undefined) {
    touchOutcome(pattern, text, last.holds);
    return last.holds;
  }
  const holds = runPattern(pattern, last.regex, text);
  last.text = text;
  last.holds = holds;
  return holds;
};

/**
 * The TextField's pattern check, which only the board runs, on the user's text (form-widget, design
 * decision 3): the pattern read with the `u` flag and unanchored, as JSON Schema reads `pattern`.
 * A pattern that does not compile fails, and so does a text over the field's limit
 * (`textFieldLimit`), which never reaches the pattern; a field with no pattern, no text or props that
 * are no TextField's never does. The session process never calls it (NFR-5, AD-8).
 */
export const textFieldPatternFailure = (
  result: unknown,
  props: unknown,
): FieldCheckFailure | undefined => {
  if (typeof result !== "string" || !isRecord(props) || !Object.hasOwn(props, "pattern")) {
    return undefined;
  }
  const { pattern } = props;
  if (typeof pattern !== "string") return undefined;
  // The cap is enforced here, where the pattern would pay for the text: a text over the field's
  // limit fails without running it, whatever the caller held (review X-1).
  if (codePointCount(result) > textFieldLimit(props)) return { code: "pattern" };
  return patternHolds(props, pattern, result) ? undefined : { code: "pattern" };
};
