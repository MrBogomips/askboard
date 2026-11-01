// The items of an ask, or of an `update`'s `add`, checked where a schema cannot reach (ask-lifecycle,
// design decision 2): item IDs unique in the ask, the reserved view-made prefix (F10), areas all or
// none at the top level and never inside an area (FR-2), and per question its option labels unique
// (F5), at most one recommended option, and the room an answer needs.

import { ID_PATTERN, VIEW_ID_PREFIX } from "./constants.ts";
import { ANNOTATION_MAX_CHARS, PREVIEW_MAX_CHARS } from "./lifecycle-limits.ts";
import { CHOICE_LABELS_MAX_CHARS } from "./limits.ts";
import {
  expectedAt,
  isRecord,
  keyOf,
  pointer,
  problemAt,
  type RequestProblem,
  type Segments,
  type Wording,
} from "./problems.ts";

const ID = new RegExp(ID_PATTERN);

/** An ID of the input format's shape. */
export const isId = (value: unknown): value is string =>
  typeof value === "string" && ID.test(value);

export const ID_SHAPE = "an ID of 1 to 64 characters from A-Z, a-z, 0-9, _ and -";
export const text = (max: number) => `text of 1 to ${max} characters`;

/** An item of the request, where it is, and how deep: 0 at the top level, 1 in an area. */
export type Placed = {
  readonly item: Readonly<Record<string, unknown>>;
  readonly at: Segments;
  readonly depth: number;
};

const isArea = (item: unknown): boolean => isRecord(item) && item.type === "area";

// An area's items, when it holds a list of them.
const childrenOf = (item: unknown): readonly unknown[] => {
  const props = isRecord(item) ? item.props : undefined;
  return isArea(item) && isRecord(props) && Array.isArray(props.items) ? props.items : [];
};

/** An item at `at`, then, when it is an area, each of its items. */
export const placedItem = (item: unknown, at: Segments, depth = 0): Placed[] =>
  isRecord(item)
    ? [{ item, at, depth }, ...placedItems(childrenOf(item), [...at, "props", "items"], depth + 1)]
    : [];

/** Each item of a list at `at`, in document order, each area followed by its items. */
export const placedItems = (items: readonly unknown[], at: Segments, depth = 0): Placed[] =>
  items.flatMap((item, index) => placedItem(item, [...at, String(index)], depth));

/**
 * The wording keys of an item's fields by its type, so that an area's fields and a question's read
 * apart: `rest` is the path from the item. A question in an area reads as a question.
 */
export const itemKey = (item: unknown, rest: Segments): string => {
  if (isArea(item) && rest[0] === "props" && rest[1] === "items" && rest.length > 2) {
    if (rest.length === 3) return "area.props.items[]";
    if (rest.length === 4 && rest[3] === "type") return "area.props.items[].type";
    return `question.${keyOf(rest.slice(3))}`;
  }
  const kind = isArea(item) ? "area" : "question";
  return rest.length === 0 ? kind : `${kind}.${keyOf(rest)}`;
};

/** The item a path from an item is in: an area's question when the path enters one. */
export const innerItemOf = (
  item: unknown,
  rest: Segments,
): { readonly item: unknown; readonly rest: Segments } => {
  if (isArea(item) && rest[0] === "props" && rest[1] === "items" && rest.length > 3) {
    const inner = childrenOf(item)[Number(rest[2])];
    if (isRecord(inner) && isId(inner.id)) return { item: inner, rest: rest.slice(3) };
  }
  return { item, rest };
};

/** How a request's wording reads an item's fields, keyed as `itemKey` keys them. */
export const ITEM_EXPECTED: Readonly<Record<string, string>> = {
  question: "an item {type, id, props}: a question, or at the top level an area",
  "question.type": '"question" or "area"',
  "question.id": `${ID_SHAPE}, unique in the ask`,
  "question.props": "a question's props {text, header?, options, multiSelect?, allowOther?}",
  "question.props.text": "non-empty text",
  "question.props.header": "non-empty text",
  "question.props.options":
    "a non-empty list of options, each {label, description?, preview?, annotation?, recommended?}",
  "question.props.options[]":
    "an option {label, description?, preview?, annotation?, recommended?}",
  "question.props.options[].label": "non-empty text, unique within the question",
  "question.props.options[].description": "text",
  "question.props.options[].preview": text(PREVIEW_MAX_CHARS),
  "question.props.options[].annotation": text(ANNOTATION_MAX_CHARS),
  "question.props.options[].recommended": "true, on at most one option of the question",
  "question.props.multiSelect": "true or false",
  "question.props.allowOther": "true or false",
  area: 'an area {type: "area", id, props: {title, items}}',
  "area.id": `${ID_SHAPE}, unique in the ask`,
  "area.props": "an area's props {title, items}",
  "area.props.title": "non-empty text",
  "area.props.items": "a non-empty list of questions",
  "area.props.items[]": 'a question {type: "question", id, props}',
  "area.props.items[].type": '"question": an area holds questions only',
};

/** What each of an item's objects holds, keyed as `itemKey` keys them. */
export const ITEM_FIELDS: Readonly<Record<string, string>> = {
  question: "an item holds only type, id and props",
  "question.props":
    "a question's props hold only text, header, options, multiSelect and allowOther",
  "question.props.options[]":
    "an option holds only label, description, preview, annotation and recommended",
  area: "an area holds only type, id and props",
  "area.props": "an area's props hold only title and items",
  "area.props.items[]": "an item holds only type, id and props",
};

