// The Document review's result rules (document-review, design decision 3): the result's shape in
// plain code, the schema's rule restated for the board page, and what a result still gets wrong
// against the item's props. Plain ECMAScript with no JSON and no Ajv, and no regular expression
// over any text: every bound counts code points by a loop that stops at the bound, and every ID
// goes in a `Set`, so a name every object inherits (`__proto__`, `constructor`) is an ID like any
// other and is refused for its missing prefix. Nothing here throws on a value it cannot read.

import { VIEW_ID_PREFIX } from "../../constants.ts";
import { ANNOTATION_MAX_CHARS, ANNOTATION_REPLACEMENT_MAX_CHARS } from "../../lifecycle-limits.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { refusedCharacter } from "./checks.ts";
import { DOCUMENT_REVIEW_ANNOTATIONS_MAX } from "./constants.ts";

const ID_MAX_CHARS = 64;
const CONTEXT_MAX_CHARS = 200;

// Whether `text` holds at least `min` and at most `max` code points: counted up to `max` + 1.
const holds = (text: unknown, min: number, max: number): text is string => {
  if (typeof text !== "string") return false;
  let count = 0;
  for (const _ of text) {
    count += 1;
    if (count > max) return false;
  }
  return count >= min;
};

const idCharacter = (code: number): boolean =>
  (code >= 0x30 && code <= 0x39) ||
  (code >= 0x41 && code <= 0x5a) ||
  (code >= 0x61 && code <= 0x7a) ||
  code === 0x5f ||
  code === 0x2d;

// An element ID, the schema's `urn:askboard:input:id`: 1 to 64 of A-Z, a-z, 0-9, _ and -.
const isId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 1 &&
  value.length <= ID_MAX_CHARS &&
  [...value].every((character) => idCharacter(character.codePointAt(0) ?? 0));

// Whether the keys of `value` are all in `allowed` and each in `required` is present.
const hasKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  allowed: readonly string[],
): boolean =>
  Object.keys(value).every((key) => allowed.includes(key)) &&
  required.every((key) => Object.hasOwn(value, key));

const isQuote = (selector: unknown): boolean =>
  isRecord(selector) &&
  hasKeys(selector, ["type", "exact"], ["type", "exact", "prefix", "suffix"]) &&
  selector.type === "quote" &&
  holds(selector.exact, 1, ANNOTATION_MAX_CHARS) &&
  (selector.prefix === undefined || holds(selector.prefix, 0, CONTEXT_MAX_CHARS)) &&
  (selector.suffix === undefined || holds(selector.suffix, 0, CONTEXT_MAX_CHARS));

const isBody = (body: unknown): boolean =>
  isRecord(body) &&
  Object.keys(body).length >= 1 &&
  hasKeys(body, [], ["text", "replacement"]) &&
  (body.text === undefined || holds(body.text, 1, ANNOTATION_MAX_CHARS)) &&
  (body.replacement === undefined || holds(body.replacement, 0, ANNOTATION_REPLACEMENT_MAX_CHARS));

const isAnnotation = (annotation: unknown): boolean =>
  isRecord(annotation) &&
  hasKeys(annotation, ["id", "target", "body"], ["id", "target", "body"]) &&
  isId(annotation.id) &&
  isRecord(annotation.target) &&
  hasKeys(annotation.target, ["selector"], ["selector"]) &&
  isQuote(annotation.target.selector) &&
  isBody(annotation.body);

/**
 * Whether `result` has the shape of a Document review's result, the schema's rule in plain code:
 * `annotations` alone, a list of 1 to 100 annotations, each with an ID, a quote selector alone as
 * its target and a body of a comment, a replacement or both. That the annotations are the item's
 * own is the problems' check.
 */
