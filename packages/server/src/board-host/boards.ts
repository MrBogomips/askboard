// The board protocol over each board's WebSocket (design decision 5; AD-3, AD-10, AD-11, AD-21).
// Until a socket's `connect` is accepted, nothing of the ask reaches it and it costs the host
// little: a first message that is not `connect` with the board's token is refused with reason
// `token` before the schema validator reads it, a `connect` with the token but of another major
// with reason `version`, and the socket is closed; a socket that sends more than
// `PRE_CONNECT_MAX_BYTES` before its `connect` is accepted is ended unanswered. Once accepted, the
// socket is the ask's live board: a newer one takes it over, refusals leave it open and the ask
// unchanged, and ask-core's events reach it as state, receipts and the discard.
//
// Protocol 1.1 (ask-lifecycle, design decision 5): accepting a board and the live board's close are
// reported to ask-core, which runs the grace timer (AD-21); a takeover tells the older tab that
// the board moved, takes its last draft for the takeover flush wait and answers its acts meanwhile,
// before the new tab opens; act commands are acknowledged with `done` or refused, then the state;
// drafts are checked, then held; agent changes reach the live board as a new board, a new state
// and `closed`.

import type { Duplex } from "node:stream";
//
// Push delivery: a live board's presence messages say whether the user works on it, which ask-core
// hears with `setWorking` until it closes or is taken over (`presence.ts`). With the session
// project given, a live board also gets who asked and where and the agent status at its opening,
// and each change of the status (`who-and-where.ts`).
//
// Each of ask-core's events, each page message and each part of a board's opening has one entry
// in a table, so that a change adding one adds its entry and edits no other.
//
// Snapshots (snapshot design decision 8): the live board's `snapshot` is taken by ask-core as the
// user's, with its unsent-work flag as it came, and answered on the tab that asked, naming the
// request; a request still waiting when the ask is discarded is answered `discarded` before the
// discard. A tab that lost the board takes none.

import {
  type ActCommand,
  type AgentStatus,
  type AnswerCommand,
  BOARD_CLOSE_CODES,
  BOARD_MESSAGE_MAX_BYTES,
  CHOICE_LABELS_MAX_CHARS,
  type ConnectMessage,
  type DiscardReason,
  type DraftMessage,
  type LifecycleHostMessage,
  type LifecyclePageMessage,
  type OpenEditorCommand,
  type OpenSourceCommand,
  type PresentationSetting,
  type SettingCommand,
  type SnapshotCommand,
  TAKEOVER_FLUSH_WAIT_MS,
} from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { ActOutcome, CoreEvent, SettingsView, SnapshotOutcome } from "@askboard/core";
import { type RawData, WebSocket } from "ws";
import { actReply, draftRefusal } from "./acts.ts";
import { editorOutcomeMessage, NO_SOURCE, sourceStateMessage } from "./context-messages.ts";
import { type EditorCommand, EditorLaunch, type EditorSpawn } from "./editor.ts";
import type { HostCore } from "./index.ts";
import {
  boardMessage,
  closedMessage,
  discardedMessage,
  draftMessage,
  MOVED,
  type OpenBoardView,
  problemsDetail,
  receiptMessage,
  refusedMessage,
  stateMessage,
} from "./messages.ts";
import { presenceOf } from "./presence.ts";
import { NO_SETTINGS, settingsMessage } from "./settings.ts";
import { snapshotDiscarded, snapshotFailedInside, snapshotReply } from "./snapshots.ts";
import type { BoardTokens } from "./tokens.ts";
import { agentMessage, originMessage } from "./who-and-where.ts";

/**
 * The largest message a board page may send: the contract's `BOARD_MESSAGE_MAX_BYTES`, which the
 * board page applies to every command before it sends one (oversized-acts), so the two layers
 * cannot disagree. It bounds what the schema validator, which reports every error, ever reads.
 */
export const MESSAGE_MAX_BYTES = BOARD_MESSAGE_MAX_BYTES;

