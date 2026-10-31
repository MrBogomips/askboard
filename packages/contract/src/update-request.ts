// Validation of the `update` and `fetch` requests against the contract (AD-6, AD-7; ask-lifecycle,
// design decision 2). A refusal of an update names the action's index in every problem, since its
// actions apply all or none; an added item is checked as an ask's item is, and an area is added
// only at the top level (FR-2).

import {
  ID_SHAPE,
  ITEM_EXPECTED,
  ITEM_FIELDS,
  isId,
  itemKey,
  labelProblems,
  nestingProblems,
  placedIds,
  placedItem,
  repeatedIdProblems,
  reservedPrefixProblems,
  text,
} from "./ask-items.ts";
import { schemaErrors } from "./compiled.ts";
import { NOTE_MAX_CHARS, OTHER_MAX_CHARS, REPLY_MAX_CHARS } from "./limits.ts";
import {
  expectedAt,
  inDocumentOrder,
  isRecord,
  keyOf,
  located,
  problemAt,
  type RequestProblem,
  schemaProblem,
  type Wording,
} from "./problems.ts";
import type { CheckedRequest } from "./requests.ts";
import type { UpdateInput } from "./schemas/input/index.ts";
import type { FetchRequest } from "./schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS } from "./sets.ts";

const ACTIONS = ["add", "change", "delete", "reopen", "answer", "reply", "close"] as const;
const ACTION_LIST = '"add", "change", "delete", "reopen", "answer", "reply" or "close"';
const ITEM_ID = "the ID of an item of the ask";

const actionsOf = (request: unknown): readonly unknown[] =>
  isRecord(request) && Array.isArray(request.actions) ? request.actions : [];

// The action's name, or "action" when it names none the request defines.
const nameOf = (action: unknown): string => {
  const name = isRecord(action) ? action.action : undefined;
  return (ACTIONS as readonly unknown[]).includes(name) ? (name as string) : "action";
};

const prefixed = (prefix: string, table: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(table).map(([key, value]) => [`${prefix}${key}`, value]));

const UPDATE: Wording = {
  root: "(the request)",
  expected: {
    "": "an update request: an object {askId, actions}",
    askId: ID_SHAPE,
    actions: "a non-empty list of actions, applied in order, all or none",
    action: `an action {action, ...}, whose action is ${ACTION_LIST}`,
    ...Object.fromEntries(["action", ...ACTIONS].map((name) => [`${name}.action`, ACTION_LIST])),
    "add.parentId": "the ID of the area the question goes in; omitted at the top level",
    "add.after": "the ID of the item it follows; omitted to put it first",
    ...prefixed("add.", ITEM_EXPECTED),
    "change.itemId": ITEM_ID,
    "change.props": "an object of the props to change, each key replacing its old value whole",
    "delete.itemId": ITEM_ID,
    "reopen.itemId": ITEM_ID,
    "answer.itemId": ITEM_ID,
    "answer.answer": "the answer the user gave you {choice?, other?, note?}",
    "answer.answer.choice": "a non-empty list of option labels, each once",
    "answer.answer.choice[]": "an option label",
    "answer.answer.other": text(OTHER_MAX_CHARS),
    "answer.answer.note": text(NOTE_MAX_CHARS),
    "reply.itemId": ITEM_ID,
    "reply.followUp": "the cursor <epoch>.<seq> of the follow-up event you reply to",
    "reply.text": text(REPLY_MAX_CHARS),
  },
  fields: {
    "": "an update holds only askId and actions",
    add: "an add action holds only action, item, parentId and after",
    change: "a change action holds only action, itemId and props",
    delete: "a delete action holds only action and itemId",
    reopen: "a reopen action holds only action and itemId",
    answer: "an answer action holds only action, itemId and answer",
    "answer.answer": "an answer holds only choice, other and note",
    reply: "a reply action holds only action, itemId, followUp and text",
    close: "a close action holds only action",
    ...prefixed("add.", ITEM_FIELDS),
  },
  // A field by its action's name, and an added item's fields by the item's type.
  keyOf: (request, segments) => {
    if (segments[0] !== "actions" || segments.length < 2) return keyOf(segments);
    const action = actionsOf(request)[Number(segments[1])];
    const name = nameOf(action);
    const rest = segments.slice(2);
    if (name === "add" && rest[0] === "item" && isRecord(action)) {
      return `add.${itemKey(action.item, rest.slice(1))}`;
    }
    return rest.length === 0 ? name : `${name}.${keyOf(rest)}`;
  },
};

