// The messages between the view and the board page (design decision 8). View messages go as
// ext-apps `App` tool calls named `askboard.view.<type>`, which the board page's `AppBridge`
// answers itself and never forwards; what the board page tells the view after boot goes as
// tool-result notifications whose structured content is a `ViewUpdate`. Both directions are typed
// here rather than in the contract, since the board page and the view are one unit (AD-7). Each
// side checks what it receives structurally: the board page turns only a checked view message
// into a board-protocol command (AD-9, AD-10). Plain ECMAScript: the board page and the shell
// both bundle it.
//
// The ask lifecycle (ask-lifecycle, design decision 6) adds the user's other acts, as one `act`
// message per command, and the draft mirror, as `draft`; the answer gains its "Other…" text, the
// option notes and the open prompt's note. The board page tells the view the latest board
// document, the closed lock, whether the connection is lost, the commands it holds and settles by
// action ID, and a draft record to restore. The Snapshot (snapshot design decision 8) adds the
// view's `snapshot` request and the update's `snapshot` feedback, typed in `snapshot-feedback.ts`.

import {
  ACTION_ID_PATTERN,
  type AgentStatus,
  type ContextPlacement,
  type Density,
  type DraftRecord,
  FOLLOW_UP_MAX_CHARS,
  ID_PATTERN,
  JSON_MAX_DEPTH,
  LINK_URL_MAX_CHARS,
  type LifecycleBoardState,
  NOTE_MAX_CHARS,
  OPTION_NOTE_MAX_CHARS,
  type OriginMessage,
  OTHER_MAX_CHARS,
  type PresentationKey,
  type PresentationSetting,
  type ThemePreference,
  UTC_TIME_PATTERN,
} from "@askboard/contract";
import type { Checked, Problem } from "@askboard/contract/validate";
import {
  isSnapshotFeedback,
  type SnapshotFeedback,
  type ViewSnapshot,
} from "./snapshot-feedback.ts";
import { isViewChunks, type ViewChunk } from "./view-chunks.ts";
import type { ViewDocument } from "./view-document.ts";

/** The tool-name prefix of every view message. */
export const VIEW_TOOL_PREFIX = "askboard.view.";

/** An item error's text is cut to this many characters on its way to the board page. */
export const ITEM_ERROR_MAX_CHARS = 1_000;

/** AD-13's reference without brackets, as the output format's answer event writes it. */
export const REFERENCE_PATTERN = "^[A-Za-z0-9_-]{1,64}(\\.[A-Za-z0-9_-]{1,64})*$";

/** The view sends its activity message at most once every this many milliseconds. */
export const VIEW_ACTIVITY_INTERVAL_MS = 5_000;

/**
 * What an answer carries: the question's choice, the full edited value of each widget item the
 * user changed (AD-20), or both (design decision 7), and beside any of them the derived values
 * of every computing item of the question, as they stood (widget-answers design decision 10,
 * FR-12). The view never computes `changes`.
 */
