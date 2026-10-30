// The board protocol over each board's WebSocket (design decision 5; AD-3, AD-10, AD-11, AD-21).
// Until a socket's `connect` is accepted, nothing of the ask reaches it: a first message of another
// major is refused with reason `version`, any other first message that is not `connect` with the
// board's token with reason `token`, and the socket is closed. Once accepted, the socket is the
// ask's live board: a newer one takes it over, refusals leave it open and the ask unchanged, and
// ask-core's events reach it as state, receipts and the discard.

import {
  type AnswerCommand,
  BOARD_CLOSE_CODES,
  CHOICE_LABELS_MAX_CHARS,
  type HostMessage,
} from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { BoardView, CoreEvent } from "@askboard/core";
import { type RawData, WebSocket } from "ws";
import type { HostCore } from "./index.ts";
import {
  boardMessage,
  DISCARDED,
  MOVED,
  problemsDetail,
  receiptMessage,
  refusedMessage,
  stateMessage,
} from "./messages.ts";
import type { BoardTokens } from "./tokens.ts";

/**
 * The largest message a board page may send: an answer naming every option of a question whose
 * labels take the contract's most room, at three UTF-8 bytes per UTF-16 unit, plus the envelope.
 * It bounds what the schema validator, which reports every error, ever reads.
 */
export const MESSAGE_MAX_BYTES = CHOICE_LABELS_MAX_CHARS * 3 + 4 * 1024;

/**
 * The most a board's socket may hold unsent: a peer that keeps sending without reading the replies
 * is ended at this point, rather than growing the session process's memory.
 */
export const SEND_BUFFER_MAX_BYTES = 1024 * 1024;

/** How long closing the host waits for the boards' sockets to finish their close handshake. */
export const CLOSE_GRACE_MS = 500;

/** RFC 6455's "going away": the session process is closing the board listener. */
const GOING_AWAY = 1001;

const FIRST_MESSAGE = "the first message on a board's socket is connect with its token";
const NOT_THIS_SESSION = "the token does not open a board of this session";
const NOT_JSON = "a board-protocol message is a JSON object in a text frame";
const CONNECTED = "the board is already connected";

type Connection = {
  readonly socket: WebSocket;
  readonly askId: string;
  phase: "waiting" | "live" | "closed";
  /** The questions this board has been told were delivered to the agent. */
  readonly delivered: Set<string>;
};

