// Board-protocol transcripts of the plain-choice ask, the seam between the tracks (design decision
// 13). `board-host`'s tests replay the board page's half and compare what they get with the host's
// half (Track A, 6.4); the view's test server replays the host's half to the real board page
// (Track B, 8.3). The transcripts with an `invalid` step or a duplicate answer exercise
// `board-host`'s refusals, which the real board page never provokes, so they serve Track A only.
//
// Replaying:
// - Messages compare exactly, except a `refused` message's `detail`, which is text for people: a
//   replaying side checks only that it is there.
// - A `session` or `user` step is what happens off the wire meanwhile, and the replaying side makes
//   it happen: the agent's `collect` returning the answer, the session process exiting, or the user
//   answering on the board (a no-op for the side that replays the board page's half).
// - A socket still open after the last step stays open until the test ends.

import { BOARD_CLOSE_CODES, type BoardCloseCode } from "../constants.ts";
import { boardLink } from "../routes.ts";
import {
  BOARD_PROTOCOL_VERSION,
  type HostMessage,
  type LoggedAnswer,
  type PageMessage,
} from "../schemas/board-protocol/index.ts";
import { plainChoiceBoardDocument } from "./board-document.ts";

const version = BOARD_PROTOCOL_VERSION;

/** The plain-choice session of the approved examples (`results/plain-choice.json`). */
export const PLAIN_CHOICE = {
  epoch: "k3x9",
  askId: "order-db-choice-x7k2",
  port: 47213,
  token: "pV3xK9qLmT2wR7nB4cYh8A",
  get link(): string {
    return boardLink(this);
  },
} as const;

export type TranscriptStep =
  | { readonly socket: number; readonly from: "page"; readonly message: PageMessage }
  /** What the board page sends that the protocol refuses; `board-host` answers it with `refused`. */
  | {
      readonly socket: number;
      readonly from: "page";
      readonly invalid: Readonly<Record<string, unknown>>;
    }
  | { readonly socket: number; readonly from: "host"; readonly message: HostMessage }
  /** `board-host` closes the socket with this code, right after the message the code is named for. */
  | { readonly socket: number; readonly from: "host"; readonly close: BoardCloseCode }
  /** The connection drops with no close frame: the replaying side terminates its end of the socket. */
  | { readonly socket: number; readonly from: "network"; readonly drop: true }
  /** `collected`: the agent's `collect` returned the answer; `exit`: the session process exits. */
  | { readonly socket?: undefined; readonly from: "session"; readonly event: "collected" | "exit" }
  /** The user selects these options and presses "Answer". */
  | {
      readonly socket?: undefined;
      readonly from: "user";
      readonly event: "answer";
      readonly choice: readonly string[];
    };

export type Transcript = {
  readonly askId: string;
  /** The token every socket of the transcript presents. */
  readonly token: string;
  readonly steps: readonly TranscriptStep[];
};

const { askId, token } = PLAIN_CHOICE;
const { id: itemId, rev } = plainChoiceBoardDocument.items[0];
const when = "2026-10-29T09:41:27Z";
const choice = ["PostgreSQL"];

const answer = { version, type: "answer", itemId, rev, choice, when } as const;
const logged = (receipt: LoggedAnswer["receipt"]): LoggedAnswer => ({ choice, when, receipt });
const answered = (receipt: LoggedAnswer["receipt"]): HostMessage => ({
  version,
  type: "state",
  state: {
    ask: "answered",
    questions: [{ itemId, rev, state: "answered", answer: logged(receipt) }],
  },
});
const waiting: HostMessage = {
  version,
  type: "state",
  state: { ask: "waiting", questions: [{ itemId, rev, state: "open" }] },
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };

/** The opening of an accepted socket: the token first, then the board document and the state. */
const opening = (socket: number, state: HostMessage = waiting): TranscriptStep[] => [
  { socket, from: "page", message: { version, type: "connect", token } },
  { socket, from: "host", message: board },
  { socket, from: "host", message: state },
];

const tokenRefusal = (socket: number, detail: string): TranscriptStep[] => [
  { socket, from: "host", message: { version, type: "refused", reason: "token", detail } },
  { socket, from: "host", close: BOARD_CLOSE_CODES.refused },
];

/**
 * The user opens the board, answers PostgreSQL and the agent collects the answer; the link is
 * then opened in a second tab, which takes the board over; the session ends with the board open.
 */
export const plainChoiceTranscript: Transcript = {
  askId,
  token,
  steps: [
    ...opening(1),
    { from: "user", event: "answer", choice },
    { socket: 1, from: "page", message: answer },
    { socket: 1, from: "host", message: answered("sent") },
    { from: "session", event: "collected" },
    {
      socket: 1,
      from: "host",
      message: { version, type: "receipt", itemId, receipt: "delivered" },
    },
    { socket: 2, from: "page", message: { version, type: "connect", token } },
    { socket: 1, from: "host", message: { version, type: "moved" } },
    { socket: 1, from: "host", close: BOARD_CLOSE_CODES.moved },
    { socket: 2, from: "host", message: board },
    { socket: 2, from: "host", message: answered("delivered") },
    { from: "session", event: "exit" },
    { socket: 2, from: "host", message: { version, type: "discarded", reason: "session-exit" } },
    { socket: 2, from: "host", close: BOARD_CLOSE_CODES.discarded },
  ],
};

