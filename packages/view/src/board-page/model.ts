// What the board page knows of its board (design decision 8): the board document and the state as
// `board-host` last sent them, each checked against the board protocol on arrival, with the
// receipts since, and what the view reported of its questions (AD-9). Each message makes a new
// model. The connection's status, the held commands and the banners are the controller's. Since
// the ask lifecycle (ask-lifecycle, design decision 6) the document and the state are protocol
// 1.1's, of several questions or areas, and the view's acts become act commands here, each act
// checked against what the board page knows before it goes (AD-9, AD-10); `board-host` and
// ask-core check them again. Push delivery adds who asked and where and the agent status (design
// decision 12), the first of the fields the board page passes on to the view as they are.

import type {
  Act,
  HostMessage,
  LifecycleBoardDocument,
  LifecycleBoardState,
  LifecycleQuestionStatus,
  SettingsMessage,
} from "@askboard/contract";
import { type BootData, bootFieldsOf } from "../boot-data.ts";
import { valueItemsOf } from "../nested-items.ts";
import { questionsOf, type ViewQuestion } from "../view-document.ts";
import type {
  ViewAct,
  ViewAnswer,
  ViewItemError,
  ViewPresentation,
  ViewReady,
  ViewUpdate,
} from "../view-protocol.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import { presentationOf } from "./presentation.ts";

// The optional fields of a view update the controller makes from its own state, E1's and the ask
// lifecycle's: a later document, the lock, the connection, the commands held and settled, and the
// draft record to restore, how often the settings panel has closed and the reading panel's latest
// closing; and the Snapshot's: how the view's latest request ended, which the controller tracks
// itself (snapshot design decision 8, task 6.2).
type ControllerField =
  | "chunks"
  | "document"
  | "lock"
  | "connection"
  | "pending"
  | "settled"
  | "restore"
  | "settingsClosed"
  | "panelClosed"
  | "snapshot";

/**
 * The fields of a view update the model keeps, which the board page passes on to the view as they
 * are: in each update, and in the boot data for those `UPDATE_FIELDS` marks `atBoot`. Push
 * delivery's who asked and where and agent status are the first (design decision 12). Any later
 * field of `ViewUpdate` the controller does not make is one of them: a change adding one sets it
 * here, and edits neither `bootDataOf` nor the controller's view updates (review M4).
 */
export type PassedOn = Omit<ViewUpdate, "type" | "state" | ControllerField>;

export type BoardModel = {
  readonly document?: LifecycleBoardDocument;
  readonly state?: LifecycleBoardState;
  /** Questions the view reported visible: all their items ready (SM-C2). */
  readonly visible: ReadonlySet<string>;
  /** Items the view reported failing, with the error (AD-9, AD-10). */
  readonly failed: ReadonlyMap<string, string>;
  /**
   * What it passes on to the view: who asked and where, and the agent status, as `board-host`
   * last sent them (FR-24).
   */
  readonly passedOn: PassedOn;
  /** The settings in effect, as `board-host` last sent them: the settings panel's rows. */
  readonly settings?: SettingsMessage;
};

export const EMPTY_MODEL: BoardModel = { visible: new Set(), failed: new Map(), passedOn: {} };

const isLogged = (
  question: LifecycleQuestionStatus | undefined,
): question is Extract<LifecycleQuestionStatus, { readonly answer: unknown }> =>
  question?.state === "answered" || question?.state === "declined";

// The state with the question's logged answer or decline delivered to the agent (FR-22); the same
// state when it logs none for the question.
const withDelivered = (state: LifecycleBoardState, itemId: string): LifecycleBoardState => {
  const at = state.questions.findIndex(
    (question) => question.itemId === itemId && isLogged(question),
  );
  const question = state.questions[at];
  if (!isLogged(question) || question.answer.receipt === "delivered") return state;
  const delivered = { ...question, answer: { ...question.answer, receipt: "delivered" as const } };
  const questions = [...state.questions] as [LifecycleQuestionStatus, ...LifecycleQuestionStatus[]];
  questions[at] = delivered;
  return { ...state, questions };
};

// The presentation after a settings message. A write that did not save leaves the file as it was,
// but the board keeps the value its user picked, which the panel shows beside the error
// (settings-languages, design decision 6).
const afterSettings = (model: BoardModel, message: SettingsMessage): ViewPresentation => {
  const next = presentationOf(message);
  const before = model.passedOn.presentation;
  const write = message.write;
  if (before === undefined || write === undefined || write.outcome === "saved") return next;
  return { ...next, [write.key]: before[write.key] };
};

