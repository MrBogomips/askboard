// The board protocol (owner `board-host`, AD-7): the messages between the board page and
// `board-host` over the board's WebSocket. Each message names the protocol version, whose shared
// schema holds the minor-version rule; a receiver looks a message's schema up by direction and
// `type`, since no schema has a root combinator.

import type { SchemaSet } from "../../versions.ts";
import type { BoardDocument } from "../board-document/index.ts";
import answer from "./answer.json" with { type: "json" };
import board from "./board.json" with { type: "json" };
import boardState from "./board-state.json" with { type: "json" };
import connect from "./connect.json" with { type: "json" };
import discarded from "./discarded.json" with { type: "json" };
import moved from "./moved.json" with { type: "json" };
import receipt from "./receipt.json" with { type: "json" };
import refused from "./refused.json" with { type: "json" };
import state from "./state.json" with { type: "json" };
import time from "./time.json" with { type: "json" };
import version from "./version.json" with { type: "json" };

export const BOARD_PROTOCOL_VERSION = "1.0";

export const boardProtocol: SchemaSet = {
  name: "board-protocol",
  title: "board protocol",
  owner: "board-host",
  version: BOARD_PROTOCOL_VERSION,
  schemas: [
    version,
    time,
    boardState,
    connect,
    answer,
    board,
    state,
    receipt,
    discarded,
    moved,
    refused,
  ],
};

const schemaId = (type: string) => `urn:askboard:board-protocol:${type}`;

/** Each direction's message types, with the `$id` of each type's schema. */
export const BOARD_PROTOCOL_MESSAGES = {
  /** Sent by the board page, received by `board-host`. */
  toHost: { connect: schemaId("connect"), answer: schemaId("answer") },
  /** Sent by `board-host`, received by the board page. */
  toPage: {
    board: schemaId("board"),
    state: schemaId("state"),
    receipt: schemaId("receipt"),
    discarded: schemaId("discarded"),
    moved: schemaId("moved"),
    refused: schemaId("refused"),
  },
} as const;

export type BoardMessageDirection = keyof typeof BOARD_PROTOCOL_MESSAGES;

/** The first message on every board WebSocket. */
export type ConnectMessage = {
  readonly version: string;
  readonly type: "connect";
  readonly token: string;
};

/** The user's explicit answer: one label unless the question is `multiSelect` (AD-10). */
export type AnswerCommand = {
  readonly version: string;
  readonly type: "answer";
  readonly itemId: string;
  readonly rev: number;
  readonly choice: readonly string[];
  /** RFC 3339 UTC, stamped by the board when the user acted (FR-19). */
  readonly when: string;
};

export type PageMessage = ConnectMessage | AnswerCommand;

/** "not sent yet" is the board's own receipt, for an answer still queued on the page. */
export type Receipt = "sent" | "delivered";

export type LoggedAnswer = {
  readonly choice: readonly string[];
  readonly when: string;
  readonly receipt: Receipt;
};

export type QuestionStatus =
  | { readonly itemId: string; readonly rev: number; readonly state: "open" }
  | {
      readonly itemId: string;
      readonly rev: number;
      readonly state: "answered";
      readonly answer: LoggedAnswer;
    };

export type BoardState = {
  readonly ask: "waiting" | "answered";
  readonly questions: readonly [QuestionStatus];
};

export type BoardMessage = {
  readonly version: string;
  readonly type: "board";
  readonly document: BoardDocument;
};

export type StateMessage = {
  readonly version: string;
  readonly type: "state";
  readonly state: BoardState;
};

export type ReceiptMessage = {
  readonly version: string;
  readonly type: "receipt";
  readonly itemId: string;
  readonly receipt: "delivered";
};

export type DiscardedMessage = {
  readonly version: string;
  readonly type: "discarded";
  readonly reason: "session-exit";
};

export type MovedMessage = { readonly version: string; readonly type: "moved" };

export type RefusalReason = "token" | "message" | "version" | "answer";

export type RefusedMessage = {
  readonly version: string;
  readonly type: "refused";
  readonly reason: RefusalReason;
  readonly detail: string;
  readonly itemId?: string;
};

export type HostMessage =
  | BoardMessage
  | StateMessage
  | ReceiptMessage
  | DiscardedMessage
  | MovedMessage
  | RefusedMessage;
