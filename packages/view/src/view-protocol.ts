// The messages between the view and the board page (design decision 8). View messages go as
// ext-apps `App` tool calls named `askboard.view.<type>`, which the board page's `AppBridge`
// answers itself and never forwards; what the board page tells the view after boot goes as
// tool-result notifications whose structured content is a `ViewUpdate`. Both directions are typed
// here rather than in the contract, since the board page and the view are one unit (AD-7). Each
// side checks what it receives structurally: the board page turns only a checked view message
// into a board-protocol command (AD-9, AD-10). Plain ECMAScript: the board page and the shell
// both bundle it.

import { type BoardState, ID_PATTERN, UTC_TIME_PATTERN } from "@askboard/contract";
import type { Checked, Problem } from "@askboard/contract/validate";

/** The tool-name prefix of every view message. */
export const VIEW_TOOL_PREFIX = "askboard.view.";

/** An item error's text is cut to this many characters on its way to the board page. */
export const ITEM_ERROR_MAX_CHARS = 1_000;

/**
 * What an answer carries: the question's choice, the full edited value of each widget item the
 * user changed (AD-20), or both (design decision 7). The view never computes `changes`.
 */
export type AnswerContent = {
  readonly choice?: readonly string[];
  /** Each changed widget item's full edited props, by item ID. */
  readonly values?: Readonly<Record<string, unknown>>;
};

/**
 * The user pressed "Answer": the answer's content at the question's revision, stamped with the
 * time of the act (FR-19, FR-22). The board page turns a choice into the board-protocol `answer`
 * command; the board protocol carries no widget value yet (design decision 7).
 */
export type ViewAnswer = AnswerContent & {
  readonly type: "answer";
  readonly itemId: string;
  readonly rev: number;
  readonly when: string;
};

/** A question counts as visible: all its items are ready (AD-9, SM-C2). */
export type ViewReady = { readonly type: "ready"; readonly itemId: string };

/** An item threw while rendering; its question never counts as visible (AD-9, AD-10). */
export type ViewItemError = {
  readonly type: "item-error";
  readonly itemId: string;
  readonly error: string;
};

export type ViewMessage = ViewAnswer | ViewReady | ViewItemError;

/**
 * The board page's reply to an answer: sent on the board's socket, queued while the connection is
 * lost ("not sent yet", sent on reconnect), or refused, saying why.
 */
export type AnswerReply =
  | { readonly outcome: "sent" }
  | { readonly outcome: "queued" }
  | { readonly outcome: "refused"; readonly detail: string };

export type ViewToolCall = {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
};

/** Why the board page locked the view read-only: the ask was discarded, or the board moved (AD-21). */
export type ViewLock = "discarded" | "moved";

/**
 * An answer the board page holds until a state shows it logged: sent on the socket, or queued
 * until the board reconnects ("not sent yet").
 */
export type PendingAnswer = {
  readonly itemId: string;
  readonly choice: readonly string[];
  readonly when: string;
  readonly outcome: "sent" | "queued";
};

/**
 * What the board page tells a booted view: the board state, as `board-host` last sent it with the
 * receipts since; the lock, while there is one; and the answers it holds, when it holds any. An
 * answer the board page no longer holds and the state does not show answered was dropped, and the
 * question can be answered again (AD-10).
 */
