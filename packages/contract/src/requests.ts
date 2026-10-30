// Validation of tool requests against the contract (AD-6, AD-7). The server validates every request
// here. Checks a schema cannot express report like schema errors: the reserved view-made prefix
// (F10), unique option labels (F5), the room an answer needs, cursors and each ask once in a
// collect.

import { schemaErrors } from "./compiled.ts";
import { ASK_TITLE_MAX_CHARS, ID_PATTERN, VIEW_ID_PREFIX } from "./constants.ts";
import { CHOICE_LABELS_MAX_CHARS, CURSOR_PATTERN, NAME_MAX_CHARS } from "./limits.ts";
import {
  expectedAt,
  inDocumentOrder,
  isRecord,
  type Located,
  located,
  problemAt,
  type RequestProblem,
  type Segments,
  schemaProblem,
  type Wording,
} from "./problems.ts";
import type { AskInput } from "./schemas/input/index.ts";
import type { CollectRequest, ToolDefinition } from "./schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "./sets.ts";

export type { RequestProblem } from "./problems.ts";

export type CheckedRequest<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: "schema";
      readonly problems: readonly RequestProblem[];
    };

/** A waiting collect's target: an item of one of the asks it passes (AD-4). */
export type CollectWait = NonNullable<CollectRequest["wait"]>;

const ID = new RegExp(ID_PATTERN);
const CURSOR = new RegExp(CURSOR_PATTERN);
const ID_SHAPE = "an ID of 1 to 64 characters from A-Z, a-z, 0-9, _ and -";
const text = (max: number) => `text of 1 to ${max} characters`;
const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

const itemsOf = (ask: unknown): readonly unknown[] =>
  isRecord(ask) && Array.isArray(ask.items) ? ask.items : [];

const ASK: Wording = {
  root: "(the ask)",
  expected: {
    "": "an ask: an object {askId, items} with the optional title, agentName, expectedUser, presentation, delivery, language and locale",
    askId: ID_SHAPE,
    title: text(ASK_TITLE_MAX_CHARS),
    agentName: text(NAME_MAX_CHARS),
    expectedUser: text(NAME_MAX_CHARS),
    presentation: '"sections", "tabs" or "one-per-view"',
    delivery: '"immediate" or "submitted"',
    language: '"en-US", the only language AskBoard supports for now',
    locale: '"en-US", the only locale AskBoard supports for now',
    items: "a list of one item of type question: one question per ask is accepted for now",
    "items[]": "an item {type, id, props}",
    "items[].type": '"question", the only item type AskBoard accepts for now',
    "items[].id": `${ID_SHAPE}, unique in the ask`,
    "items[].props": "a question's props {text, header?, options, multiSelect?}",
    "items[].props.text": "non-empty text",
    "items[].props.header": "non-empty text",
    "items[].props.options": "a non-empty list of options, each {label, description?}",
    "items[].props.options[]": "an option {label, description?}",
    "items[].props.options[].label": "non-empty text, unique within the question",
    "items[].props.options[].description": "text",
    "items[].props.multiSelect": "true or false",
  },
  fields: {
    "": "an ask holds only askId, title, agentName, expectedUser, presentation, delivery, language, locale and items",
    "items[]": "an item holds only type, id and props",
    "items[].props": "a question's props hold only text, header, options and multiSelect",
    "items[].props.options[]": "an option holds only label and description",
  },
  itemOf: (ask, segments) => {
    if (segments[0] !== "items" || segments.length < 3) return undefined;
    const item = itemsOf(ask)[Number(segments[1])];
    const id = isRecord(item) ? item.id : undefined;
    return isId(id) ? { itemId: id, rest: segments.slice(2) } : undefined;
  },
};

// Only the first item is a question E1 accepts: a later item is refused as a whole, and an item of
// a type the input format does not define is refused for its type alone, since its props follow
// another type's shape and their problems would only mislead.
const keptForAsk = (ask: unknown) => {
  const [first] = itemsOf(ask);
  const foreign = isRecord(first) && typeof first.type === "string" && first.type !== "question";
  return ({ segments, kind }: Located): boolean => {
    if (segments[0] !== "items") return true;
    if (segments.length === 1) return kind !== "invalid" || itemsOf(ask).length <= 1;
    if (segments[1] !== "0") return false;
    return !foreign || (segments.length === 3 && segments[2] === "type");
  };
};

