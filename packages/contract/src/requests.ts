// Validation of tool requests against the contract (AD-6, AD-7). The server validates every request
// here. Checks a schema cannot express report like schema errors: over every item of an ask, IDs
// unique in the ask, the reserved view-made prefix (F10), areas all or none at the top level and
// never nested (FR-2), unique option labels (F5), one recommended option at most and the room an
// answer needs; in a collect, cursors and each ask once. Since input format 1.2, over each
// question's context items, the one-of rules and the URL (excerpts, design decision 2).

import {
  areaRuleProblems,
  ID_SHAPE,
  ITEM_FIELDS,
  innerItemOf,
  isId,
  itemExpected,
  itemKey,
  labelProblems,
  layoutDepthRequestProblem,
  nestingProblems,
  placedIds,
  placedItems,
  repeatedIdProblems,
  reservedPrefixProblems,
  text,
} from "./ask-items.ts";
import { errorsIn, schemaErrors } from "./compiled.ts";
import { ASK_TITLE_MAX_CHARS } from "./constants.ts";
import { contextProblems } from "./context/items.ts";
import { COLLECT_ASKS_MAX, CURSOR_PATTERN, NAME_MAX_CHARS } from "./limits.ts";
import {
  expectedAt,
  inDocumentOrder,
  isRecord,
  keyOf,
  located,
  problemAt,
  type RequestProblem,
  type Segments,
  schemaProblem,
  type Wording,
} from "./problems.ts";
import type { LifecycleAskInput } from "./schemas/input/index.ts";
import type { CollectRequest, ToolDefinition } from "./schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "./sets.ts";
import { elementOf } from "./widgets/paths.ts";
import { WIDGET_TYPES, type WidgetType } from "./widgets/registry.ts";
import { registryAjv } from "./widgets/registry-ajv.ts";
import { widgetProblems, widgetSchemaErrors } from "./widgets/request-problems.ts";
import { widgetExpected, widgetFields } from "./widgets/wording.ts";

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

const CURSOR = new RegExp(CURSOR_PATTERN);

const itemsOf = (ask: unknown): readonly unknown[] =>
  isRecord(ask) && Array.isArray(ask.items) ? ask.items : [];

// The ask's wording over a registry: its types' items and the props of each.
const askWording = (types: readonly WidgetType[]): Wording => ({
  root: "(the ask)",
  expected: {
    "": "an ask: an object {askId, items} with the optional title, agentName, expectedUser, presentation, delivery, language and locale",
    askId: ID_SHAPE,
    title: text(ASK_TITLE_MAX_CHARS),
    agentName: text(NAME_MAX_CHARS),
    expectedUser: text(NAME_MAX_CHARS),
    presentation: '"sections", "tabs" or "one-per-view"',
    delivery: '"immediate" or "submitted"',
    language: '"en-US" or "it-IT"',
    locale: '"en-US" or "it-IT"',
    items: "a non-empty list of questions, or of areas each holding questions",
    ...itemExpected(types),
    ...widgetExpected(types),
  },
  fields: {
    "": "an ask holds only askId, title, agentName, expectedUser, presentation, delivery, language, locale and items",
    ...ITEM_FIELDS,
    ...widgetFields(types),
  },
  // An item's fields by the item's type: `question.props.text`, `area.props.title`.
  keyOf: (ask, segments) =>
    segments[0] === "items" && segments.length > 1
      ? itemKey(itemsOf(ask)[Number(segments[1])], segments.slice(2), types)
      : keyOf(segments),
  // The innermost item with a usable ID: an area's question, a question's item or an item of a
  // layout, at any depth.
  itemOf: (ask, segments) => {
    if (segments[0] !== "items" || segments.length < 3) return undefined;
    const inner = innerItemOf(itemsOf(ask)[Number(segments[1])], segments.slice(2));
    const id = isRecord(inner.item) ? inner.item.id : undefined;
    if (!isId(id)) return undefined;
    const element = elementOf(inner.item, inner.rest, types);
    return { itemId: id, rest: inner.rest, ...(element === undefined ? {} : { element }) };
  },
});

const ASK: Wording = askWording(WIDGET_TYPES);

/**
 * Validates an `ask` request against the input format: the schema, then, over every item, the
 * checks it cannot express. The input format refines the `ask` tool's generic schema, so a request
 * it accepts passes that schema too. An ask that passes is input format 1.1's, which ask-core reads
 * since ask-lifecycle's task 2.1.
 */
export const validateAskRequest = (value: unknown): CheckedRequest<LifecycleAskInput> =>
  validateAskRequestOver(value, WIDGET_TYPES);

/**
 * `validateAskRequest` over a registry (widget-registry, design decision 2): the same checks with
 * the item types, wording and schema of `types`, so that a test checks the layouts before they
 * are registered. The layouts' depth is checked first, and alone: a request that nests past the
 * bound is refused before the schema or any item is walked (layouts, design decision 3).
 */
export const validateAskRequestOver = (
  value: unknown,
  types: readonly WidgetType[],
): CheckedRequest<LifecycleAskInput> => {
  const wording = types === WIDGET_TYPES ? ASK : askWording(types);
  const items = itemsOf(value);
  const tooDeep = layoutDepthRequestProblem(wording, value, items, ["items"]);
  if (tooDeep !== undefined) return { ok: false, reason: "schema", problems: [tooDeep] };
  const placed = placedItems(items, ["items"]);
  // An area inside an area is named once, as an area, not as the question the schema expects.
  const nested = nestingProblems(wording, value, placed);
  const replaced = new Set(nested.map(({ path }) => path));
  const askId: readonly [Segments, unknown] = [
    ["askId"],
    isRecord(value) ? value.askId : undefined,
  ];
  const errors =
    types === WIDGET_TYPES
      ? schemaErrors(SCHEMA_IDS.ask, value)
      : errorsIn(registryAjv(types), SCHEMA_IDS.ask, value);
  const schema = widgetSchemaErrors(errors, value, types)
    .map(located)
    .map((entry) => schemaProblem(wording, value, entry))
    .filter(({ path }) => !replaced.has(path));
  const problems = [
    ...schema,
    ...nested,
    ...areaRuleProblems(items, ["items"]),
    ...repeatedIdProblems(wording, value, placed),
    ...reservedPrefixProblems(wording, value, [askId, ...placedIds(placed)]),
    ...labelProblems(wording, value, placed),
    ...contextProblems(wording, value, placed),
    ...widgetProblems(wording, value, placed, schema, types),
  ];
  if (problems.length === 0) return { ok: true, value: value as LifecycleAskInput };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};

const COLLECT: Wording = {
  root: "(the request)",
  expected: {
    "": "a collect request: an object {asks, wait?}",
    asks: `a non-empty list of {askId, after}, one entry per ask, at most ${COLLECT_ASKS_MAX}`,
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
  if (asks.length > COLLECT_ASKS_MAX) {
    const message = `{where}: ${asks.length} asks, but a collect takes at most ${COLLECT_ASKS_MAX} asks; collect the others in another call`;
    problems.push(problemAt(COLLECT, request, ["asks"], message, expectedAt(COLLECT, ["asks"])));
  }
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