/**
 * The most a socket may send before its `connect` is accepted, frames included: E1's bound on any
 * board message, an answer's labels at three UTF-8 bytes per UTF-16 unit plus the envelope, far
 * above what a `connect` takes. `MESSAGE_MAX_BYTES` holds only once `connect` is accepted, so a
 * socket without the board's token cannot make the host read a live board's largest message.
 */
export const PRE_CONNECT_MAX_BYTES = CHOICE_LABELS_MAX_CHARS * 3 + 4 * 1024;

/**
 * The most a board's socket may hold unsent: a peer that keeps sending without reading the replies
 * is ended at this point, rather than growing the session process's memory. It leaves room for the
 * largest message board-host sends, a restored draft record, beside the board and the state.
 */
export const SEND_BUFFER_MAX_BYTES = MESSAGE_MAX_BYTES + 1024 * 1024;

/**
 * How long a socket may wait before its first message. The board page sends `connect` as soon as
 * its socket opens, from the open event, which a hidden tab does not throttle the way it throttles
 * timers [F33]; a socket still silent then is refused like one whose first message is not `connect`.
 */
export const CONNECT_TIMEOUT_MS = 5_000;

/**
 * The most sockets that may wait for their first message at once, across every ask. A board page's
 * socket waits only for as long as its `connect` takes to arrive.
 */
export const WAITING_SOCKETS_MAX = 64;

/** What bounds the sockets that have not sent their first message yet, and the live ones. */
export type SocketLimits = {
  readonly connectTimeoutMs: number;
  readonly waitingMax: number;
  /** The most a socket may send before its `connect` is accepted: `PRE_CONNECT_MAX_BYTES`. */
  readonly preConnectMaxBytes: number;
  /** How long a tab that lost the board may send its last draft: the contract's wait. */
  readonly takeoverFlushMs: number;
  /** The most a socket may hold unsent: `SEND_BUFFER_MAX_BYTES`. */
  readonly sendBufferMaxBytes: number;
};

/** RFC 6455's "try again later": over the cap, the board page reconnects with backoff. */
const TRY_AGAIN_LATER = 1013;

/**
 * How long a board's socket may take to finish a close handshake, when the host closes or
 * board-host closes one socket, such as after a refusal before `connect`; past it, it is ended.
 */
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
  /** `moving`: it lost the board to a newer tab, which waits for its last draft. */
  phase: "waiting" | "live" | "moving" | "closed";
  /** The answers, by cursor, this board has been told were delivered to the agent. */
  readonly delivered: Set<string>;
  /** Whether its last presence message says the user works on it, as ask-core last heard. */
  working: boolean;
  /** Cancels the first-message timer of a waiting socket, or the flush wait of a moving one. */
  stopTimer: () => void;
  /** Stops counting what the socket sends before its `connect` is accepted. */
  stopCounting: () => void;
  /** Whether it has been sent the board, the state and the draft since it was accepted. */
  opened: boolean;
  /** The tab that took the board from this one, which opens once this one's flush ends. */
  successor?: Connection;
  /** The IDs of its Snapshot requests ask-core has not finished. */
  readonly snapshots: Set<string>;
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

type PageCommand =
  | Exclude<LifecyclePageMessage | OpenSourceCommand | OpenEditorCommand, ConnectMessage>
  | SettingCommand
  | SnapshotCommand;

/** What a live board does with each of ask-core's events, by type. */
type Heard = {
  readonly [T in CoreEvent["type"]]: (
    connection: Connection,
    event: Extract<CoreEvent, { readonly type: T }>,
  ) => void;
};

/** What a live board does with each page command, by type, once the validator checked it. */
type Commands = {
  readonly [T in PageCommand["type"]]: (
    connection: Connection,
    command: Extract<PageCommand, { readonly type: T }>,
  ) => void;
};

/** One part of a board's opening, sent when it applies; `settings` when ask-core read them. */
type Opener = (connection: Connection, board: OpenBoardView, settings?: SettingsView) => void;

// The size of a message as it arrived, in bytes.
const sizeOf = (data: RawData): number =>
  Array.isArray(data)
    ? data.reduce((total, chunk) => total + chunk.byteLength, 0)
    : (data as Buffer | ArrayBuffer).byteLength;

