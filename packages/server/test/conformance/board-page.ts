// A scripted board page for the conformance suite (task 9.2): it opens a board's WebSocket from the
// board's origin and speaks the board protocol as Track 0's recorded exchanges do: the token first,
// in `connect`, then answers. It replays the exchanges the real board page never sends, such as a
// wrong token, another major or an answer the protocol refuses, and drives the board where a test
// needs exact timing; the plain choice end to end is answered on the real board page, and the
// browser tests (9.3) drive it in the three engines. It replays E3's recorded exchanges too, and
// sends the act commands the lifecycle's cases need (ask-lifecycle, task 7.2).

import { BOARD_HOST, BOARD_PROTOCOL_VERSION, type UpdateInput } from "@askboard/contract";
import type { LifecycleTranscript, Transcript } from "@askboard/contract/fixtures";
import {
  validateAgentStatus,
  validateBoardMessage,
  validateOrigin,
} from "@askboard/contract/validate";
import WebSocket from "ws";

const WAIT_MS = 5_000;

const waitFor = async <T>(probe: () => T | undefined, what: string): Promise<T> => {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const found = probe();
    if (found !== undefined) return found;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await Bun.sleep(5);
  }
};

export type BoardSocket = {
  readonly socket: WebSocket;
  /** Messages received and not taken yet. */
  readonly pending: unknown[];
  next(): Promise<unknown>;
  closed(): Promise<number>;
  /**
   * Sends a message; resolves once `ws` has written it to the socket, or failed to, so that a
   * `terminate()` that follows cannot drop it (the replays' network drops).
   */
  send(message: unknown): Promise<void>;
  /**
   * The context header's origin and agent messages (push delivery, design decision 12), kept apart
   * from the board protocol's exchanges, as the browser harness keeps presence apart; each is
   * checked against the contract, and one it refuses joins `problems`.
   */
  readonly header: unknown[];
  /**
   * The settings each opening and each write sends (settings-languages, design decision 6), kept
   * apart in the same way and checked against the board protocol.
   */
  readonly settings: unknown[];
  readonly problems: string[];
};

// The header's messages and their contract validators.
const HEADER: Readonly<Record<string, (value: unknown) => { ok: boolean }>> = {
  origin: validateOrigin,
  agent: validateAgentStatus,
};

/** The board link's parts: the port, the ask ID and the token. */
export const linkParts = (link: string) => {
  const url = new URL(link);
  return {
    port: Number(url.port),
    askId: url.pathname.split("/").at(-1) ?? "",
    token: url.searchParams.get("t") ?? "",
  };
};