export type AnswerContent = {
  readonly choice?: readonly string[];
  /** Each changed widget item's full edited props, by item ID. */
  readonly values?: Readonly<Record<string, unknown>>;
  /**
   * The result each widget item of a type that declares one holds, by item ID, each any JSON
   * value its type defines (widget-registry, design decision 9; AD-20). Content on its own: an
   * answer may hold nothing else.
   */
  readonly results?: Readonly<Record<string, unknown>>;
  /** The "Other…" row's text (FR-3). */
  readonly other?: string;
  /** The user's notes on options, by option label (FR-3, FR-18). */
  readonly optionNotes?: Readonly<Record<string, string>>;
  /** The open prompt's text, sent with the answer (FR-7). */
  readonly note?: string;
  /** The derived values of the question's computing items, by reference (AD-13), each a JSON value. */
  readonly derived?: Readonly<Record<string, unknown>>;
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

/** An answer act in a command: an answer's content, as `ViewAnswer` carries it. */
export type ViewAnswerAct = Omit<ViewAnswer, "type"> & { readonly type: "answer" };

/**
 * One act of the user's, as the board protocol's act command carries it (AD-10, AD-20): an
 * answer, a decline with its reason, a postpone, an undo of a sent postpone or decline, a note
 * alone, a follow-up, or the choice about an agent change. The board page gives the command its
 * action ID.
 */
export type ViewAct =
  | ViewAnswerAct
  | {
      readonly type: "decline";
      readonly itemId: string;
      readonly rev: number;
      readonly note?: string;
      readonly when: string;
    }
  | { readonly type: "postpone"; readonly itemId: string; readonly rev: number }
  | { readonly type: "reopen"; readonly itemId: string }
  | {
      readonly type: "note";
      readonly itemId: string;
      readonly rev: number;
      readonly note: string;
      readonly when: string;
    }
  | {
      readonly type: "follow-up";
      readonly itemId: string;
      readonly rev: number;
      readonly text: string;
      readonly when: string;
    }
  | ({ readonly type: "edit-choice"; readonly itemId: string; readonly rev: number } & (
      | { readonly edit: "reload" }
      | { readonly edit: "ignore"; readonly keptRev: number }
    ));

/** One command of acts, applied once and whole, in this order (AD-20). */
export type ViewActs = { readonly type: "act"; readonly acts: readonly [ViewAct, ...ViewAct[]] };

/** The board's unsent work, mirrored after each change (AD-20); never sent to the agent. */
export type ViewDraft = { readonly type: "draft"; readonly record: DraftRecord };

/**
 * The user acts in the view, with a key or the pointer (design decision 10): input inside the
 * sandboxed view does not reach the board page, which counts it for the board's working signal.
 */
export type ViewActivity = { readonly type: "activity" };

/**
 * One presentation key and a value its schema allows, from a quick toggle (settings-languages,
 * design decision 10): the board page applies it at once and sends it to `board-host` as a
 * `setting` command, which writes it to the user file.
 */
export type ViewSetting = { readonly type: "setting" } & PresentationSetting;

/** "Settings": the board page opens its settings panel. */
export type ViewOpenSettings = { readonly type: "open-settings" };

/**
 * The user clicks a reference, or an excerpt's "Open in reading panel" (excerpts, design decisions
 * 6 and 7): the message names the item and the heights of the view's header and bottom bar, so that
 * the reading panel sits between them. The board page reads the URL or pointer from the board
 * document it holds, never from the message (AD-8).
 */
export type ViewOpenReference = {
  readonly type: "open-reference";
  readonly itemId: string;
  readonly inset: ReferenceInset;
};

/** The view's header and bottom bar heights in CSS pixels: where the reading panel may sit. */
export type ReferenceInset = { readonly top: number; readonly bottom: number };

/** The most characters of a URL an open-link message carries (atoms, design decision 6). */
export const OPEN_LINK_URL_MAX_CHARS = LINK_URL_MAX_CHARS;

/**
 * The user clicks a link in Markdown (atoms, design decision 6): the message names the item whose
 * Markdown holds it and the URL. The URL is agent content: the board page opens it only when it is
 * `http:` or `https:` and the item holds Markdown in the board document it holds (AD-8).
 */
export type ViewOpenLink = {
  readonly type: "open-link";
  readonly itemId: string;
  readonly url: string;
};

export type ViewMessage =
  | ViewAnswer
  | ViewReady
  | ViewItemError
  | ViewActs
  | ViewDraft
  | ViewActivity
  | ViewSetting
  | ViewOpenSettings
  | ViewOpenReference
  | ViewSnapshot
  | ViewOpenLink;

/**
 * The board page's reply to an answer: sent on the board's socket, queued while the connection is
 * lost ("not sent yet", sent on reconnect), or refused, saying why.
 */
export type AnswerReply =
  | { readonly outcome: "sent" }
  | { readonly outcome: "queued" }
  | { readonly outcome: "refused"; readonly detail: string };

/** The board page's reply to an answer or an act command, naming the action ID it gave it. */
export type ActReply =
  | { readonly outcome: "sent" | "queued"; readonly actionId: string }
  | { readonly outcome: "refused"; readonly detail: string };

export type ViewToolCall = {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
};

/**
 * Why the board page locked the view read-only: the ask was discarded, the board moved (AD-21), or
 * the agent closed the ask (FR-6).
 */
export type ViewLock = "discarded" | "moved" | "closed";

/**
 * An act command the board page holds until `board-host` acknowledges or refuses it: sent on the
 * socket, or queued until the board reconnects ("not sent yet").
 */
export type PendingAct = { readonly actionId: string; readonly outcome: "sent" | "queued" };

/**
 * How a command the board page held ended: applied (`done`), refused by `board-host`, or dropped
 * by the board page, since the board changed under it while it was not live (AD-10).
 */
export type SettledAct = {
  readonly actionId: string;
  readonly outcome: "done" | "refused" | "dropped";
};

/** A draft record to restore, numbered so that the view restores each once. */
export type DraftRestore = { readonly id: number; readonly record: DraftRecord };

/**
 * The reading panel was closed by the user: the view focuses the item that opened it (excerpts,
 * design decision 6; EXPERIENCE, Accessibility Floor). Numbered, so that the view acts on each once.
 */
export type PanelClosed = { readonly id: number; readonly itemId: string };

/** Who asked and where, as the board page passes it on: the origin message's content (FR-24). */
export type HeaderOrigin = Omit<OriginMessage, "version" | "type">;

/**
 * The theme, density and context placement the user's settings give, and the keys the project
 * fixes, so that a toggle for one is read-only (settings-languages, design decision 10).
 */
export type ViewPresentation = {
  readonly theme: ThemePreference;
  readonly density: Density;
  readonly contextPlacement: ContextPlacement;
  readonly locked: readonly PresentationKey[];
};

/**
 * What the board page tells a booted view: the board state, as `board-host` last sent it with the
 * receipts since; the latest board document; the lock, while there is one; whether the connection
 * is lost, which disables Submit; the commands it holds, and how the latest ones ended; and the
 * draft record `board-host` restored, when the board page has none of its own (AD-20); and who
 * asked and where and the agent status, once `board-host` has sent them (push delivery, design
 * decision 12). A command the board page no longer holds that is not settled was dropped, and its
 * question can be answered again (AD-10).
 */
export type ViewUpdate = {
  readonly type: "state";
  readonly state: LifecycleBoardState;
  /** Trusted manifest sources to install before rendering this update. */
  readonly chunks?: readonly ViewChunk[];
  readonly document?: ViewDocument;
  readonly lock?: ViewLock;
  readonly connection?: "lost";
  readonly pending?: readonly PendingAct[];
  readonly settled?: readonly SettledAct[];
  readonly restore?: DraftRestore;
  readonly panelClosed?: PanelClosed;
  readonly origin?: HeaderOrigin;
  readonly agent?: AgentStatus;
  readonly presentation?: ViewPresentation;
  /** How many times the settings panel has closed: the view focuses "Settings" on each. */
  readonly settingsClosed?: number;
  /** How the latest Snapshot request the view sent ended (snapshot design decision 8). */
  readonly snapshot?: SnapshotFeedback;
};

/** The optional fields of a view update. */
export type UpdateField = Exclude<keyof ViewUpdate, "type" | "state">;

/**
 * The type of `UPDATE_FIELDS`: for each optional field of a view update, the check of a value the
 * view can read, and `atBoot` when the `askboard-data` block carries the field too, so the first
 * render has it. A field of `ViewUpdate` the table leaves out is a type error (review L10).
 */
export type UpdateFields = {
  readonly [K in UpdateField]: {
    readonly check: (value: unknown) => value is NonNullable<ViewUpdate[K]>;
    readonly atBoot?: true;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ID = new RegExp(ID_PATTERN);
const REFERENCE = new RegExp(REFERENCE_PATTERN);
const UTC_TIME = new RegExp(UTC_TIME_PATTERN);
const ACTION_ID = new RegExp(ACTION_ID_PATTERN);

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

// A plain object or a list: a JSON object or array, not a date, map or class instance.
const isContainer = (value: object): boolean => {
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Whether `value` nests no deeper than `maxDepth` levels of objects and lists. A list walks it, so
 * a value nested a million deep, or one that holds itself, is answered and never overflows the
 * stack; the board page runs it before any `JSON.stringify`, which throws on a deep value.
 */
export const nestsWithin = (value: unknown, maxDepth: number): boolean => {
  const stack: { readonly value: unknown; readonly depth: number }[] = [{ value, depth: 0 }];
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    if (typeof next.value !== "object" || next.value === null) continue;
    if (next.depth >= maxDepth) return false;
    for (const child of Object.values(next.value)) {
      stack.push({ value: child, depth: next.depth + 1 });
    }
  }
  return true;
};

/**
 * A JSON value: text, a finite number, true, false, null, and lists and plain objects of them. It
 * is walked with a list rather than recursion, so that a deep value cannot overflow the board
 * page's stack, and an object reached twice, a cycle included, is refused: JSON shares no object,
 * and the walk stays linear in the value's size.
 */
export const isJsonValue = (root: unknown, maxDepth = Number.POSITIVE_INFINITY): boolean => {
  const seen = new Set<object>();
  const pending: { readonly value: unknown; readonly depth: number }[] = [
    { value: root, depth: 0 },
  ];
  while (pending.length > 0) {
    const { value, depth } = pending.pop() as { value: unknown; depth: number };
    if (value === null || typeof value === "string" || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) continue;
      return false;
    }
    if (typeof value !== "object" || seen.has(value) || !isContainer(value)) return false;
    if (depth >= maxDepth) return false;
    seen.add(value);
    // A list's holes read as undefined, which is refused.
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      pending.push({ value: child, depth: depth + 1 });
    }
  }
  return true;
};

// Checked structurally only, as `values` is: whoever can carry a widget's value checks its content.
const derived: FieldCheck = (value) =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => REFERENCE.test(key)) &&
  isJsonValue(value, JSON_MAX_DEPTH + 1)
    ? undefined
    : `is not an object of one or more references (AD-13), each to a JSON value nested at most ${JSON_MAX_DEPTH} levels`;

