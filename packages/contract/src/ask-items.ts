// The items of an ask, or of an `update`'s `add`, checked where a schema cannot reach (ask-lifecycle,
// design decision 2): item IDs unique in the ask, the reserved view-made prefix (F10), areas all or
// none at the top level and never inside an area (FR-2), and per question its option labels unique
// (F5), at most one recommended option, and the room an answer needs. Since input format 1.2 a
// question's context items are walked too, so their IDs follow the same rules (excerpts, design
// decision 2).

import { ID_PATTERN, VIEW_ID_PREFIX } from "./constants.ts";
import {
  CONTEXT_TITLE_MAX_CHARS,
  IMAGE_ALT_MAX_CHARS,
  POINTER_MAX_CHARS,
  URL_MAX_CHARS,
} from "./context/limits.ts";
import { ANNOTATION_MAX_CHARS, PREVIEW_MAX_CHARS } from "./lifecycle-limits.ts";
import { CHOICE_LABELS_MAX_CHARS } from "./limits.ts";
import {
  isLayoutType,
  LAYOUT_MAX_DEPTH,
  layoutDepthProblem,
  layoutListsOf,
  nestedItemsOf,
} from "./nested-items.ts";
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
import { widgetRest } from "./widgets/paths.ts";
import { CONTEXT_ONLY_ITEM_TYPES, WIDGET_TYPES, type WidgetType } from "./widgets/registry.ts";
import { ID_SHAPE, text } from "./widgets/wording-parts.ts";

export { ID_SHAPE, text };

const ID = new RegExp(ID_PATTERN);

/** An ID of the input format's shape. */
export const isId = (value: unknown): value is string =>
  typeof value === "string" && ID.test(value);

/** An item of the request, where it is, and how deep: 0 at the top level, 1 in an area. */
export type Placed = {
  readonly item: Readonly<Record<string, unknown>>;
  readonly at: Segments;
  readonly depth: number;
  /** Set on an item of a question's `items`, at any depth of its layouts. */
  readonly inQuestion?: true;
  /** Where the question that holds the item sits, on an item with `inQuestion`. */
  readonly questionAt?: Segments;
};

const isArea = (item: unknown): boolean => isRecord(item) && item.type === "area";
const isQuestion = (item: unknown): boolean => isRecord(item) && item.type === "question";

// The list of items an item's props hold, if any.
const listOf = (item: unknown): readonly unknown[] => {
  const props = isRecord(item) ? item.props : undefined;
  return isRecord(props) && Array.isArray(props.items) ? props.items : [];
};

// An area's items, when it holds a list of them.
const childrenOf = (item: unknown): readonly unknown[] => (isArea(item) ? listOf(item) : []);

// A question's items, when it holds a list of them.
const contextOf = (item: unknown): readonly unknown[] => (isQuestion(item) ? listOf(item) : []);

/**
 * The item types a question's `items` hold: context (excerpts, design decision 2), the registry's
 * widgets, in its order, and the molecule reference (widget-registry, design decision 3).
 */
export const contextItemTypes = (
  types: readonly WidgetType[] = WIDGET_TYPES,
): readonly string[] => [...CONTEXT_ONLY_ITEM_TYPES, ...types.map(({ type }) => type), "molecule"];

/** The item types a question's `items` hold, of the shipped registry. */
export const CONTEXT_ITEM_TYPES: readonly string[] = contextItemTypes();

// A question's items, each where it is, and, after each layout, the items it holds at every depth
// (layouts, design decision 4). An area or a question among them is left to the schema, which
// refuses it at its type, rather than named as a nested area or checked as a question.
const placedContext = (question: unknown, at: Segments, depth: number): Placed[] =>
  nestedItemsOf(contextOf(question), [...at, "props", "items"]).flatMap((entry) =>
    isRecord(entry.item) && !isArea(entry.item) && !isQuestion(entry.item)
      ? [
          {
            item: entry.item,
            at: entry.path,
            depth: depth + 1 + entry.depth,
            inQuestion: true as const,
            questionAt: at,
          },
        ]
      : [],
  );

/** An item at `at`, then each of its items: an area's questions, or a question's items. */
export const placedItem = (item: unknown, at: Segments, depth = 0): Placed[] =>
  isRecord(item)
    ? [
        { item, at, depth },
        ...placedItems(childrenOf(item), [...at, "props", "items"], depth + 1),
        ...placedContext(item, at, depth),
      ]
    : [];