const extraItemProblems = (ask: unknown): RequestProblem[] =>
  itemsOf(ask)
    .slice(1)
    .map((item, offset) => {
      const index = String(offset + 1);
      const id = isRecord(item) && isId(item.id) ? item.id : undefined;
      const where = id === undefined ? `items[${index}]` : `item "${id}"`;
      return {
        path: `/items/${index}`,
        ...(id === undefined ? {} : { itemId: id }),
        field: "items",
        expected: expectedAt(ASK, ["items"]),
        message: `${where}: one question per ask is accepted for now; send this question in another ask`,
      };
    });

const reservedPrefixProblems = (ask: unknown): RequestProblem[] => {
  const [item] = itemsOf(ask);
  const ids: [Segments, unknown][] = [
    [["askId"], isRecord(ask) ? ask.askId : undefined],
    [["items", "0", "id"], isRecord(item) ? item.id : undefined],
  ];
  const expected = `an ID that does not start with "${VIEW_ID_PREFIX}"`;
  const message = `{where}: the prefix "${VIEW_ID_PREFIX}" is reserved for IDs the board makes`;
  return ids
    .filter(([, id]) => isId(id) && id.startsWith(VIEW_ID_PREFIX))
    .map(([segments]) => problemAt(ASK, ask, segments, message, expected));
};

const labelProblems = (ask: unknown): RequestProblem[] => {
  const [question] = itemsOf(ask);
  const props = isRecord(question) ? question.props : undefined;
  const options = isRecord(props) && Array.isArray(props.options) ? props.options : [];
  const labels = options
    .map((option, index) => ({ index, label: isRecord(option) ? option.label : undefined }))
    .filter((entry): entry is { index: number; label: string } => typeof entry.label === "string");
  const problems: RequestProblem[] = [];
  const seen = new Set<string>();
  for (const { index, label } of labels) {
    if (seen.has(label)) {
      const segments = ["items", "0", "props", "options", String(index), "label"];
      const message = `{where}: the label ${JSON.stringify(label)} is repeated; option labels are unique within a question, since an answer names its options by label`;
      problems.push(problemAt(ASK, ask, segments, message, expectedAt(ASK, segments)));
    }
    seen.add(label);
  }
  const room = JSON.stringify(labels.map(({ label }) => label)).length;
  if (room > CHOICE_LABELS_MAX_CHARS) {
    const message = `{where}: the option labels take ${room} characters as a JSON list, more than the ${CHOICE_LABELS_MAX_CHARS} an answer can carry; shorten them`;
    const expected = `options whose labels take at most ${CHOICE_LABELS_MAX_CHARS} characters`;
    problems.push(problemAt(ASK, ask, ["items", "0", "props", "options"], message, expected));
  }
  return problems;
};

/**
 * Validates an `ask` request against the input format: the schema, then the checks it cannot
 * express. The input format refines the `ask` tool's generic schema, so a request it accepts
 * passes that schema too.
 */
export const validateAskRequest = (value: unknown): CheckedRequest<AskInput> => {
  const keep = keptForAsk(value);
  const problems = [
    ...schemaErrors(SCHEMA_IDS.ask, value)
      .map(located)
      .filter(keep)
      .map((entry) => schemaProblem(ASK, value, entry)),
    ...extraItemProblems(value),
    ...reservedPrefixProblems(value),
    ...labelProblems(value),
  ];
  if (problems.length === 0) return { ok: true, value: value as AskInput };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};

const COLLECT: Wording = {
  root: "(the request)",
  expected: {
    "": "a collect request: an object {asks, wait?}",
    asks: "a non-empty list of {askId, after}, one entry per ask",
    "asks[]": "an entry {askId, after}",
    "asks[].askId": ID_SHAPE,
    "asks[].after": "the latest cursor <epoch>.<seq> you received for that ask",
    wait: "{askId, itemId}: the ask and the item to wait for",
    "wait.askId": "the ID of one of the asks you pass",
    "wait.itemId": "the ID of an item of that ask",
  },
  fields: {
    "": "collect takes only asks and wait",
    "asks[]": "an entry holds only askId and after",
    wait: "wait holds only askId and itemId",
  },
};