export const documentReviewResultShape = (result: unknown): boolean => {
  if (!isRecord(result)) return false;
  const keys = Object.keys(result);
  const { annotations } = result;
  return (
    keys.length === 1 &&
    keys[0] === "annotations" &&
    Array.isArray(annotations) &&
    annotations.length >= 1 &&
    annotations.length <= DOCUMENT_REVIEW_ANNOTATIONS_MAX &&
    annotations.every(isAnnotation)
  );
};

// An ID as a message shows it: quoted, and cut where the schema would have refused it.
const named = (id: unknown): string =>
  `annotation ${JSON.stringify(String(id).slice(0, ID_MAX_CHARS))}`;

// The problems of one annotation, `seen` holding the IDs before it; a value the shape refuses
// gives nothing here (the schema's problem stands).
const annotationProblems = (
  annotation: unknown,
  index: number,
  length: number,
  seen: Set<string>,
): Problem[] => {
  if (!isRecord(annotation) || typeof annotation.id !== "string") return [];
  const { id } = annotation;
  const who = named(id);
  const at = (field: string, message: string): Problem => ({
    path: `/annotations/${index}${field}`,
    message: `${who} ${message}`,
  });
  const problems: Problem[] = [];
  if (!id.startsWith(VIEW_ID_PREFIX)) {
    problems.push(
      at("/id", `has an ID the board did not make: the board's IDs start with ${VIEW_ID_PREFIX}`),
    );
  }
  if (seen.has(id))
    problems.push(at("/id", "is named twice: each annotation has an ID of its own"));
  seen.add(id);
  const selector = isRecord(annotation.target) ? annotation.target.selector : undefined;
  if (!isRecord(selector)) return problems;
  if (selector.type !== "quote") {
    problems.push(
      at(
        "/target/selector",
        `has a ${JSON.stringify(String(selector.type).slice(0, 20))} selector, and a Document review takes quotes`,
      ),
    );
    return problems;
  }
  for (const field of ["exact", "prefix", "suffix"] as const) {
    const value = selector[field];
    const refused = typeof value === "string" ? refusedCharacter(value) : undefined;
    if (refused !== undefined) {
      problems.push(
        at(
          `/target/selector/${field}`,
          `holds the control character ${refused}, which no document holds`,
        ),
      );
    }
  }
  const { exact } = selector;
  if (typeof exact === "string") {
    if (exact.trim() === "") {
      problems.push(at("/target/selector/exact", "quotes white space only"));
    } else if (length >= 0 && !holds(exact, 0, length)) {
      problems.push(
        at(
          "/target/selector/exact",
          `quotes more than the document holds: it is longer than the document`,
        ),
      );
    }
  }
  const body = annotation.body;
  if (isRecord(body) && typeof body.replacement === "string" && body.replacement === exact) {
    problems.push(
      at("/body/replacement", "suggests the passage as it is: the replacement changes nothing"),
    );
  }
  return problems;
};

// The document's length in code points, or -1 when the props hold no document.
const documentLength = (props: unknown): number => {
  const markdown = isRecord(props) ? props.markdown : undefined;
  if (typeof markdown !== "string") return -1;
  let count = 0;
  for (const _ of markdown) count += 1;
  return count;
};

/**
 * What a schema-valid Document review result still gets wrong against the item's props: an ID
 * that does not start with `u-` or is held twice, a selector that is not a quote, an `exact` of
 * white space only, longer than the document or holding a character the document refuses (as do
 * `prefix` and `suffix`), and a replacement equal to its `exact`. Props that hold no document
 * refuse the result, since nothing can check it.
 */
export const documentReviewResultProblems = (
  result: unknown,
  props: unknown,
): readonly Problem[] => {
  const length = documentLength(props);
  if (length < 0) {
    return [
      {
        path: "/",
        message: "the item's props are no Document review's, so its annotations cannot be checked",
      },
    ];
  }
  const annotations =
    isRecord(result) && Array.isArray(result.annotations) ? result.annotations : [];
  const seen = new Set<string>();
  return annotations.flatMap((annotation: unknown, index) =>
    annotationProblems(annotation, index, length, seen),
  );
};