type Added = { readonly nested: RequestProblem[]; readonly other: RequestProblem[] };

// An added item, checked as an ask's item is, an area only at the top level; areas inside an added
// area apart, since each replaces the schema's error at its type.
const addProblems = (request: unknown, action: unknown, index: number): Added => {
  if (!isRecord(action) || action.action !== "add") return { nested: [], other: [] };
  const at = ["actions", String(index)];
  const placed = placedItem(action.item, [...at, "item"]);
  const other = [
    ...repeatedIdProblems(UPDATE, request, placed),
    ...reservedPrefixProblems(UPDATE, request, placedIds(placed)),
    ...labelProblems(UPDATE, request, placed),
  ];
  if (isRecord(action.item) && action.item.type === "area" && action.parentId !== undefined) {
    const segments = [...at, "parentId"];
    const message = "{where}: an area sits only at the top level; add it without parentId";
    other.push(
      problemAt(UPDATE, request, segments, message, expectedAt(UPDATE, segments, request)),
    );
  }
  return { nested: nestingProblems(UPDATE, request, placed), other };
};

/**
 * Validates an `update` request against the input format: the schema, then the checks it cannot
 * express on each added item. It refines the tool's generic schema, so a request it accepts passes
 * that schema too.
 */
export const validateUpdateRequest = (value: unknown): CheckedRequest<UpdateInput> => {
  const added = actionsOf(value).map((action, index) => addProblems(value, action, index));
  const nested = added.flatMap((entry) => entry.nested);
  const replaced = new Set(nested.map(({ path }) => path));
  const problems = [
    ...schemaErrors(SCHEMA_IDS.update, value)
      .map(located)
      .map((entry) => schemaProblem(UPDATE, value, entry))
      .filter(({ path }) => !replaced.has(path)),
    ...nested,
    ...added.flatMap((entry) => entry.other),
  ];
  if (problems.length === 0) return { ok: true, value: value as UpdateInput };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};

const CONTINUATION = /^[A-Za-z0-9_-]+$/;

const FETCH: Wording = {
  root: "(the request)",
  expected: {
    "": "a fetch request: an object {askId, itemId, continuation?}",
    askId: ID_SHAPE,
    itemId: "the ID of an item of that ask",
    continuation: "the continuation of the previous fetch result, unchanged",
  },
  fields: { "": "fetch takes only askId, itemId and continuation" },
};

/**
 * Validates a `fetch` request against its envelope, then checks that the item is named by an ID
 * and that a continuation is base64url, as `fetch` writes it (ask-lifecycle, design decision 4).
 */
export const validateFetchRequest = (value: unknown): CheckedRequest<FetchRequest> => {
  const problems = schemaErrors(SCHEMA_IDS.fetchRequest, value)
    .map(located)
    .map((entry) => schemaProblem(FETCH, value, entry));
  const at = (field: string) => {
    const expected = expectedAt(FETCH, [field]);
    problems.push(problemAt(FETCH, value, [field], `{where} must be ${expected}`, expected));
  };
  if (isRecord(value) && typeof value.itemId === "string" && !isId(value.itemId)) at("itemId");
  const { continuation } = isRecord(value) ? value : {};
  if (typeof continuation === "string" && !CONTINUATION.test(continuation)) at("continuation");
  if (problems.length === 0) return { ok: true, value: value as FetchRequest };
  return { ok: false, reason: "schema", problems: inDocumentOrder(value, problems) };
};