// Item IDs, each to a JSON value of the widget's own type, which whoever can carry it checks.
const results: FieldCheck = (value) =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => ID.test(key)) &&
  isJsonValue(value, JSON_MAX_DEPTH + 1)
    ? undefined
    : `is not an object of one or more widget item IDs, each to a JSON value nested at most ${JSON_MAX_DEPTH} levels`;

const utcTime: FieldCheck = (value) =>
  typeof value === "string" && UTC_TIME.test(value) ? undefined : "is not an RFC 3339 time in UTC";

const errorText: FieldCheck = (value) =>
  typeof value === "string" && value.length <= ITEM_ERROR_MAX_CHARS
    ? undefined
    : `is not a text of at most ${ITEM_ERROR_MAX_CHARS} characters`;

const text =
  (max: number): FieldCheck =>
  (value) =>
    typeof value === "string" && value !== "" && value.length <= max
      ? undefined
      : `is not a non-empty text of at most ${max} characters`;

const optionNotes: FieldCheck = (value) =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(
    ([label, note]) => label !== "" && text(OPTION_NOTE_MAX_CHARS)(note) === undefined,
  )
    ? undefined
    : `is not an object of one or more option labels, each to a note of at most ${OPTION_NOTE_MAX_CHARS} characters`;

const oneOf =
  (...values: readonly unknown[]): FieldCheck =>
  (value) =>
    values.includes(value)
      ? undefined
      : `is not one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;

/** A message's fields, each with its check, and which of them it may leave out. */
export type MessageFields = {
  readonly checks: Readonly<Record<string, FieldCheck>>;
  /** Fields a message may leave out, of which it holds one at least. */
  readonly someOf?: readonly string[];
  /** Fields a message may leave out. */
  readonly optional?: readonly string[];
  /** Fields a message may leave out, and may hold only beside another field, their partner. */
  readonly beside?: Readonly<Record<string, string>>;
};

const ANSWER: MessageFields = {
  checks: {
    itemId,
    rev: revision,
    choice,
    values,
    results,
    derived,
    other: text(OTHER_MAX_CHARS),
    optionNotes,
    note: text(NOTE_MAX_CHARS),
    when: utcTime,
  },
  someOf: ["choice", "values", "results", "other"],
  optional: ["derived", "optionNotes", "note"],
};

// Derived values never make an answer (widget-answers design decision 10): they come beside a
// choice, widget values, results or "Other…" text, and an answer of derived values alone is refused, as
// `ask-core` refuses it. It holds wherever ANSWER's checks do, for the answer message and the
// answer act (cross-review M3).
const derivedAlone = (args: Record<string, unknown>, at = "/arguments"): Problem[] =>
  Object.hasOwn(args, "derived") &&
  !["choice", "values", "results", "other"].some((field) => Object.hasOwn(args, field))
    ? [
        {
          path: `${at}/derived`,
          message: 'comes only beside "choice", "values", "results" or "other"',
        },
      ]
    : [];

// Each act type's fields, as the board protocol's act command has them.
const ACTS: Readonly<Record<ViewAct["type"], MessageFields>> = {
  answer: ANSWER,
  decline: {
    checks: { itemId, rev: revision, note: text(NOTE_MAX_CHARS), when: utcTime },
    optional: ["note"],
  },
  postpone: { checks: { itemId, rev: revision } },
  reopen: { checks: { itemId } },
  note: { checks: { itemId, rev: revision, note: text(NOTE_MAX_CHARS), when: utcTime } },
  "follow-up": {
    checks: { itemId, rev: revision, text: text(FOLLOW_UP_MAX_CHARS), when: utcTime },
  },
  "edit-choice": {
    checks: { itemId, rev: revision, edit: oneOf("reload", "ignore"), keptRev: revision },
    optional: ["keptRev"],
  },
};

const actProblems = (act: unknown, at: string): Problem[] => {
  const type = isRecord(act) ? act.type : undefined;
  if (!isRecord(act) || typeof type !== "string" || !Object.hasOwn(ACTS, type)) {
    return [{ path: at, message: "is not an act of the board protocol" }];
  }
  const { type: _, ...fields } = act;
  const problems = fieldProblems(ACTS[type as ViewAct["type"]], fields, at);
  if (type === "answer") problems.push(...derivedAlone(fields, at));
  if (type === "edit-choice" && problems.length === 0) {
    // `keptRev` with `ignore` only, which keeps that revision (FR-6, AD-20).
    if (fields.edit === "ignore" && !Object.hasOwn(fields, "keptRev")) {
      return [{ path: `${at}/keptRev`, message: 'missing field "keptRev"' }];
    }
    if (fields.edit === "reload" && Object.hasOwn(fields, "keptRev")) {
      return [{ path: `${at}/keptRev`, message: 'a reload keeps no revision: no "keptRev"' }];
    }
  }
  return problems;
};

const acts: FieldCheck = (value) =>
  Array.isArray(value) && value.length > 0 ? undefined : "is not a list of one or more acts";

const draftRecord: FieldCheck = (value) =>
  isRecord(value) &&
  (value.delivery === "immediate" || value.delivery === "submitted") &&
  isRecord(value.questions)
    ? undefined
    : "is not a draft record: a delivery mode and the questions' work";

const THEMES: readonly unknown[] = ["system", "light", "dark"] satisfies ThemePreference[];
const DENSITIES: readonly unknown[] = ["compact", "comfortable"] satisfies Density[];
const PLACEMENTS: readonly unknown[] = ["beside", "inline"] satisfies ContextPlacement[];
const PRESENTATION_KEY_NAMES: readonly unknown[] = [
  "theme",
  "density",
  "contextPlacement",
] satisfies PresentationKey[];

/** Whether the view can apply this as the presentation. */
export const isPresentation = (value: unknown): value is ViewPresentation =>
  isRecord(value) &&
  THEMES.includes(value.theme) &&
  DENSITIES.includes(value.density) &&
  PLACEMENTS.includes(value.contextPlacement) &&
  Array.isArray(value.locked) &&
  value.locked.every((key) => PRESENTATION_KEY_NAMES.includes(key));

// The values each presentation key allows, as the configuration schema does.
const PRESENTATION_VALUES: Readonly<Record<PresentationKey, readonly unknown[]>> = {
  theme: THEMES,
  density: DENSITIES,
  contextPlacement: PLACEMENTS,
};

const presentationKey: FieldCheck = (value) =>
  PRESENTATION_KEY_NAMES.includes(value) ? undefined : "is not a presentation key";

// The pair, once each field has passed its own check: the value must be one its key allows.
const settingProblems = (args: Record<string, unknown>, at = "/arguments"): Problem[] => {
  const { key, value } = args;
  if (!PRESENTATION_KEY_NAMES.includes(key)) return [];
  const allowed = PRESENTATION_VALUES[key as PresentationKey];
  return allowed.includes(value)
    ? []
    : [{ path: `${at}/value`, message: `is not a value "${String(key)}" allows` }];
};

/** The most a height can be: a bound, so that no message names a panel off any screen. */
export const INSET_MAX = 10_000;

const inset: FieldCheck = (value) => {
  const bound = (height: unknown) =>
    typeof height === "number" && Number.isFinite(height) && height >= 0 && height <= INSET_MAX;
  return isRecord(value) &&
    Object.keys(value).length === 2 &&
    bound(value.top) &&
    bound(value.bottom)
    ? undefined
    : `is not the header's and the bottom bar's heights, "top" and "bottom", each from 0 to ${INSET_MAX}`;
};

const linkUrl: FieldCheck = (value) =>
  typeof value === "string" && value.length <= OPEN_LINK_URL_MAX_CHARS
    ? undefined
    : `is not a text of at most ${OPEN_LINK_URL_MAX_CHARS} characters`;

// Each message type's fields; a call's arguments hold only these, and all but `someOf`'s and
// `optional`'s.
const FIELDS: Readonly<Record<ViewMessage["type"], MessageFields>> = {
  answer: ANSWER,
  ready: { checks: { itemId } },
  "item-error": { checks: { itemId, error: errorText } },
  act: { checks: { acts } },
  draft: { checks: { record: draftRecord } },
  activity: { checks: {} },
  setting: {
    checks: {
      key: presentationKey,
      value: (value) => (typeof value === "string" ? undefined : "is not a text"),
    },
  },
  "open-settings": { checks: {} },
  "open-reference": { checks: { itemId, inset } },
  snapshot: { checks: {} },
  "open-link": { checks: { itemId, url: linkUrl } },
};

const refused = (path: string, message: string): Checked<ViewMessage> => ({
  ok: false,
  reason: "schema",
  problems: [{ path, message }],
});

// The fields as a list in words: `"a"`, `"a" and "b"`, `"a", "b" and "c"`.
const listed = (fields: readonly string[]): string => {
  const quoted = fields.map((field) => `"${field}"`);
  return quoted.length < 2
    ? quoted.join("")
    : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
};

// A message that holds none of the fields it must hold one of.
const noneOf = (
  someOf: readonly string[],
  args: Record<string, unknown>,
  at = "/arguments",
): Problem[] =>
  someOf.length === 0 || someOf.some((field) => Object.hasOwn(args, field))
    ? []
    : [{ path: at, message: `holds none of ${listed(someOf)}` }];

// A message that holds a field without the partner it goes only beside.
const alone = (
  beside: Readonly<Record<string, string>>,
  args: Record<string, unknown>,
  at = "/arguments",
): Problem[] =>
  Object.entries(beside)
    .filter(([field, partner]) => Object.hasOwn(args, field) && !Object.hasOwn(args, partner))
    .map(([field, partner]) => ({ path: at, message: `"${field}" goes only beside "${partner}"` }));

/**
 * What is wrong with a message's fields, if anything: an unknown field, a missing one, one that
 * fails its check, none of those it must hold one of, or one without its partner. Each problem is
 * under `at`, the message's path.
 */
export function fieldProblems(
  { checks, someOf = [], optional = [], beside = {} }: MessageFields,
  args: Record<string, unknown>,
  at = "/arguments",
): Problem[] {
  return [
    ...Object.keys(args)
      .filter((field) => !Object.hasOwn(checks, field))
      .map((field) => ({ path: `${at}/${field}`, message: `unknown field "${field}"` })),
    ...Object.entries(checks).flatMap(([field, check]) => {
      if (!Object.hasOwn(args, field)) {
        if (someOf.includes(field) || optional.includes(field) || Object.hasOwn(beside, field)) {
          return [];
        }
        return [{ path: `${at}/${field}`, message: `missing field "${field}"` }];
      }
      const problem = check(args[field]);
      return problem === undefined ? [] : [{ path: `${at}/${field}`, message: problem }];
    }),
    ...noneOf(someOf, args, at),
    ...alone(beside, args, at),
  ];
}

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
  if (type === "answer") problems.push(...derivedAlone(args));
  if (type === "setting" && problems.length === 0) problems.push(...settingProblems(args));
  if (problems.length === 0 && type === "act") {
    problems.push(
      ...(args.acts as unknown[]).flatMap((act, index) =>
        actProblems(act, `/arguments/acts/${index}`),
      ),
    );
  }
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

/** The board page's reply to an answer or an act command, with the action ID it gave it. */
export const readActReply = (content: unknown): ActReply | undefined => {
  if (!isRecord(content)) return undefined;
  const { outcome, actionId, detail } = content;
  if ((outcome === "sent" || outcome === "queued") && typeof actionId === "string") {
    return ACTION_ID.test(actionId) ? { outcome, actionId } : undefined;
  }
  if (outcome === "refused" && typeof detail === "string") return { outcome, detail };
  return undefined;
};

/** The tool result that carries an update to the view. */
export const viewUpdateResult = (
  update: ViewUpdate,
): { content: []; structuredContent: Record<string, unknown> } => ({
  content: [],
  structuredContent: { ...update },
});

// The board page checked the state and the document against the board protocol before it sent
// them on; the view checks only that it can render from them.
const isBoardState = (value: unknown): value is LifecycleBoardState =>
  isRecord(value) &&
  typeof value.ask === "string" &&
  Array.isArray(value.questions) &&
  value.questions.every(isRecord);

const isDocument = (value: unknown): value is ViewDocument =>
  isRecord(value) && Array.isArray(value.items) && value.items.every(isRecord);

const LOCKS: readonly unknown[] = ["discarded", "moved", "closed"] satisfies ViewLock[];

const isActionId = (value: unknown): value is string =>
  typeof value === "string" && ACTION_ID.test(value);

const isPendingAct = (value: unknown): value is PendingAct =>
  isRecord(value) &&
  isActionId(value.actionId) &&
  (value.outcome === "sent" || value.outcome === "queued");

const isSettledAct = (value: unknown): value is SettledAct =>
  isRecord(value) &&
  isActionId(value.actionId) &&
  (value.outcome === "done" || value.outcome === "refused" || value.outcome === "dropped");

const isRestore = (value: unknown): value is DraftRestore =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  (value.id as number) >= 1 &&
  draftRecord(value.record) === undefined;

const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

const isPanelClosed = (value: unknown): value is PanelClosed =>
  isRecord(value) &&
  Number.isInteger(value.id) &&
  (value.id as number) >= 1 &&
  typeof value.itemId === "string" &&
  ID.test(value.itemId);

const listOf =
  <T>(is: (value: unknown) => value is T) =>
  (value: unknown): value is readonly T[] =>
    Array.isArray(value) && value.every(is);

const optional = (value: unknown, kind: "string" | "number"): boolean =>
  value === undefined || typeof value === kind;

/**
 * Whether the view can show this as who asked and where. The board page checked the origin
 * message against the board protocol; the view checks only the shape it renders from.
 */
export const isHeaderOrigin = (value: unknown): value is HeaderOrigin => {
  if (!isRecord(value) || !isRecord(value.who)) return false;
  const { label, name, ordinal } = value.who;
  return (
    typeof label === "string" &&
    optional(name, "string") &&
    (ordinal === undefined || Number.isInteger(ordinal)) &&
    ["forUser", "project", "directory", "branch", "worktree"].every((key) =>
      optional(value[key], "string"),
    )
  );
};

const AGENT_STATUSES: readonly unknown[] = ["working", "waiting"] satisfies AgentStatus[];

export const isAgentStatus = (value: unknown): value is AgentStatus =>
  AGENT_STATUSES.includes(value);

const isLock = (value: unknown): value is ViewLock => LOCKS.includes(value);

/**
 * Each optional field of an update, with its check, and `atBoot` for those the view also boots
 * from. `readViewUpdate` reads it, and so do the boot data (`boot-data.ts`) and the board page's
 * model and view updates, so a change adding a field to `ViewUpdate` adds its entry here, which
 * the type requires, and edits none of them (review M4).
 */
export const UPDATE_FIELDS = {
  chunks: { check: isViewChunks },
  document: { check: isDocument },
  lock: { check: isLock },
  connection: { check: (value: unknown): value is "lost" => value === "lost" },
  pending: { check: listOf(isPendingAct) },
  settled: { check: listOf(isSettledAct) },
  restore: { check: isRestore },
  panelClosed: { check: isPanelClosed },
  origin: { check: isHeaderOrigin, atBoot: true },
  agent: { check: isAgentStatus, atBoot: true },
  presentation: { check: isPresentation, atBoot: true },
  settingsClosed: { check: isCount },
  snapshot: { check: isSnapshotFeedback },
} as const satisfies UpdateFields;

/** A tool result's structured content, read as an update; undefined for anything else. */
export const readViewUpdate = (content: unknown): ViewUpdate | undefined => {
  if (!isRecord(content) || content.type !== "state" || !isBoardState(content.state)) {
    return undefined;
  }
  const update: Record<string, unknown> = { type: "state", state: content.state };
  for (const [field, { check }] of Object.entries(UPDATE_FIELDS)) {
    const value = content[field];
    if (value === undefined) continue;
    if (!check(value)) return undefined;
    update[field] = value;
  }
  return update as ViewUpdate;
};

// The Snapshot's messages (snapshot design decision 8)

export type {
  SnapshotFailure,
  SnapshotFeedback,
  SnapshotRequestReply,
  ViewSnapshot,
} from "./snapshot-feedback.ts";