/** Each item of a list at `at`, in document order, each area followed by its items. */
export const placedItems = (items: readonly unknown[], at: Segments, depth = 0): Placed[] =>
  items.flatMap((item, index) => placedItem(item, [...at, String(index)], depth));

// Whether a path from an item goes into one of its items' own fields, past `props.items[n]`.
const entersItem = (rest: Segments): boolean =>
  rest[0] === "props" && rest[1] === "items" && rest.length > 3;

// A question's fields, and its items' own fields by their type (`excerpt.props.pointer`), once the
// type is one the input format defines, at any depth of its layouts (`number-field.props.max`);
// anything else reads as the question's.
const questionKey = (question: unknown, rest: Segments, types: readonly WidgetType[]): string => {
  if (entersItem(rest) && !(rest.length === 4 && rest[3] === "type")) {
    const inner = innerItemOf(question, rest);
    const type = isRecord(inner.item) ? inner.item.type : undefined;
    if (
      inner.item !== question &&
      typeof type === "string" &&
      contextItemTypes(types).includes(type)
    ) {
      return `${type}.${keyOf(widgetRest(type, inner.rest, types))}`;
    }
  }
  return rest.length === 0 ? "question" : `question.${keyOf(rest)}`;
};

/**
 * The wording keys of an item's fields by its type, so that an area's fields and a question's read
 * apart: `rest` is the path from the item. A question in an area reads as a question, and a
 * question's item, at any depth of its layouts, by its own type.
 */
export const itemKey = (
  item: unknown,
  rest: Segments,
  types: readonly WidgetType[] = WIDGET_TYPES,
): string => {
  if (isArea(item) && rest[0] === "props" && rest[1] === "items" && rest.length > 2) {
    if (rest.length === 3) return "area.props.items[]";
    if (rest.length === 4 && rest[3] === "type") return "area.props.items[].type";
    return questionKey(childrenOf(item)[Number(rest[2])], rest.slice(3), types);
  }
  if (isArea(item)) return rest.length === 0 ? "area" : `area.${keyOf(rest)}`;
  return questionKey(item, rest, types);
};

// The item a path from a layout enters, and the path from it: through the list the path names,
// when it goes past the item's type; nothing when it stays at the layout or at its list's item.
const enterLayout = (
  layout: unknown,
  rest: Segments,
): { readonly item: unknown; readonly rest: Segments } | undefined => {
  for (const list of layoutListsOf(layout)) {
    const length = list.path.length;
    if (!list.path.every((segment, at) => rest[at] === segment)) continue;
    const after = rest.slice(length + 1);
    if (after.length === 0 || (after.length === 1 && after[0] === "type")) return undefined;
    const inner = list.items[Number(rest[length])];
    return isRecord(inner) && isId(inner.id) ? { item: inner, rest: after } : undefined;
  }
  return undefined;
};

/**
 * The item a path from an item is in: an area's question when the path enters one, a question's
 * item when it enters one in turn, and an item of a layout, at any depth, when it enters that.
 */
export const innerItemOf = (
  item: unknown,
  rest: Segments,
): { readonly item: unknown; readonly rest: Segments } => {
  if (isRecord(item) && isLayoutType(item.type)) {
    const entered = enterLayout(item, rest);
    return entered === undefined ? { item, rest } : innerItemOf(entered.item, entered.rest);
  }
  if (!entersItem(rest)) return { item, rest };
  const inner = (isArea(item) ? childrenOf(item) : contextOf(item))[Number(rest[2])];
  if (!isRecord(inner) || !isId(inner.id)) return { item, rest };
  return innerItemOf(inner, rest.slice(3));
};

const POINTER = `a pointer of 1 to ${POINTER_MAX_CHARS} characters, path#anchor: a path from the project's root, then # and L<start>-L<end>, a heading or an ID`;

/** A web reference's URL, in words (excerpts, design decision 2). */
export const WEB_URL = `an absolute http or https URL of at most ${URL_MAX_CHARS} characters, with a host and no user name or password`;

// `"a", "b" or "c"`: the item types in words.
const orList = (types: readonly string[]): string => {
  const quoted = types.map((type) => JSON.stringify(type));
  return `${quoted.slice(0, -1).join(", ")} or ${quoted.at(-1)}`;
};