const isCursor = (value: string): boolean =>
  CURSOR.test(value) && Number.isSafeInteger(Number(value.slice(value.indexOf(".") + 1)));

const entryProblems = (request: unknown): RequestProblem[] => {
  const asks = isRecord(request) && Array.isArray(request.asks) ? request.asks : [];
  const problems: RequestProblem[] = [];
  const seen = new Set<string>();
  asks.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const { askId, after } = entry;
    if (typeof after === "string" && !isCursor(after)) {
      const segments = ["asks", String(index), "after"];
      const expected = expectedAt(COLLECT, segments);
      problems.push(problemAt(COLLECT, request, segments, `{where} must be ${expected}`, expected));
    }
    if (typeof askId !== "string") return;
    if (seen.has(askId)) {
      const segments = ["asks", String(index), "askId"];
      const message = `{where}: the ask ${JSON.stringify(askId)} is passed twice; pass each ask once, with the latest cursor you received for it`;
      problems.push(problemAt(COLLECT, request, segments, message, expectedAt(COLLECT, ["asks"])));
    }
    seen.add(askId);
  });
  return problems;
};

const waitProblems = (request: unknown): RequestProblem[] => {
  const wait = isRecord(request) ? request.wait : undefined;
  if (!isRecord(wait)) return [];
  const asks = isRecord(request) && Array.isArray(request.asks) ? request.asks : [];
  const passed = new Set(asks.map((entry) => (isRecord(entry) ? entry.askId : undefined)));
  const problems: RequestProblem[] = [];
  const at = (field: string) => {
    const segments = ["wait", field];
    const expected = expectedAt(COLLECT, segments);
    problems.push(problemAt(COLLECT, request, segments, `{where} must be ${expected}`, expected));
  };
  if (typeof wait.askId === "string" && !passed.has(wait.askId)) at("askId");
  if (typeof wait.itemId === "string" && !isId(wait.itemId)) at("itemId");
  return problems;
};

/**
 * Validates a `collect` request against its envelope, then checks each cursor's shape, that each
 * ask is passed once and that a wait names one of the asks passed.
 */
export const validateCollectRequest = (value: unknown): CheckedRequest<CollectRequest> => {
  const problems = [
    ...schemaErrors(SCHEMA_IDS.collectRequest, value)
      .map(located)
      .map((entry) => schemaProblem(COLLECT, value, entry)),
    ...entryProblems(value),
    ...waitProblems(value),
  ];
  if (problems.length === 0) return { ok: true, value: value as CollectRequest };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};

const PROPERTY_NAME = /^[A-Za-z0-9_.-]{1,64}$/;
const ROOT_COMBINATORS = ["oneOf", "anyOf", "allOf"];

/**
 * AD-6's rule on tool inputs: an object input schema with no root `anyOf`, `oneOf` or `allOf`,
 * whose top-level property names are 1 to 64 characters from `[A-Za-z0-9_.-]`.
 */
export const toolInputProblems = (definitions: readonly ToolDefinition[]): string[] =>
  definitions.flatMap(({ name, inputSchema }) => {
    const problems: string[] = [];
    if (inputSchema.type !== "object") {
      problems.push(
        `${name}: the input schema has type ${JSON.stringify(inputSchema.type)}, not "object" (AD-6)`,
      );
    }
    for (const keyword of ROOT_COMBINATORS) {
      if (keyword in inputSchema)
        problems.push(`${name}: root ${keyword} in the input schema (AD-6)`);
    }
    const properties = isRecord(inputSchema.properties) ? Object.keys(inputSchema.properties) : [];
    for (const property of properties) {
      if (PROPERTY_NAME.test(property)) continue;
      problems.push(
        `${name}: the top-level property name ${JSON.stringify(property)} is not 1 to 64 characters from A-Z, a-z, 0-9, _, . and - (AD-6)`,
      );
    }
    return problems;
  });