const parse = (data: RawData, binary: boolean): unknown => {
  if (binary) return undefined;
  const text = Array.isArray(data)
    ? Buffer.concat(data).toString("utf8")
    : Buffer.from(data as ArrayBuffer).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// The answer command a message on a live socket carries, or the refusal it gets: the socket stays
// open and the ask unchanged.
const commandOf = (value: unknown): AnswerCommand | HostMessage => {
  if (value === undefined) return refusedMessage("message", NOT_JSON);
  const checked = validateBoardMessage("toHost", value);
  if (!checked.ok) {
    const reason = checked.reason === "version" ? "version" : "message";
    return refusedMessage(reason, problemsDetail(checked.problems));
  }
  if (checked.value.type === "connect") return refusedMessage("message", CONNECTED);
  return checked.value;
};

type Refusal = { readonly reason: "token" | "version"; readonly detail: string };

export type BoardsDeps = {
  readonly core: HostCore;
  readonly tokens: BoardTokens;
  readonly report: (error: unknown) => void;
};

/** Every board socket of the session process, and each ask's live one. */
export class Boards {
  readonly #core: HostCore;
  readonly #tokens: BoardTokens;
  readonly #report: (error: unknown) => void;
  readonly #live = new Map<string, Connection>();
  readonly #sockets = new Set<WebSocket>();
  // Set when the host starts closing: no socket is accepted or heard from then.
  #closing = false;

  constructor(deps: BoardsDeps) {
    this.#core = deps.core;
    this.#tokens = deps.tokens;
    this.#report = deps.report;
  }

  /** Takes a socket opened at `/ws/<askId>`; it waits for its `connect`. */
  attach(socket: WebSocket, askId: string): void {
    const connection: Connection = { socket, askId, phase: "waiting", delivered: new Set() };
    this.#sockets.add(socket);
    socket.on("message", (data, binary) =>
      this.#guard(() => this.#receive(connection, data, binary)),
    );
    socket.on("error", (error) => this.#report(error));
    socket.on("close", () => {
      this.#sockets.delete(socket);
      connection.phase = "closed";
      // Closing a board discards nothing (AD-21): only the live slot is freed.
      if (this.#live.get(askId) === connection) this.#live.delete(askId);
    });
  }

  /** ask-core's events, forwarded to the ask's live board. */
  hear(event: CoreEvent): void {
    const connection = this.#live.get(event.askId);
    if (connection === undefined) return;
    this.#guard(() => {
      if (event.type === "appended") this.#sendState(connection);
      else if (event.type === "received") this.#sendReceipts(connection);
      else this.#discard(connection);
    });
  }

  /**
   * Closes every socket with "going away" and waits for their close handshakes, those already
   * closing included, within `CLOSE_GRACE_MS`; any socket still open then is ended.
   */
  async closeAll(): Promise<void> {
    this.#closing = true;
    const sockets = [...this.#sockets];
    const closed = sockets.map(
      (socket) =>
        new Promise<void>((resolve) => {
          if (socket.readyState === WebSocket.CLOSED) resolve();
          else socket.once("close", () => resolve());
        }),
    );
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.close(GOING_AWAY);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, CLOSE_GRACE_MS);
    });
    await Promise.race([Promise.all(closed), bound]);
    clearTimeout(timer);
    for (const socket of this.#sockets) socket.terminate();
  }

  #guard(run: () => void): void {
    try {
      run();
    } catch (error) {
      this.#report(error);
    }
  }

  #receive(connection: Connection, data: RawData, binary: boolean): void {
    if (connection.phase === "closed" || this.#closing) return;
    const value = parse(data, binary);
    if (connection.phase === "waiting") this.#connect(connection, value);
    else this.#command(connection, value);
  }

  // The board a first message opens, or why it opens none.
  #opening(askId: string, value: unknown): BoardView | Refusal {
    const checked = validateBoardMessage("toHost", value);
    if (!checked.ok && checked.reason === "version") {
      return { reason: "version", detail: problemsDetail(checked.problems) };
    }
    if (!checked.ok || checked.value.type !== "connect") {
      return { reason: "token", detail: FIRST_MESSAGE };
    }
    const board = this.#tokens.opens(askId, checked.value.token)
      ? this.#core.board(askId)
      : undefined;
    // A discarded ask's token stops working (AD-21).
    if (board === undefined || board.state === "discarded") {
      return { reason: "token", detail: NOT_THIS_SESSION };
    }
    return board;
  }

  #connect(connection: Connection, value: unknown): void {
    const opening = this.#opening(connection.askId, value);
    if ("reason" in opening) {
      this.#send(connection, refusedMessage(opening.reason, opening.detail));
      this.#close(connection, BOARD_CLOSE_CODES.refused);
    } else {
      this.#accept(connection, opening);
    }
  }

  #accept(connection: Connection, board: BoardView): void {
    const previous = this.#live.get(connection.askId);
    this.#live.set(connection.askId, connection);
    connection.phase = "live";
    if (previous !== undefined) {
      this.#send(previous, MOVED);
      this.#close(previous, BOARD_CLOSE_CODES.moved);
    }
    this.#send(connection, boardMessage(board));
    this.#sendState(connection);
  }

  #command(connection: Connection, value: unknown): void {
    const command = commandOf(value);
    if (command.type !== "answer") {
      this.#send(connection, command);
      return;
    }
    const { itemId, rev, choice, when } = command;
    const outcome = this.#core.answer(connection.askId, { itemId, rev, choice, when });
    // An accepted answer reaches this board as ask-core's event, which sends the state.
    if (!outcome.ok) {
      this.#send(connection, refusedMessage("answer", outcome.detail, itemId));
      this.#sendState(connection);
    }
  }

  // The ask's state, unless it is discarded: its board then hears the discard instead.
  #sendState(connection: Connection): void {
    const board = this.#core.board(connection.askId);
    if (board === undefined || board.state === "discarded") return;
    for (const question of board.questions) {
      if (question.answer?.delivered) connection.delivered.add(question.itemId);
    }
    this.#send(connection, stateMessage(board));
  }

  // A receipt for each answer `received` has newly passed (AD-3): delivery only, never reading.
  #sendReceipts(connection: Connection): void {
    const board = this.#core.board(connection.askId);
    for (const question of board?.questions ?? []) {
      if (!question.answer?.delivered || connection.delivered.has(question.itemId)) continue;
      connection.delivered.add(question.itemId);
      this.#send(connection, receiptMessage(question.itemId));
    }
  }

  #discard(connection: Connection): void {
    this.#live.delete(connection.askId);
    this.#send(connection, DISCARDED);
    this.#close(connection, BOARD_CLOSE_CODES.discarded);
  }

  #send(connection: Connection, message: HostMessage): void {
    const { socket } = connection;
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > SEND_BUFFER_MAX_BYTES) {
      connection.phase = "closed";
      socket.terminate();
      return;
    }
    socket.send(JSON.stringify(message));
  }

  #close(connection: Connection, code: number): void {
    connection.phase = "closed";
    connection.socket.close(code);
  }
}