/**
 * The model after a message from `board-host`: the board document, the state, a receipt, which
 * marks the logged answer delivered, who asked and where, the agent status and the settings. `moved`,
 * `discarded` and `refused` change the board's status, not what it knows of the board.
 */
export const withHostMessage = (
  model: BoardModel,
  message: HostMessage | BoardHostMessage,
): BoardModel => {
  switch (message.type) {
    case "board":
      return { ...model, document: message.document as LifecycleBoardDocument };
    case "state":
      return { ...model, state: message.state as LifecycleBoardState };
    case "origin": {
      const { version: _, type: __, ...origin } = message;
      return { ...model, passedOn: { ...model.passedOn, origin } };
    }
    case "agent":
      return { ...model, passedOn: { ...model.passedOn, agent: message.status } };
    case "settings":
      return {
        ...model,
        settings: message,
        passedOn: { ...model.passedOn, presentation: afterSettings(model, message) },
      };
    case "receipt": {
      if (model.state === undefined) return model;
      const state = withDelivered(model.state, message.itemId);
      return state === model.state ? model : { ...model, state };
    }
    default:
      return model;
  }
};

/**
 * Why the board page cannot act on a state, if it cannot: it must name each question of the board
 * document at its revision, and nothing else (AD-10). The schemas cannot see this, since the two
 * come in separate messages.
 */
export const stateProblem = (
  document: LifecycleBoardDocument | undefined,
  state: LifecycleBoardState,
): string | undefined => {
  if (document === undefined) return "the state came before the board document";
  const questions = questionsOf(document);
  for (const { itemId, rev } of state.questions) {
    if (!questions.some((item) => item.id === itemId && item.rev === rev)) {
      return `the state names "${itemId}", which the board document does not hold at revision ${rev}`;
    }
  }
  const missing = questions.find(
    (item) => !state.questions.some((question) => question.itemId === item.id),
  );
  return missing === undefined ? undefined : `the state leaves out "${missing.id}"`;
};

/** The model after the view reported a question visible or an item failing. */
export const withViewMessage = (
  model: BoardModel,
  message: ViewReady | ViewItemError,
): BoardModel => {
  switch (message.type) {
    case "ready":
      return { ...model, visible: new Set(model.visible).add(message.itemId) };
    case "item-error":
      return { ...model, failed: new Map(model.failed).set(message.itemId, message.error) };
  }
};

/**
 * What the view boots from, once the board page has both the board document and the state, with
 * the fields it passes on that the view boots from, when it has them.
 */
export const bootDataOf = (model: BoardModel): BootData | undefined => {
  const { document, state, passedOn } = model;
  if (document === undefined || state === undefined) return undefined;
  return { document, state, ...bootFieldsOf(passedOn) };
};

export type ActsOrRefusal =
  | { readonly ok: true; readonly value: readonly [Act, ...Act[]] }
  | { readonly ok: false; readonly detail: string };

const refuse = (detail: string): ActsOrRefusal => ({ ok: false, detail });

type Known = {
  readonly document: LifecycleBoardDocument;
  readonly state: LifecycleBoardState;
  readonly question: ViewQuestion;
};

// Acts that name the revision the user acted on, which must be the board's (AD-20); answers,
// declines and follow-ups may name an earlier one the question keeps, which ask-core checks.
const CURRENT_REVISION_ONLY: ReadonlySet<ViewAct["type"]> = new Set([
  "postpone",
  "note",
  "edit-choice",
]);

const revisionProblem = (act: ViewAct, question: ViewQuestion): string | undefined => {
  if (act.type === "reopen") return undefined;
  const exact = CURRENT_REVISION_ONLY.has(act.type);
  if (act.rev > question.rev || (exact && act.rev !== question.rev)) {
    return `the question is at revision ${question.rev}, not ${act.rev}`;
  }
  if (act.type === "edit-choice" && act.edit === "ignore" && act.keptRev >= act.rev) {
    return `the kept revision ${act.keptRev} is not before revision ${act.rev}`;
  }
  return undefined;
};

// An answer's content against the question's current revision: its labels, one unless
// `multiSelect`, "Other…" only where it is offered, option notes on its labels (FR-3).
const contentProblem = (
  answer: Extract<ViewAct, { readonly type: "answer" }>,
  question: ViewQuestion,
): string | undefined => {
  if (
    answer.choice === undefined &&
    answer.other === undefined &&
    answer.values === undefined &&
    answer.results === undefined
  ) {
    return "the answer carries no choice, no Other… text, no widget value and no result";
  }
  if (answer.rev !== question.rev) return undefined;
  const labels = new Set((question.props.options ?? []).map((option) => option.label));
  const unknown = (answer.choice ?? []).find((label) => !labels.has(label));
  if (unknown !== undefined) return `the question offers no option "${unknown}"`;
  if (question.props.multiSelect !== true && (answer.choice ?? []).length > 1) {
    return "the question takes one option";
  }
  if (answer.other !== undefined && question.props.allowOther !== true) {
    return "the question offers no Other… row";
  }
  const noted = Object.keys(answer.optionNotes ?? {}).find((label) => !labels.has(label));
  if (noted !== undefined) return `the question offers no option "${noted}" to note`;
  return undefined;
};

