// What the board page knows of its board (design decision 8): the board document and the state as
// `board-host` last sent them, each checked against the board protocol on arrival, and what the
// view reported of its questions (AD-9). Each message makes a new model.

import type { BoardDocument, BoardState, HostMessage } from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import type { ViewMessage } from "../view-protocol.ts";

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
export const withViewMessage = (model: BoardModel, message: ViewMessage): BoardModel => {
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