// A question's item list in words: context, the registry's widgets and, when it holds layouts, the
// layouts apart from the widgets (layouts, design decision 4).
const itemsExpected = (types: readonly WidgetType[]): string => {
  const layouts = types.filter(({ type }) => isLayoutType(type)).map(({ noun }) => noun);
  const widgets = [
    ...types.filter(({ type }) => !isLayoutType(type)).map(({ noun }) => noun),
    "a molecule reference",
  ];
  const held = layouts.length === 0 ? "" : `, and layouts (${layouts.join(", ")})`;
  return `a non-empty list of the question's items: context (excerpts, references, images) and widgets (${widgets.join(", ")})${held}`;
};

/**
 * How a request's wording reads an item's fields, keyed as `itemKey` keys them: the item types a
 * question's items hold and the ID line of each are those of the registry (widget-registry,
 * design decision 3).
 */
export const itemExpected = (
  types: readonly WidgetType[] = WIDGET_TYPES,
): Readonly<Record<string, string>> => ({
  question: "an item {type, id, props}: a question, or at the top level an area",
  "question.type": '"question" or "area"',
  "question.id": `${ID_SHAPE}, unique in the ask`,
  "question.props":
    "a question's props {text, header?, options?, multiSelect?, allowOther?, items?}: options, items or both",
  "question.props.text": "non-empty text",
  "question.props.header": "non-empty text",
  "question.props.options":
    "a non-empty list of options, each {label, description?, preview?, previewFormat?, annotation?, recommended?}",
  "question.props.options[]":
    "an option {label, description?, preview?, previewFormat?, annotation?, recommended?}",
  "question.props.options[].label": "non-empty text, unique within the question",
  "question.props.options[].description": "text",
  "question.props.options[].preview": text(PREVIEW_MAX_CHARS),
  "question.props.options[].previewFormat":
    '"plain" (the default) or "markdown", only beside a preview',
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
  // A question's items (excerpts, design decision 2).
  "question.props.items": itemsExpected(types),
  "question.props.items[]": `an item {type, id, props} whose type is ${orList(contextItemTypes(types))}`,
  "question.props.items[].type": orList(contextItemTypes(types)),
  "excerpt.id": `${ID_SHAPE}, unique in the ask`,
  "excerpt.props":
    "an excerpt's props {pointer, title?} or {text, title?}: exactly one of pointer and text",
  "excerpt.props.pointer": `${POINTER} with an anchor`,
  "excerpt.props.text": "non-empty text, shown as source text",
  "excerpt.props.title": text(CONTEXT_TITLE_MAX_CHARS),
  "reference.id": `${ID_SHAPE}, unique in the ask`,
  "reference.props":
    "a reference's props {pointer, title?} or {url, title?}: exactly one of pointer and url",
  "reference.props.pointer": `${POINTER}; without an anchor the file opens at its top`,
  "reference.props.url": WEB_URL,
  "reference.props.title": text(CONTEXT_TITLE_MAX_CHARS),
  "image.id": `${ID_SHAPE}, unique in the ask`,
  "image.props": "an image's props {pointer, alt}",
  "image.props.pointer": `${POINTER} to a PNG, JPEG, GIF or WebP file, with no anchor`,
  "image.props.alt": text(IMAGE_ALT_MAX_CHARS),
  // A question's widget items (widget-answers, design decision 4); `widgets/wording.ts` words
  // their props, which `requests.ts` and `update-request.ts` add to these tables.
  ...Object.fromEntries(
    [...types.map(({ type }) => type), "molecule"].map((type) => [
      `${type}.id`,
      `${ID_SHAPE}, unique in the ask`,
    ]),
  ),
});

/** How a request's wording reads an item's fields, of the shipped registry. */
export const ITEM_EXPECTED: Readonly<Record<string, string>> = itemExpected();

/** What each of an item's objects holds, keyed as `itemKey` keys them. */
export const ITEM_FIELDS: Readonly<Record<string, string>> = {
  question: "an item holds only type, id and props",
  "question.props":
    "a question's props hold only text, header, options, multiSelect, allowOther and items",
  "question.props.items[]": "an item holds only type, id and props",
  "excerpt.props": "an excerpt's props hold only pointer, text and title",
  "reference.props": "a reference's props hold only pointer, url and title",
  "image.props": "an image's props hold only pointer and alt",
  "question.props.options[]":
    "an option holds only label, description, preview, previewFormat, annotation and recommended",
  area: "an area holds only type, id and props",
  "area.props": "an area's props hold only title and items",
  "area.props.items[]": "an item holds only type, id and props",
};