export type ViewUpdate = {
  readonly type: "state";
  readonly state: BoardState;
  readonly lock?: ViewLock;
  readonly pending?: readonly PendingAnswer[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ID = new RegExp(ID_PATTERN);
const UTC_TIME = new RegExp(UTC_TIME_PATTERN);

/** A view message as the tool call `App.callServerTool` sends. */
export const toolCallOf = (message: ViewMessage): ViewToolCall => {
  const { type, ...fields } = message;
  const args =
    message.type === "item-error"
      ? { ...fields, error: message.error.slice(0, ITEM_ERROR_MAX_CHARS) }
      : fields;
  return { name: `${VIEW_TOOL_PREFIX}${type}`, arguments: args };
};

type FieldCheck = (value: unknown) => string | undefined;

const itemId: FieldCheck = (value) =>
  typeof value === "string" && ID.test(value) ? undefined : `is not an item ID (${ID_PATTERN})`;

const revision: FieldCheck = (value) =>
  Number.isInteger(value) && (value as number) >= 1 ? undefined : "is not a revision from 1";

const choice: FieldCheck = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((label) => typeof label === "string" && label !== "") &&
  new Set(value).size === value.length
    ? undefined
    : "is not a list of one or more distinct option labels";

// Checked structurally only: whoever can carry a widget's value checks its content.
const values: FieldCheck = (value) =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(([key, entry]) => ID.test(key) && isRecord(entry))
    ? undefined
    : "is not an object of one or more widget item IDs, each to an object value";

const utcTime: FieldCheck = (value) =>
  typeof value === "string" && UTC_TIME.test(value) ? undefined : "is not an RFC 3339 time in UTC";

const errorText: FieldCheck = (value) =>
  typeof value === "string" && value.length <= ITEM_ERROR_MAX_CHARS
    ? undefined
    : `is not a text of at most ${ITEM_ERROR_MAX_CHARS} characters`;

type MessageFields = {
  readonly checks: Readonly<Record<string, FieldCheck>>;
  /** Fields a message may leave out, of which it holds one at least. */
  readonly someOf?: readonly string[];
};

// Each message type's fields; a call's arguments hold only these, and all but `someOf`'s.
const FIELDS: Readonly<Record<ViewMessage["type"], MessageFields>> = {
  answer: {
    checks: { itemId, rev: revision, choice, values, when: utcTime },
    someOf: ["choice", "values"],
  },
  ready: { checks: { itemId } },
  "item-error": { checks: { itemId, error: errorText } },
};

const refused = (path: string, message: string): Checked<ViewMessage> => ({
  ok: false,
  reason: "schema",
  problems: [{ path, message }],
});

// A message that holds none of the fields it must hold one of.
const noneOf = (someOf: readonly string[], args: Record<string, unknown>): Problem[] =>
  someOf.length === 0 || someOf.some((field) => Object.hasOwn(args, field))
    ? []
    : [
        {
          path: "/arguments",
          message: `holds none of ${someOf.map((field) => `"${field}"`).join(" and ")}`,
        },
      ];

const fieldProblems = (
  { checks, someOf = [] }: MessageFields,
  args: Record<string, unknown>,
): Problem[] => [
  ...Object.keys(args)
    .filter((field) => !Object.hasOwn(checks, field))
    .map((field) => ({ path: `/arguments/${field}`, message: `unknown field "${field}"` })),
  ...Object.entries(checks).flatMap(([field, check]) => {
    if (!Object.hasOwn(args, field)) {
      if (someOf.includes(field)) return [];
      return [{ path: `/arguments/${field}`, message: `missing field "${field}"` }];
    }
    const problem = check(args[field]);
    return problem === undefined ? [] : [{ path: `/arguments/${field}`, message: problem }];
  }),
  ...noneOf(someOf, args),
];

/** A tool call from the view, read as a view message; anything else is refused, saying why. */
export const readViewMessage = (params: unknown): Checked<ViewMessage> => {
  const name = isRecord(params) ? params.name : undefined;
  if (typeof name !== "string") return refused("/name", "a view message names its type");
  const type = name.startsWith(VIEW_TOOL_PREFIX) ? name.slice(VIEW_TOOL_PREFIX.length) : "";
  // An own property only: an inherited name such as `constructor` names no message.
  if (!Object.hasOwn(FIELDS, type)) {
    return refused("/name", `${JSON.stringify(name)} names no view message`);
  }
  const args = isRecord(params) ? params.arguments : undefined;
  if (!isRecord(args)) return refused("/arguments", "a view message's arguments are an object");
  const problems = fieldProblems(FIELDS[type as ViewMessage["type"]], args);
  if (problems.length > 0) return { ok: false, reason: "schema", problems };
  return { ok: true, value: { type, ...args } as ViewMessage };
};

/** The board page's reply to an answer, from the tool result's structured content. */
export const readAnswerReply = (content: unknown): AnswerReply | undefined => {
  if (!isRecord(content)) return undefined;
  if (content.outcome === "sent" || content.outcome === "queued")
    return { outcome: content.outcome };
  if (content.outcome === "refused" && typeof content.detail === "string") {
    return { outcome: "refused", detail: content.detail };
  }
  return undefined;
};

/** The tool result that carries an update to the view. */
export const viewUpdateResult = (
  update: ViewUpdate,
): { content: []; structuredContent: Record<string, unknown> } => ({
  content: [],
  structuredContent: { ...update },
});

// The board page checked the state against the board protocol before it sent it on; the view
// checks only that it can render from it.
const isBoardState = (value: unknown): value is BoardState =>
  isRecord(value) &&
  typeof value.ask === "string" &&
  Array.isArray(value.questions) &&
  value.questions.every(isRecord);

const LOCKS: readonly unknown[] = ["discarded", "moved"] satisfies ViewLock[];

const isPendingAnswer = (value: unknown): value is PendingAnswer =>
  isRecord(value) &&
  itemId(value.itemId) === undefined &&
  Array.isArray(value.choice) &&
  value.choice.every((label) => typeof label === "string") &&
  typeof value.when === "string" &&
  (value.outcome === "sent" || value.outcome === "queued");

/** A tool result's structured content, read as an update; undefined for anything else. */
export const readViewUpdate = (content: unknown): ViewUpdate | undefined => {
  if (!isRecord(content) || content.type !== "state" || !isBoardState(content.state)) {
    return undefined;
  }
  const { lock, pending } = content;
  if (lock !== undefined && !LOCKS.includes(lock)) return undefined;
  if (pending !== undefined && !(Array.isArray(pending) && pending.every(isPendingAnswer))) {
    return undefined;
  }
  return {
    type: "state",
    state: content.state,
    ...(lock === undefined ? {} : { lock: lock as ViewLock }),
    ...(pending === undefined ? {} : { pending }),
  };
};
