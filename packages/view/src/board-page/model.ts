// What the board page knows of its board (design decision 8): the board document and the state as
// `board-host` last sent them, each checked against the board protocol on arrival, and what the
// view reported of its questions (AD-9). Each message makes a new model.

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

/**
 * The model after a message from `board-host`. Task 8.6 adds the receipt, the discard, the move
 * and the refusals; until then they leave the model as it is.
 */
export const withHostMessage = (model: BoardModel, message: HostMessage): BoardModel => {
  switch (message.type) {
    case "board":
      return { ...model, document: message.document };
    case "state":
      return { ...model, state: message.state };
    default:
      return model;
  }
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

/**
 * The board-protocol command for the view's answer, or why the board page refuses it: the answer
 * must name a question of the board at its revision, open in the state, visible and not failed,
 * with labels the question offers, one unless it is `multiSelect` (AD-9, AD-10). `board-host`
 * checks it again; this keeps the board page from sending what it knows cannot be an answer.
 */
export const answerCommandFor = (model: BoardModel, answer: ViewAnswer): CommandOrRefusal => {
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
  const unknown = answer.choice.find((label) => !labels.has(label));
  if (unknown !== undefined) return refuse(`the question offers no option "${unknown}"`);
  if (question.props.multiSelect !== true && answer.choice.length !== 1) {
    return refuse("the question takes one option");
  }
  return {
    ok: true,
    value: {
      version: BOARD_PROTOCOL_VERSION,
      type: "answer",
      itemId: answer.itemId,
      rev: answer.rev,
      choice: [...answer.choice],
      when: answer.when,
    },
  };
};