/**
 * After the session process restarted, the board reconnects with its old token, which the new
 * process does not know: the board then shows the ask as discarded (AD-21).
 */
export const restartTranscript: Transcript = {
  askId,
  token,
  steps: [
    { socket: 1, from: "page", message: { version, type: "connect", token } },
    ...tokenRefusal(1, "the token does not open a board of this session"),
  ],
};

/**
 * A second answer to the answered question is refused, naming the item, and the state that
 * follows still holds the first answer (core spec, "Answers only from an explicit user action").
 */
export const duplicateAnswerTranscript: Transcript = {
  askId,
  token,
  steps: [
    ...opening(1),
    { from: "user", event: "answer", choice },
    { socket: 1, from: "page", message: answer },
    { socket: 1, from: "host", message: answered("sent") },
    { socket: 1, from: "page", message: answer },
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "refused",
        reason: "answer",
        itemId,
        detail: "the question is already answered",
      },
    },
    { socket: 1, from: "host", message: answered("sent") },
  ],
};

/**
 * The connection drops, the user answers while it is lost ("not sent yet"), and the board page
 * reconnects. It sends the queued answer, stamped when the user acted, only after the new socket's
 * state shows the question still open, and the answer is logged once (view spec, "Answering while
 * disconnected").
 */
export const resendAfterDropTranscript: Transcript = {
  askId,
  token,
  steps: [
    ...opening(1),
    { socket: 1, from: "network", drop: true },
    { from: "user", event: "answer", choice },
    ...opening(2),
    { socket: 2, from: "page", message: answer },
    { socket: 2, from: "host", message: answered("sent") },
  ],
};

/**
 * Messages outside the schema on an accepted socket are refused with reason `message`; the socket
 * stays open and the ask unchanged (board-host spec, "A message outside the schema").
 */
export const schemaRefusalTranscript: Transcript = {
  askId,
  token,
  steps: [
    ...opening(1),
    { socket: 1, from: "page", invalid: { version, type: "telemetry", itemId } },
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "refused",
        reason: "message",
        detail: '"telemetry" is not a message the board page sends',
      },
    },
    { socket: 1, from: "page", invalid: { ...answer, choice: [] } },
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "refused",
        reason: "message",
        detail: "/choice: must NOT have fewer than 1 items",
      },
    },
  ],
};

/**
 * A `connect` of major version 2 is refused with reason `version`, naming the supported version,
 * and the socket is closed (contract spec, "A board-protocol message from another major").
 */
export const versionRefusalTranscript: Transcript = {
  askId,
  token,
  steps: [
    { socket: 1, from: "page", invalid: { version: "2.0", type: "connect", token } },
    {
      socket: 1,
      from: "host",
      message: {
        version,
        type: "refused",
        reason: "version",
        detail: `the message is board protocol version 2.0, which is not supported: this receiver supports version 1 (${version})`,
      },
    },
    { socket: 1, from: "host", close: BOARD_CLOSE_CODES.refused },
  ],
};

/**
 * A socket whose first message is not `connect` presented no token: it is refused with reason
 * `token` and closed, and nothing of the ask reaches it (board-host spec, "A token per board").
 */
export const notConnectFirstTranscript: Transcript = {
  askId,
  token,
  steps: [
    { socket: 1, from: "page", message: answer },
    ...tokenRefusal(1, "the first message on a board's socket is connect with its token"),
  ],
};

/** Every transcript, by name. */
export const transcripts: Readonly<Record<string, Transcript>> = {
  plainChoice: plainChoiceTranscript,
  restart: restartTranscript,
  duplicateAnswer: duplicateAnswerTranscript,
  resendAfterDrop: resendAfterDropTranscript,
  schemaRefusal: schemaRefusalTranscript,
  versionRefusal: versionRefusalTranscript,
  notConnectFirst: notConnectFirstTranscript,
};

/** One valid message of every type in each direction, refusals of each reason included. */
export const boardProtocolExamples: {
  readonly toHost: readonly PageMessage[];
  readonly toPage: readonly HostMessage[];
} = {
  toHost: [{ version, type: "connect", token }, answer],
  toPage: [
    board,
    waiting,
    answered("sent"),
    answered("delivered"),
    { version, type: "receipt", itemId, receipt: "delivered" },
    { version, type: "discarded", reason: "session-exit" },
    { version, type: "moved" },
    {
      version,
      type: "refused",
      reason: "token",
      detail: "the token does not open a board of this session",
    },
    {
      version,
      type: "refused",
      reason: "message",
      detail: '"telemetry" is not a message the board page sends',
    },
    {
      version,
      type: "refused",
      reason: "version",
      detail: `the message is board protocol version 2.0, which is not supported: this receiver supports version 1 (${version})`,
    },
    {
      version,
      type: "refused",
      reason: "answer",
      itemId,
      detail: "the question is already answered",
    },
  ],
};
