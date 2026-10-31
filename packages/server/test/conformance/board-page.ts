// A scripted board page for the conformance suite (task 9.2): it opens a board's WebSocket from the
// board's origin and speaks the board protocol as the real board page does in Track 0's recorded
// exchanges: the token first, in `connect`, then answers. Until the real board page is merged it
// stands in for it; the browser tests (9.3) drive the real one.

import { BOARD_HOST } from "@askboard/contract";
import type { Transcript } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
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
  send(message: unknown): void;
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
  let code: number | undefined;
  socket.on("message", (data) => pending.push(JSON.parse(String(data))));
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
    next: () => waitFor(() => pending.shift(), "a board message"),
    closed: () => waitFor(() => code, "the board socket's close"),
    send: (message) => socket.send(JSON.stringify(message)),
  };
};

/** What happens off the wire while a transcript is replayed, done on the real session process. */
export type Offstage = {
  /** The agent's `collect` returns the answer. */
  collected(): Promise<void>;
  /** The session process exits. */
  exit(): Promise<void>;
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
  const left = JSON.stringify(strip(received));
  const right = JSON.stringify(strip(expected));
  return left === right ? undefined : `expected ${right}, received ${left}`;
};

/**
 * Replays the board page's half of a transcript against a real board at `port`, sending the board's
 * own token where the transcript has its recorded one, and checks that every board-host message is
 * the transcript's. Returns the problems, none when board-host answered exactly.
 */
export const replay = async (
  transcript: Transcript,
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
        socket.send(withToken("message" in step ? step.message : step.invalid));
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
    }
  } finally {
    for (const socket of sockets.values()) socket.socket.terminate();
  }
  return problems;
};