/** Opens `/ws/<askId>` as the board page does, with the board's origin. */
export const openBoardSocket = async (port: number, askId: string): Promise<BoardSocket> => {
  const origin = `http://${BOARD_HOST}:${port}`;
  const socket = new WebSocket(`ws://${BOARD_HOST}:${port}/ws/${askId}`, { origin });
  const pending: unknown[] = [];
  const header: unknown[] = [];
  const settings: unknown[] = [];
  const problems: string[] = [];
  let code: number | undefined;
  socket.on("message", (data) => {
    const message = JSON.parse(String(data)) as { type?: unknown };
    const type = message.type;
    const validate =
      typeof type === "string" && Object.hasOwn(HEADER, type) ? HEADER[type] : undefined;
    if (type === "settings") {
      settings.push(message);
      if (!validateBoardMessage("toPage", message).ok) {
        problems.push(`the contract refuses ${JSON.stringify(message)}`);
      }
      return;
    }
    if (validate === undefined) {
      pending.push(message);
      return;
    }
    header.push(message);
    if (!validate(message).ok) problems.push(`the contract refuses ${JSON.stringify(message)}`);
  });
  socket.on("close", (closeCode) => {
    code = closeCode;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return {
    socket,
    pending,
    header,
    settings,
    problems,
    next: () => waitFor(() => pending.shift(), "a board message"),
    closed: () => waitFor(() => code, "the board socket's close"),
    send: (message) =>
      new Promise<void>((resolve) => socket.send(JSON.stringify(message), () => resolve())),
  };
};

type Message = Readonly<Record<string, unknown>>;

/** Takes the socket's messages until one matches and returns it; those before it are dropped. */
export const until = async (
  socket: BoardSocket,
  what: string,
  matches: (message: Message) => boolean,
): Promise<Message> => {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const message = socket.pending.shift() as Message | undefined;
    if (message !== undefined && matches(message)) return message;
    if (message !== undefined) continue;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await Bun.sleep(5);
  }
};

let commands = 0;

/** A new action ID, 22 base64url characters, as the board page draws one for each command. */
export const nextActionId = (): string => {
  commands += 1;
  return `conformance${String(commands).padStart(11, "0")}`;
};

/**
 * Sends one act command as the board page does, and returns the state that follows its `done`;
 * fails on a refusal. Messages that arrive before them are dropped.
 */
export const act = async (socket: BoardSocket, acts: readonly unknown[]): Promise<Message> => {
  const actionId = nextActionId();
  socket.send({ version: BOARD_PROTOCOL_VERSION, type: "act", actionId, acts });
  const outcome = await until(
    socket,
    `the outcome of the command ${actionId}`,
    (message) =>
      (message.type === "done" && message.actionId === actionId) ||
      (message.type === "refused" && (message.actionId ?? actionId) === actionId),
  );
  if (outcome.type === "refused") throw new Error(`refused: ${JSON.stringify(outcome)}`);
  return until(socket, "the state after the command", (message) => message.type === "state");
};

/** What happens off the wire while a transcript is replayed, done on the real session process. */
export type Offstage = {
  /** The agent's `collect` returns the answer. */
  collected(): Promise<void>;
  /** The session process exits. */
  exit(): Promise<void>;
  /** The agent's `update`, which only E3's transcripts record (ask-lifecycle, task 7.2). */
  update?(request: UpdateInput): Promise<void>;
};

const sameMessage = (received: unknown, expected: object): string | undefined => {
  if (!validateBoardMessage("toPage", received).ok) {
    return `${JSON.stringify(received)} is not a valid board-host message`;
  }
  // A refusal's detail is text for people: it must be there, in any words.
  const strip = (message: unknown) => {
    const { detail, ...rest } = message as { detail?: unknown };
    return (message as { type?: string }).type === "refused" ? rest : message;
  };
  // The same JSON values, whatever the order of their members (RFC 8259: objects are unordered).
  if (Bun.deepEquals(strip(received), strip(expected), true)) return undefined;
  return `expected ${JSON.stringify(strip(expected))}, received ${JSON.stringify(strip(received))}`;
};

/**
 * Replays the board page's half of a transcript against a real board at `port`, sending the board's
 * own token where the transcript has its recorded one, and checks that every board-host message is
 * the transcript's. Returns the problems, none when board-host answered exactly.
 */
export const replay = async (
  transcript: Transcript | LifecycleTranscript,
  board: { port: number; askId: string; token: string },
  offstage: Offstage,
): Promise<string[]> => {
  const sockets = new Map<number, BoardSocket>();
  const problems: string[] = [];
  const socketOf = async (number: number) => {
    const known = sockets.get(number);
    if (known !== undefined) return known;
    const opened = await openBoardSocket(board.port, board.askId);
    sockets.set(number, opened);
    return opened;
  };
  const withToken = (message: Readonly<Record<string, unknown>>) =>
    message.token === transcript.token ? { ...message, token: board.token } : message;
  try {
    for (const step of transcript.steps) {
      if (step.from === "page") {
        const socket = await socketOf(step.socket);
        await socket.send(withToken("message" in step ? step.message : step.invalid));
      } else if (step.from === "host" && "message" in step) {
        const problem = sameMessage(await (await socketOf(step.socket)).next(), step.message);
        if (problem !== undefined) problems.push(`socket ${step.socket}: ${problem}`);
      } else if (step.from === "host") {
        const code = await (await socketOf(step.socket)).closed();
        if (code !== step.close)
          problems.push(`socket ${step.socket}: closed ${code}, not ${step.close}`);
      } else if (step.from === "network") {
        (await socketOf(step.socket)).socket.terminate();
      } else if (step.from === "session" && step.event === "collected") {
        await offstage.collected();
      } else if (step.from === "session" && step.event === "update") {
        if (offstage.update === undefined) throw new Error("the replay makes no update happen");
        await offstage.update(step.request);
      } else if (step.from === "session") {
        await offstage.exit();
      }
    }
    // Nothing the transcript does not record arrives afterwards.
    await Bun.sleep(100);
    for (const [number, socket] of sockets) {
      if (socket.pending.length > 0) {
        problems.push(`socket ${number}: unexpected ${JSON.stringify(socket.pending)}`);
      }
      problems.push(...socket.problems.map((problem) => `socket ${number}: ${problem}`));
    }
  } finally {
    for (const socket of sockets.values()) socket.socket.terminate();
  }
  return problems;
};