// The first layout past the depth bound among a question's items, or an area's questions'.
const questionDepthProblem = (question: unknown, at: Segments) =>
  layoutDepthProblem(contextOf(question), [...at, "props", "items"]);

/**
 * The first layout, in document order, that nests more than `LAYOUT_MAX_DEPTH` deep inside `item`,
 * an ask's top-level item or one an update adds, at `place` (layouts, design decision 3), worded
 * as a problem of the request. The check runs before the schema, and stops at the first, so a
 * request nested without end is refused and never walked (AD-10).
 */
export const layoutDepthItemProblem = (
  wording: Wording,
  value: unknown,
  item: unknown,
  place: Segments,
): RequestProblem | undefined => {
  const found = isArea(item)
    ? childrenOf(item)
        .map((question, each) =>
          questionDepthProblem(question, [...place, "props", "items", String(each)]),
        )
        .find((problem) => problem !== undefined)
    : questionDepthProblem(item, place);
  if (found === undefined) return undefined;
  // At the layout's props: a path that ends at its type would name the layout that holds it.
  const segments = [...found.path, "props"];
  const message = `{where}: layouts nest at most ${LAYOUT_MAX_DEPTH} deep, and this one sits ${found.depth} deep; arrange the items in fewer layers, or split them across questions`;
  return problemAt(
    wording,
    value,
    segments,
    message,
    `layouts nested at most ${LAYOUT_MAX_DEPTH} deep`,
  );
};

/** `layoutDepthItemProblem` over a list of items at `at`: the first problem. */
export const layoutDepthRequestProblem = (
  wording: Wording,
  value: unknown,
  items: readonly unknown[],
  at: Segments,
): RequestProblem | undefined => {
  for (const [index, item] of items.entries()) {
    const found = layoutDepthItemProblem(wording, value, item, [...at, String(index)]);
    if (found !== undefined) return found;
  }
  return undefined;
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

type Labelled = {
  readonly index: number;
  readonly label: string;
  readonly recommended: boolean;
  /** The option has `previewFormat` and no `preview` (atoms). */
  readonly formatWithoutPreview: boolean;
};

const optionsOf = (question: Readonly<Record<string, unknown>>): Labelled[] => {
  const props = question.props;
  const options = isRecord(props) && Array.isArray(props.options) ? props.options : [];
  return options.flatMap((option, index) =>
    isRecord(option) && typeof option.label === "string"
      ? [
          {
            index,
            label: option.label,
            recommended: option.recommended === true,
            formatWithoutPreview:
              option.previewFormat !== undefined && option.preview === undefined,
          },
        ]
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
  for (const { index, label } of options.filter((option) => option.formatWithoutPreview)) {
    const segments = optionAt(index, "previewFormat");
    const message = `{where}: the option ${JSON.stringify(label)} has a previewFormat and no preview; the format describes a preview`;
    problems.push(
      problemAt(wording, value, segments, message, expectedAt(wording, segments, value)),
    );
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

// A question holds options, items or both (F1; widget-answers, input format 1.4).
const emptyQuestionProblems = (
  wording: Wording,
  value: unknown,
  { item, at }: Placed,
): RequestProblem[] => {
  const props = item.props;
  if (!isRecord(props) || "options" in props || "items" in props) return [];
  const message =
    "{where}: a question needs options, items or both, and this one has neither; add options to choose from, or items such as a Tree";
  return [
    problemAt(
      wording,
      value,
      [...at, "props"],
      message,
      expectedAt(wording, [...at, "props"], value),
    ),
  ];
};

/** The label checks of every question among the items. */
export const labelProblems = (
  wording: Wording,
  value: unknown,
  placed: readonly Placed[],
): RequestProblem[] =>
  placed
    .filter(({ item }) => item.type === "question")
    .flatMap((entry) => [
      ...emptyQuestionProblems(wording, value, entry),
      ...questionProblems(wording, value, entry),
    ]);