// Each key of an answer's widget values names a widget item of its question (design decision 8);
// checked against the current revision only, since ask-core checks an earlier one it keeps.
const valuesProblem = (
  answer: Extract<ViewAct, { readonly type: "answer" }>,
  question: ViewQuestion,
): string | undefined => {
  if (answer.values === undefined || answer.rev !== question.rev) return undefined;
  const widgets = new Set(valueItemsOf(question.props.items).map((item) => item.id));
  const foreign = Object.keys(answer.values).find((itemId) => !widgets.has(itemId));
  return foreign === undefined
    ? undefined
    : `the answer carries a value for "${foreign}", which is not a widget item of the question`;
};

// Each key of an answer's results names a widget item of its question, as the values' keys do
// (widget-registry, design decision 9): own keys only, so `__proto__` names nothing. Whether the
// item's type declares a result, and the result itself, are ask-core's to check.
const resultsProblem = (
  answer: Extract<ViewAct, { readonly type: "answer" }>,
  question: ViewQuestion,
): string | undefined => {
  if (answer.results === undefined || answer.rev !== question.rev) return undefined;
  const widgets = new Set(valueItemsOf(question.props.items).map((item) => item.id));
  const foreign = Object.keys(answer.results).find((itemId) => !widgets.has(itemId));
  return foreign === undefined
    ? undefined
    : `the answer carries a result for "${foreign}", which is not a widget item of the question`;
};

const actProblem = (model: BoardModel, known: Known, act: ViewAct): string | undefined => {
  const { question } = known;
  if (model.failed.has(question.id)) return "the question's item failed in the view";
  if (!model.visible.has(question.id)) return "the question never counted as visible";
  const revision = revisionProblem(act, question);
  if (revision !== undefined) return revision;
  if (act.type !== "answer") return undefined;
  return (
    valuesProblem(act, question) ?? resultsProblem(act, question) ?? contentProblem(act, question)
  );
};

/**
 * The acts of one command, as the board protocol has them, or why the board page refuses the
 * command: each act must name a question of the board, visible and not failed, at the revision
 * the user acted on, with an answer's content the question offers and widget values only for its own widget items, on an ask
 * that is not closed (AD-9, AD-10, FR-6). `board-host` checks them again; this keeps the board
 * page from sending what it knows cannot be applied.
 */
export const actsFor = (model: BoardModel, acts: readonly ViewAct[]): ActsOrRefusal => {
  const { document, state } = model;
  if (document === undefined || state === undefined) return refuse("there is no board yet");
  if (state.ask === "closed") return refuse("the ask is closed");
  const questions = questionsOf(document);
  for (const [index, act] of acts.entries()) {
    const question = questions.find((item) => item.id === act.itemId);
    const problem =
      question === undefined
        ? `the board has no question "${act.itemId}"`
        : actProblem(model, { document, state, question }, act);
    if (problem !== undefined) {
      return refuse(acts.length === 1 ? problem : `act ${index + 1}: ${problem}`);
    }
  }
  const [first, ...rest] = acts as readonly Act[];
  return first === undefined
    ? refuse("the command holds no act")
    : { ok: true, value: [first, ...rest] };
};

/** The view's answer as one answer act, or why the board page refuses it (AD-10). */
export const answerActFor = (model: BoardModel, answer: ViewAnswer): ActsOrRefusal => {
  const { type: _, ...fields } = answer;
  return actsFor(model, [{ type: "answer", ...fields }]);
};

/** A question as it stood when the user acted on it: a held command is resent only on that. */
export type ActBasis = { readonly itemId: string; readonly rev: number; readonly state: string };

/** Each act's question as the board stands now, for the outbox (AD-10). */
export const basisOf = (
  model: BoardModel,
  acts: readonly { readonly itemId: string }[],
): ActBasis[] => {
  const questions = model.document === undefined ? [] : questionsOf(model.document);
  return acts.map(({ itemId }) => ({
    itemId,
    rev: questions.find((question) => question.id === itemId)?.rev ?? 0,
    state:
      model.state?.questions.find((question) => question.itemId === itemId)?.state ?? "unknown",
  }));
};
