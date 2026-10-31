// What the board page knows of its board (design decision 8): the board document and the state as
// `board-host` last sent them, each checked against the board protocol on arrival, with the
// receipts since, and what the view reported of its questions (AD-9). Each message makes a new
// model. The connection's status, the held answers and the banners are the controller's.

import {
  type AnswerCommand,
  BOARD_PROTOCOL_VERSION,
  type BoardDocument,
  type BoardState,
  type HostMessage,
} from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import type { ViewAnswer, ViewItemError, ViewReady } from "../view-protocol.ts";

export type BoardModel = {
  readonly document?: BoardDocument;
  readonly state?: BoardState;
  /** Questions the view reported visible: all their items ready (SM-C2). */
  readonly visible: ReadonlySet<string>;
  /** Items the view reported failing, with the error (AD-9, AD-10). */
  readonly failed: ReadonlyMap<string, string>;
};

export const EMPTY_MODEL: BoardModel = { visible: new Set(), failed: new Map() };

// The state with the question's logged answer delivered to the agent (FR-22); the same state when
// it logs no answer for the question.
const withDelivered = (state: BoardState, itemId: string): BoardState => {
  const at = state.questions.findIndex(
    (question) => question.itemId === itemId && question.state === "answered",
  );
  const question = state.questions[at];
  if (question?.state !== "answered" || question.answer.receipt === "delivered") return state;
  const delivered = { ...question, answer: { ...question.answer, receipt: "delivered" as const } };
  const questions: [...BoardState["questions"]] = [...state.questions];
  questions[at] = delivered;
  return { ...state, questions };
};

/**
 * The model after a message from `board-host`: the board document, the state, and a receipt,
 * which marks the logged answer delivered. `moved`, `discarded` and `refused` change the board's
 * status, not what it knows of the board.
 */
export const withHostMessage = (model: BoardModel, message: HostMessage): BoardModel => {
  switch (message.type) {
    case "board":
      return { ...model, document: message.document };
    case "state":
      return { ...model, state: message.state };
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
  document: BoardDocument | undefined,
  state: BoardState,
): string | undefined => {
  if (document === undefined) return "the state came before the board document";
  for (const { itemId, rev } of state.questions) {
    if (!document.items.some((item) => item.id === itemId && item.rev === rev)) {
      return `the state names "${itemId}", which the board document does not hold at revision ${rev}`;
    }
  }
  const missing = document.items.find(
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

/** What the view boots from, once the board page has both the board document and the state. */
export const bootDataOf = (model: BoardModel): BootData | undefined =>
  model.document === undefined || model.state === undefined
    ? undefined
    : { document: model.document, state: model.state };

export type CommandOrRefusal =
  | { readonly ok: true; readonly value: AnswerCommand }
  | { readonly ok: false; readonly detail: string };

const refuse = (detail: string): CommandOrRefusal => ({ ok: false, detail });

// What the board protocol cannot carry yet: its answer command has a choice and no widget value
// (design decision 7). The question stays open, since the view drops a refused act.
const NO_WIDGET_VALUE = "the board protocol carries no widget value yet";

/**
 * The board-protocol command for the view's answer, or why the board page refuses it: the answer
 * must carry a choice and no widget value, and name a question of the board at its revision, open
 * in the state, visible and not failed, with labels the question offers, one unless it is
 * `multiSelect` (AD-9, AD-10). `board-host` checks it again; this keeps the board page from
 * sending what it knows cannot be an answer.
 */
export const answerCommandFor = (model: BoardModel, answer: ViewAnswer): CommandOrRefusal => {
  if (answer.values !== undefined) return refuse(NO_WIDGET_VALUE);
  const { choice } = answer;
  if (choice === undefined) return refuse(`the answer carries no choice, and ${NO_WIDGET_VALUE}`);
  const { document, state } = model;
  if (document === undefined || state === undefined) return refuse("there is no board yet");
  const question = document.items.find((item) => item.id === answer.itemId);
  if (question === undefined) return refuse(`the board has no question "${answer.itemId}"`);
  if (answer.rev !== question.rev) {
    return refuse(`the question is at revision ${question.rev}, not ${answer.rev}`);
  }
  const status = state.questions.find((entry) => entry.itemId === answer.itemId);
  if (status?.state !== "open") return refuse("the question is not open");
  if (model.failed.has(answer.itemId)) return refuse("the question's item failed in the view");
  if (!model.visible.has(answer.itemId)) return refuse("the question never counted as visible");
  const labels = new Set(question.props.options.map((option) => option.label));
  const unknown = choice.find((label) => !labels.has(label));
  if (unknown !== undefined) return refuse(`the question offers no option "${unknown}"`);
  if (question.props.multiSelect !== true && choice.length !== 1) {
    return refuse("the question takes one option");
  }
  return {
    ok: true,
    value: {
      version: BOARD_PROTOCOL_VERSION,
      type: "answer",
      itemId: answer.itemId,
      rev: answer.rev,
      choice: [...choice],
      when: answer.when,
    },
  };
};