/** What `#send` takes: any message to the page, which names its protocol version and its type. */
type BoardHostMessageShape = { readonly version: string; readonly type: string };

// The command a message on a live socket carries, or the refusal it gets: the socket stays open
// and the ask unchanged.
const commandOf = (value: unknown): PageCommand | LifecycleHostMessage => {
  if (value === undefined) return refusedMessage("message", NOT_JSON);
  const checked = validateBoardMessage("toHost", value);
  if (!checked.ok) {
    const reason = checked.reason === "version" ? "version" : "message";
    return refusedMessage(reason, problemsDetail(checked.problems));
  }
  const message = checked.value as LifecyclePageMessage | SettingCommand;
  if (message.type === "connect") return refusedMessage("message", CONNECTED);
  return message;
};

type Refusal = { readonly reason: "token" | "version"; readonly detail: string };

export type BoardsDeps = {
  readonly core: HostCore;
  readonly tokens: BoardTokens;
  readonly report: (error: unknown) => void;
  /** `CONNECT_TIMEOUT_MS` and `WAITING_SOCKETS_MAX` unless given. */
  readonly limits?: Partial<SocketLimits>;
  /** The session project: with it, the context header's messages go to each live board. */
  readonly projectDir?: string;
  /** The editor command, read at each use; none by default (excerpts, design decision 5). */
  readonly editorCommand?: () => EditorCommand | undefined;
  /** Starts the editor; Node's `spawn` by default (excerpts, task 5.4). */
  readonly spawnEditor?: EditorSpawn;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every board socket of the session process, and each ask's live one. */
export class Boards {
  readonly #core: HostCore;
  readonly #tokens: BoardTokens;
  readonly #report: (error: unknown) => void;
  readonly #live = new Map<string, Connection>();
  readonly #sockets = new Set<WebSocket>();
  readonly #waiting = new Set<Connection>();
  // Tabs that lost the board and may still send their last draft.
  readonly #moving = new Set<Connection>();
  readonly #limits: SocketLimits;
  // The connection whose act command ask-core is applying: its acknowledgement precedes its state.
  #acting: Connection | undefined;
  readonly #projectDir: string | undefined;
  readonly #editorCommand: () => EditorCommand | undefined;
  readonly #editor: EditorLaunch;
  // Set when the host starts closing: no socket is accepted or heard from then.
  #closing = false;

  constructor(deps: BoardsDeps) {
    this.#core = deps.core;
    this.#tokens = deps.tokens;
    this.#report = deps.report;
    this.#limits = {
      connectTimeoutMs: deps.limits?.connectTimeoutMs ?? CONNECT_TIMEOUT_MS,
      waitingMax: deps.limits?.waitingMax ?? WAITING_SOCKETS_MAX,
      preConnectMaxBytes: deps.limits?.preConnectMaxBytes ?? PRE_CONNECT_MAX_BYTES,
      takeoverFlushMs: deps.limits?.takeoverFlushMs ?? TAKEOVER_FLUSH_WAIT_MS,
      sendBufferMaxBytes: deps.limits?.sendBufferMaxBytes ?? SEND_BUFFER_MAX_BYTES,
    };
    this.#projectDir = deps.projectDir;
    this.#editorCommand = deps.editorCommand ?? (() => undefined);
    this.#editor = new EditorLaunch({
      command: this.#editorCommand,
      report: deps.report,
      ...(deps.spawnEditor === undefined ? {} : { spawn: deps.spawnEditor }),
    });
  }

  /**
   * Takes a socket opened at `/ws/<askId>` over the upgraded `stream`; it waits for its `connect`
   * within the connect timeout. Over the cap on waiting sockets, it is closed at once with "try
   * again later".
   */
  attach(socket: WebSocket, askId: string, stream: Duplex): void {
    const connection: Connection = {
      socket,
      askId,
      phase: "waiting",
      delivered: new Set(),
      working: false,
      stopTimer: () => undefined,
      stopCounting: () => undefined,
      opened: false,
      snapshots: new Set(),
    };
    this.#sockets.add(socket);
    this.#countBeforeConnect(connection, stream);
    socket.on("error", (error) => this.#report(error));
    socket.on("close", () => {
      this.#sockets.delete(socket);
      connection.stopCounting();
      this.#settle(connection);
      this.#guard(() => this.#setWorking(connection, false));
      connection.phase = "closed";
      // A tab that lost the board and closes ends its flush: the tab that took it opens.
      this.#guard(() => this.#moved(connection));
      // Closing a board discards nothing (AD-21): only the live slot is freed, and ask-core hears
      // that its live board closed, which starts its grace timer.
      if (this.#live.get(askId) === connection) {
        this.#live.delete(askId);
        if (!this.#closing) this.#guard(() => this.#core.disconnected(askId));
      }
    });
    if (this.#waiting.size >= this.#limits.waitingMax) {
      this.#close(connection, TRY_AGAIN_LATER);
      return;
    }
    this.#waiting.add(connection);
    const timer = setTimeout(
      () => this.#guard(() => this.#timedOut(connection)),
      this.#limits.connectTimeoutMs,
    );
    connection.stopTimer = () => clearTimeout(timer);
    socket.on("message", (data, binary) =>
      this.#guard(() => this.#receive(connection, data, binary)),
    );
  }

  /**
   * ask-core's events, forwarded to the ask's live board. A board that took over and has not opened
   * yet hears only the discard: its opening sends what changed meanwhile.
   */
  hear(event: CoreEvent): void {
    const connection = this.#live.get(event.askId);
    if (connection === undefined) return;
    if (!connection.opened && event.type !== "discarded") return;
    const handle = this.#heard[event.type] as (connection: Connection, event: CoreEvent) => void;
    this.#guard(() => handle(connection, event));
  }

  // What a live board hears of each of ask-core's events, by type: E1's appended events, receipts
  // and the discard; the ask lifecycle's agent changes, a new board document, a new state and the
  // close (ask-lifecycle, design decision 5); push delivery's agent status (design decision 12) and
  // who asked anew, once its owner is relabelled (design decision 4, Origin, plan B).
  readonly #heard: Heard = {
    appended: (connection) => {
      if (this.#acting !== connection) this.#sendState(connection);
    },
    received: (connection) => this.#sendReceipts(connection),
    discarded: (connection, event) => this.#discard(connection, event.reason),
    document: (connection) => {
      const view = this.#view(connection.askId);
      if (view !== undefined) this.#send(connection, boardMessage(view));
    },
    state: (connection) => this.#sendState(connection),
    closed: (connection, event) => this.#send(connection, closedMessage(event.reason)),
    agent: (connection, event) => this.#sendAgent(connection, event.status),
    origin: (connection) => this.#sendOrigin(connection),
  };

  /**
   * Closes every socket with "going away" and waits for their close handshakes, those already
   * closing included, within `CLOSE_GRACE_MS`; any socket still open then is ended.
   */
  async closeAll(): Promise<void> {
    this.#closing = true;
    for (const connection of this.#waiting) connection.stopTimer();
    this.#waiting.clear();
    for (const connection of this.#moving) connection.stopTimer();
    this.#moving.clear();
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

  // What a socket sends before its `connect` is accepted is counted as it arrives, where the
  // runtime's WebSocket reads the upgraded stream, as the `ws` package does: past the bound, the
  // socket is ended mid-frame, before the rest is read. Where the runtime reads it natively, as
  // Bun's own WebSocket does, `#receive` bounds each message before it is parsed.
  #countBeforeConnect(connection: Connection, stream: Duplex): void {
    let counting = true;
    let received = 0;
    const count = (chunk: Buffer) => {
      if (!counting) return;
      received += chunk.byteLength;
      if (received > this.#limits.preConnectMaxBytes) this.#guard(() => this.#cutOff(connection));
    };
    stream.on("data", count);
    connection.stopCounting = () => {
      counting = false;
      stream.off("data", count);
    };
  }

  // A socket that sent too much before its `connect` was accepted is ended, unanswered.
  #cutOff(connection: Connection): void {
    connection.stopCounting();
    this.#settle(connection);
    connection.phase = "closed";
    connection.socket.terminate();
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
    if (connection.phase === "waiting") {
      this.#settle(connection);
      if (sizeOf(data) > this.#limits.preConnectMaxBytes) this.#cutOff(connection);
      else this.#connect(connection, parse(data, binary));
      return;
    }
    const value = parse(data, binary);
    if (connection.phase === "moving") {
      this.#flush(connection, value);
    } else {
      this.#command(connection, value);
    }
  }

  // A socket no longer waiting for its first message: its timer stops and its place frees.
  #settle(connection: Connection): void {
    connection.stopTimer();
    this.#waiting.delete(connection);
  }

  // No first message in time: refused as a socket whose first message is not `connect`.
  #timedOut(connection: Connection): void {
    if (connection.phase !== "waiting" || this.#closing) return;
    this.#settle(connection);
    this.#send(connection, refusedMessage("token", FIRST_MESSAGE));
    this.#close(connection, BOARD_CLOSE_CODES.refused);
  }

  // The board a first message opens, or why it opens none. Only a `connect` carrying the board's
  // token reaches the schema validator, whose work grows with what it is given (AD-11, NFR-4).
  #opening(askId: string, value: unknown): OpenBoardView | Refusal {
    if (!isRecord(value) || value.type !== "connect" || typeof value.token !== "string") {
      return { reason: "token", detail: FIRST_MESSAGE };
    }
    if (!this.#tokens.opens(askId, value.token))
      return { reason: "token", detail: NOT_THIS_SESSION };
    const checked = validateBoardMessage("toHost", value);
    if (!checked.ok && checked.reason === "version") {
      return { reason: "version", detail: problemsDetail(checked.problems) };
    }
    if (!checked.ok) return { reason: "token", detail: FIRST_MESSAGE };
    const board = this.#core.lifecycleBoard(askId);
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

  // The ask's live board is now this socket. ask-core hears of a board connecting when the ask had
  // none; a takeover hands the board from one tab to another, and it hears nothing (AD-21).
  #accept(connection: Connection, board: OpenBoardView): void {
    connection.stopCounting();
    const previous = this.#live.get(connection.askId);
    this.#live.set(connection.askId, connection);
    connection.phase = "live";
    if (previous !== undefined) {
      this.#setWorking(previous, false);
      this.#takeOver(previous, connection);
      return;
    }
    this.#core.connected(connection.askId);
    this.#open(connection, board);
  }

  // The older tab is told the board moved, and may send its last draft for the takeover flush
  // wait; the newer one opens once that draft has arrived or the wait has passed.
  #takeOver(previous: Connection, next: Connection): void {
    previous.phase = "moving";
    previous.successor = next;
    this.#moving.add(previous);
    this.#send(previous, MOVED);
    const timer = setTimeout(
      () => this.#guard(() => this.#moved(previous)),
      this.#limits.takeoverFlushMs,
    );
    previous.stopTimer = () => clearTimeout(timer);
  }

  // The flush of a tab that lost the board ends: it is closed with "moved", and the tab that took
  // the board opens, unless it has lost it in turn.
  #moved(connection: Connection): void {
    if (!this.#moving.delete(connection)) return;
    connection.stopTimer();
    if (connection.phase !== "closed") this.#close(connection, BOARD_CLOSE_CODES.moved);
    const next = connection.successor;
    if (next === undefined || next.opened || this.#live.get(next.askId) !== next) return;
    const view = this.#view(next.askId);
    if (view !== undefined) this.#open(next, view);
  }

  // A tab that lost the board sends its last draft: it is checked and held, and the flush ends. An
  // act command it sends meanwhile is one the user made before the tab saw `moved`: it is applied,
  // once by its action ID, and answered on that tab as on the live board, with `done` or the
  // refusal, then the state (board-host spec, Acknowledging commands). Any other message from it
  // goes nowhere.
  #flush(connection: Connection, value: unknown): void {
    if (!isRecord(value)) return;
    if (value.type === "act") {
      const command = commandOf(value);
      if (command.type === "act") this.#act(connection, command as ActCommand);
      else this.#send(connection, command as LifecycleHostMessage);
      return;
    }
    if (value.type !== "draft") return;
    const checked = validateBoardMessage("toHost", value);
    if (checked.ok) this.#draft(connection, checked.value as unknown as DraftMessage);
    else this.#send(connection, refusedMessage("message", problemsDetail(checked.problems)));
    this.#moved(connection);
  }

  // A board opens once ask-core has read its settings, which re-reads the user file
  // (settings-languages, design decision 6); without ask-core's settings part it opens at once.
  // Meanwhile the socket is live and not opened: ask-core's events reach it only as a discard, and
  // the opening sends the board as it then is, as a takeover's does. Settings that fail are
  // reported, and the board opens without them.
  #open(connection: Connection, board: OpenBoardView): void {
    const core = this.#core;
    if (core.boardSettingsView === undefined) {
      this.#openNow(connection, board);
      return;
    }
    core.boardSettingsView().then(
      (settings) => this.#guard(() => this.#openWith(connection, settings)),
      (error: unknown) => {
        this.#report(error);
        this.#guard(() => this.#openWith(connection, undefined));
      },
    );
  }

  // The settings are read: the board opens unless it closed, lost the board or was opened, or the
  // ask was discarded meanwhile, which it was then told.
  #openWith(connection: Connection, settings: SettingsView | undefined): void {
    if (connection.phase !== "live" || connection.opened) return;
    if (this.#live.get(connection.askId) !== connection) return;
    const board = this.#view(connection.askId);
    if (board !== undefined) this.#openNow(connection, board, settings);
  }

  #openNow(connection: Connection, board: OpenBoardView, settings?: SettingsView): void {
    connection.opened = true;
    for (const opener of this.#openers) opener(connection, board, settings);
  }

  // The board's opening, in order, each part sent when it applies: the settings in effect, before
  // the board they present (settings-languages, design decision 6); its document and state, then its
  // unsent work when ask-core holds it, and the close when the ask is closed (ask-lifecycle); then
  // who asked and where, and the agent status (push delivery, design decision 12).
  readonly #openers: readonly Opener[] = [
    (connection, _board, settings) => {
      if (settings !== undefined) this.#send(connection, settingsMessage(settings));
    },
    (connection, board) => this.#send(connection, boardMessage(board)),
    (connection) => this.#sendState(connection),
    (connection) => {
      const draft = this.#core.draftToRestore(connection.askId);
      if (draft !== undefined) this.#send(connection, draftMessage(draft));
    },
    (connection, board) => {
      if (board.closed !== undefined) this.#send(connection, closedMessage(board.closed));
    },
    (connection) => this.#sendOrigin(connection),
    (connection) => {
      const status = this.#core.agentStatus?.(connection.askId);
      if (status !== undefined) this.#sendAgent(connection, status);
    },
  ];

  // A live board's message. One whose type has a standalone schema of its own is handled before the
  // board protocol's validator reads it (push delivery's presence, design decision 1); any other is
  // checked by that validator, then handled by its type, and a refusal goes back as it is.
  #command(connection: Connection, value: unknown): void {
    const type = isRecord(value) ? value.type : undefined;
    const standalone = typeof type === "string" ? this.#standalone.get(type) : undefined;
    if (standalone !== undefined) {
      standalone(connection, value);
      return;
    }
    const command = commandOf(value);
    if (command.type in this.#commands) {
      const handle = this.#commands[command.type as PageCommand["type"]] as (
        connection: Connection,
        command: PageCommand,
      ) => void;
      handle(connection, command as PageCommand);
    } else {
      this.#send(connection, command as LifecycleHostMessage);
    }
  }

  // Page messages with a standalone schema, by type: push delivery's presence.
  readonly #standalone = new Map<string, (connection: Connection, value: unknown) => void>([
    ["presence", (connection, value) => this.#presence(connection, value)],
  ]);

  // The board protocol's page commands, by type: E1's answer; the ask lifecycle's act command and
  // draft record (ask-lifecycle, design decision 8); the reading panel's source and "Open in
  // editor" (excerpts, design decision 5).
  // draft record (ask-lifecycle, design decision 8); a presentation key's write (settings-languages,
  // design decision 6).
  // editor" (excerpts, design decision 5); E7's Snapshot (snapshot design decision 8).
  readonly #commands: Commands = {
    answer: (connection, command) => this.#answer(connection, command),
    act: (connection, command) => this.#act(connection, command),
    draft: (connection, command) => this.#draft(connection, command),
    "open-source": (connection, command) => this.#openSource(connection, command),
    "open-editor": (connection, command) => this.#openEditor(connection, command),
    setting: (connection, command) => this.#setting(connection, command),
    snapshot: (connection, command) => this.#snapshot(connection, command),
  };

  // A presentation key's write, which the validator admitted for the three keys and their schema
  // values only: ask-core checks it again and writes it, then this board hears the settings as read
  // now, with the outcome. Other boards keep theirs until they reconnect (B10).
  #setting(connection: Connection, command: SettingCommand): void {
    const core = this.#core;
    if (core.writeSetting === undefined || core.boardSettingsView === undefined) {
      this.#send(connection, refusedMessage("message", NO_SETTINGS));
      return;
    }
    const setting = { key: command.key, value: command.value } as PresentationSetting;
    core
      .writeSetting(setting)
      .then((outcome) => core.boardSettingsView?.(outcome))
      .then((view) => {
        if (view !== undefined) this.#send(connection, settingsMessage(view));
      })
      .catch(this.#report);
  }

  #answer(connection: Connection, command: AnswerCommand): void {
    const { itemId, rev, choice, when } = command;
    const outcome = this.#core.answer(connection.askId, { itemId, rev, choice, when });
    // An accepted answer reaches this board as ask-core's event, which sends the state.
    if (!outcome.ok) {
      this.#send(connection, refusedMessage("answer", outcome.detail, itemId));
      this.#sendState(connection);
    }
  }

  // An act command, applied once and whole by ask-core: `done` or the refusal, then the state.
  #act(connection: Connection, command: ActCommand): void {
    const { actionId, acts } = command;
    let outcome: ActOutcome;
    this.#acting = connection;
    try {
      outcome = this.#core.act(connection.askId, { actionId, acts });
    } finally {
      this.#acting = undefined;
    }
    this.#send(connection, actReply(command, outcome));
    this.#sendState(connection);
  }

  // A draft record, checked against the ask's board document, then held; ask-core does not check
  // it (AD-20).
  #draft(connection: Connection, message: DraftMessage): void {
    const view = this.#view(connection.askId);
    if (view === undefined) return;
    const refusal = draftRefusal(message.record, view.document);
    if (refusal !== undefined) this.#send(connection, refusal);
    else this.#core.holdDraft(connection.askId, message.record);
  }

  // A source's state, read by ask-core now; it reaches the board only while this socket is still
  // the ask's live one (excerpts, design decision 5, Messages).
  #openSource(connection: Connection, { itemId }: OpenSourceCommand): void {
    const source = this.#core.sourceOf?.(connection.askId, itemId);
    const reading = source === undefined ? Promise.resolve(NO_SOURCE) : source.state();
    reading
      .then((state) => {
        if (this.#live.get(connection.askId) !== connection) return;
        const editorSet = this.#editorCommand() !== undefined;
        this.#send(connection, sourceStateMessage(itemId, state, editorSet));
      })
      .catch(this.#report);
  }

  // "Open in editor" on ask-core's target, resolved and confined again now; the outcome reaches the
  // board only while this socket is still the ask's live one (excerpts, design decision 5).
  #openEditor(connection: Connection, { itemId }: OpenEditorCommand): void {
    const { askId } = connection;
    this.#editor
      .open(askId, async () => this.#core.editorTarget?.(askId, itemId))
      .then((outcome) => {
        if (this.#live.get(askId) !== connection) return;
        this.#send(connection, editorOutcomeMessage(itemId, outcome));
      })
      .catch(this.#report);
  }

  // A Snapshot taken as the user's, whose token is its authority (AD-11); the mirrored draft record
  // is not consulted (AD-20). Its outcome is answered on this tab, unless the discard already was.
  #snapshot(connection: Connection, command: SnapshotCommand): void {
    const { requestId } = command;
    connection.snapshots.add(requestId);
    const unsentWork = command.unsentWork === true;
    this.#core.snapshot(connection.askId, { takenBy: "user", unsentWork }).then(
      (outcome) => this.#guard(() => this.#snapshotTaken(connection, requestId, outcome)),
      (error: unknown) => this.#guard(() => this.#snapshotFailed(connection, requestId, error)),
    );
  }

  #snapshotTaken(connection: Connection, requestId: string, outcome: SnapshotOutcome): void {
    const reply = snapshotReply(connection.askId, requestId, outcome);
    if (reply instanceof Error) this.#snapshotFailed(connection, requestId, reply);
    else if (connection.snapshots.delete(requestId)) this.#send(connection, reply);
  }

  // A Snapshot ask-core could not take: reported, and answered `internal-error` unless the
  // discard already answered it, so no request waits for a reply that never comes.
  #snapshotFailed(connection: Connection, requestId: string, error: unknown): void {
    this.#report(error);
    if (connection.snapshots.delete(requestId))
      this.#send(connection, snapshotFailedInside(requestId));
  }

  // What ask-core shows of the ask, unless it is gone.
  #view(askId: string): OpenBoardView | undefined {
    const view = this.#core.lifecycleBoard(askId);
    return view === undefined || view.state === "discarded" ? undefined : view;
  }

  // A live board's presence: its working flag on each change, or the refusal.
  #presence(connection: Connection, value: unknown): void {
    const presence = presenceOf(value);
    if ("type" in presence) this.#send(connection, presence);
    else this.#setWorking(connection, presence.working);
  }

  // ask-core hears a board's working flag when it changes; the board's end makes it false.
  #setWorking(connection: Connection, working: boolean): void {
    if (connection.working === working) return;
    connection.working = working;
    this.#core.setWorking?.(connection.askId, working);
  }

  // The ask's state, unless it is discarded: its board then hears the discard instead.
  #sendState(connection: Connection): void {
    const board = this.#view(connection.askId);
    if (board === undefined) return;
    for (const question of board.questions) {
      const cursor = question.answer?.cursor;
      if (question.answer?.delivered && cursor !== undefined) connection.delivered.add(cursor);
    }
    this.#send(connection, stateMessage(board));
  }

  // A receipt for each logged answer `received` has newly passed (AD-3): delivery only, never
  // reading. An answer the agent recorded is its own, and shows delivered in the state.
  #sendReceipts(connection: Connection): void {
    const board = this.#view(connection.askId);
    for (const question of board?.questions ?? []) {
      const cursor = question.answer?.cursor;
      if (!question.answer?.delivered || cursor === undefined) continue;
      if (connection.delivered.has(cursor)) continue;
      connection.delivered.add(cursor);
      this.#send(connection, receiptMessage(question.itemId));
    }
  }

  // Who asked and where, as it is now (design decision 12).
  #sendOrigin(connection: Connection): void {
    const asked = this.#core.whoAsked?.(connection.askId);
    if (this.#projectDir !== undefined && asked !== undefined) {
      this.#send(connection, originMessage(this.#projectDir, asked));
    }
  }

  #sendAgent(connection: Connection, status: AgentStatus): void {
    if (this.#projectDir !== undefined) this.#send(connection, agentMessage(status));
  }

  #discard(connection: Connection, reason: DiscardReason): void {
    this.#live.delete(connection.askId);
    for (const requestId of connection.snapshots)
      this.#send(connection, snapshotDiscarded(requestId));
    connection.snapshots.clear();
    this.#send(connection, discardedMessage(reason));
    this.#close(connection, BOARD_CLOSE_CODES.discarded);
  }

  // Any board protocol message: each change's messages carry a version and a type, so a new one
  // needs no edit here (review fix L8).
  #send(connection: Connection, message: BoardHostMessageShape): void {
    const { socket } = connection;
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > this.#limits.sendBufferMaxBytes) {
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