/** Areas inside areas, each named at its type: areas sit only at the top level (FR-2). */
export const nestingProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
): RequestProblem[] =>
  placed
    .filter(({ item, depth }) => depth > 0 && isArea(item))
    .map(({ at }) => {
      const segments = [...at, "type"];
      const message = "{where}: an area cannot hold an area; areas sit only at the top level";
      return problemAt(wording, value, segments, message, expectedAt(wording, segments, value));
    });

/**
 * Top-level items that are not areas when another one is: once one top-level item of an ask is an
 * area, every one is (FR-2). Each is named as a whole, at its place in the list.
 */
export const areaRuleProblems = (items: readonly unknown[], at: Segments): RequestProblem[] => {
  if (!items.some(isArea)) return [];
  return items.flatMap((item, index) => {
    if (isArea(item)) return [];
    const id = isRecord(item) && isId(item.id) ? item.id : undefined;
    const where = id === undefined ? `${keyOf(at)}[${index}]` : `item "${id}"`;
    return [
      {
        path: pointer([...at, String(index)]),
        ...(id === undefined ? {} : { itemId: id }),
        field: keyOf(at),
        expected: "areas only: once one top-level item is an area, every top-level item is one",
        message: `${where}: once one top-level item is an area, every top-level item must be an area; put this question in an area`,
      },
    ];
  });
};

/** Every repeat of an item ID among the items, at the repeat (FR-5). */
export const repeatedIdProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
): RequestProblem[] => {
  const seen = new Set<string>();
  return placed.flatMap(({ item, at }) => {
    if (!isId(item.id)) return [];
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return [];
    }
    const segments = [...at, "id"];
    const message = `{where}: another item of the ask has the ID ${JSON.stringify(item.id)}; item IDs are unique in the ask, areas and their questions included`;
    return [problemAt(wording, value, segments, message, expectedAt(wording, segments, value))];
  });
};

/** IDs that start with the view-made prefix, which only the board makes (finding F10). */
export const reservedPrefixProblems = (
  wording: Wording,
  value: unknown,
  ids: readonly (readonly [Segments, unknown])[],
): RequestProblem[] => {
  const expected = `an ID that does not start with "${VIEW_ID_PREFIX}"`;
  const message = `{where}: the prefix "${VIEW_ID_PREFIX}" is reserved for IDs the board makes`;
  return ids
    .filter(([, id]) => isId(id) && id.startsWith(VIEW_ID_PREFIX))
    .map(([segments]) => problemAt(wording, value, segments, message, expected));
};

/** Each placed item's ID, where it is. */
export const placedIds = (placed: readonly Placed[]): (readonly [Segments, unknown])[] =>
  placed.map(({ item, at }) => [[...at, "id"], item.id] as const);

type Labelled = { readonly index: number; readonly label: string; readonly recommended: boolean };

const optionsOf = (question: Readonly<Record<string, unknown>>): Labelled[] => {
  const props = question.props;
  const options = isRecord(props) && Array.isArray(props.options) ? props.options : [];
  return options.flatMap((option, index) =>
    isRecord(option) && typeof option.label === "string"
      ? [{ index, label: option.label, recommended: option.recommended === true }]
      : [],
  );
};

const quotedList = (labels: readonly string[]): string => {
  const quoted = labels.map((label) => JSON.stringify(label));
  return quoted.length < 2
    ? quoted.join("")
    : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
};

// One question's labels: each unique, all within the room an answer needs, one recommended at most.
const questionProblems = (
  wording: Wording,
  value: unknown,
  { item, at }: Placed,
): RequestProblem[] => {
  const options = optionsOf(item);
  const optionAt = (index: number, field: string) => [
    ...at,
    "props",
    "options",
    String(index),
    field,
  ];
  const problems: RequestProblem[] = [];
  const seen = new Set<string>();
  for (const { index, label } of options) {
    if (seen.has(label)) {
      const segments = optionAt(index, "label");
      const message = `{where}: the label ${JSON.stringify(label)} is repeated; option labels are unique within a question, since an answer names its options by label`;
      problems.push(
        problemAt(wording, value, segments, message, expectedAt(wording, segments, value)),
      );
    }
    seen.add(label);
  }
  const room = JSON.stringify(options.map(({ label }) => label)).length;
  if (room > CHOICE_LABELS_MAX_CHARS) {
    const message = `{where}: the option labels take ${room} characters as a JSON list, more than the ${CHOICE_LABELS_MAX_CHARS} an answer can carry; shorten them`;
    const expected = `options whose labels take at most ${CHOICE_LABELS_MAX_CHARS} characters`;
    problems.push(problemAt(wording, value, [...at, "props", "options"], message, expected));
  }
  const recommended = options.filter((option) => option.recommended);
  const [, second] = recommended;
  if (second !== undefined) {
    const segments = optionAt(second.index, "recommended");
    const labels = quotedList(recommended.map(({ label }) => label));
    const message = `{where}: the options ${labels} are recommended; at most one option of a question is recommended`;
    problems.push(
      problemAt(wording, value, segments, message, expectedAt(wording, segments, value)),
    );
  }
  return problems;
};

/** The label checks of every question among the items. */
export const labelProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
): RequestProblem[] =>
  placed
    .filter(({ item }) => item.type === "question")
    .flatMap((entry) => questionProblems(wording, value, entry));
