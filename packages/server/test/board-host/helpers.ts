// Test helpers for board-host: Track 0's fixture view build written to a temporary folder, a board
// host around the real ask-core with fixed tokens, raw HTTP requests that set any `Host` and
// `Origin`, and board sockets whose messages and close are queued for the test to await.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BOARD_HOST } from "@askboard/contract";
import { fixtureViewFiles, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { AskCore } from "@askboard/core";
import WebSocket from "ws";
import { type BoardHost, createBoardHost } from "../../src/board-host/index.ts";

const folders: string[] = [];

/** Writes a view build's files to a new temporary folder and returns the folder. */
export const writeView = (files: Readonly<Record<string, string>> = fixtureViewFiles): string => {
  const folder = mkdtempSync(join(tmpdir(), "askboard-view-"));
  folders.push(folder);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
  return folder;
};

/** Removes the folders `writeView` made. */
export const removeViews = (): void => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
};

/** The plain-choice ask of the approved examples, under another ID when given. */
export const plainChoiceAsk = (askId: string = plainChoiceBoardDocument.askId) => {
  const [question] = plainChoiceBoardDocument.items;
  return { askId, items: [{ type: question.type, id: question.id, props: question.props }] };
};

export const QUESTION_TEXT = plainChoiceBoardDocument.items[0].props.text;

// Ports are held with Bun's listener: the test program loads two versions of Node's types, whose
// merged `net.Server` loses its event methods.
type Held = { stop(closeActive?: boolean): void; readonly port: number };

const hold = (port: number, hostname: string): Held =>
  Bun.listen({ hostname, port, socket: { data: () => undefined } });

/** A port on the loopback interface that was free a moment ago. */
export const freePort = async (): Promise<number> => {
  const probe = hold(0, BOARD_HOST);
  probe.stop(true);
  return probe.port;
};

/** Holds a port on an interface, as another process would; throws when it is taken. */
export const holdPort = async (port: number, host: string = BOARD_HOST): Promise<Held> =>
  hold(port, host);

export const release = async (held: Held): Promise<void> => held.stop(true);

/** Ports `first` to `first + count - 1`, all free a moment ago. */
export const freeRange = async (count: number): Promise<{ first: number; last: number }> => {
  for (let tries = 0; tries < 20; tries += 1) {
    const first = await freePort();
    const held: Held[] = [];
    try {
      for (let port = first; port < first + count; port += 1) held.push(await holdPort(port));
      return { first, last: first + count - 1 };
    } catch {
      // A port of the range is taken: try another start.
    } finally {
      await Promise.all(held.map(release));
    }
  }
  throw new Error(`no ${count} free ports in a row`);
};

export type TestHost = {
  readonly host: BoardHost;
  readonly core: AskCore;
  readonly reported: unknown[];
  readonly opened: string[];
  /** Creates an ask with the plain-choice question and returns its link's port, ID and token. */
  ask(askId?: string): Promise<{ port: number; askId: string; token: string; link: string }>;
};

/**
 * A board host around the real ask-core, serving `view` (Track 0's fixture build by default), on
 * `ports`, and issuing `tokens` in order before falling back to random ones.
 */
export const startHost = (
  options: {
    view?: string;
    ports?: { first: number; last: number };
    tokens?: readonly string[];
  } = {},
): TestHost => {
  const reported: unknown[] = [];
  const opened: string[] = [];
  const tokens = [...(options.tokens ?? [])];
  let core: AskCore | undefined;
  const host = createBoardHost({
    core: () => {
      if (core === undefined) throw new Error("no core yet");
      return core;
    },
    view: options.view ?? writeView(),
    report: (error) => reported.push(error),
    ...(options.ports ? { ports: options.ports } : {}),
    ...(options.tokens ? { token: () => tokens.shift() ?? `random-${crypto.randomUUID()}` } : {}),
  });
  const created = new AskCore({
    address: host.address,
    showing: { check: async () => ({ showable: true }), open: (link) => opened.push(link) },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    report: (error) => reported.push(error),
  });
  core = created;
  return {
    host,
    core: created,
    reported,
    opened,
    ask: async (askId) => {
      const outcome = await created.ask(plainChoiceAsk(askId));
      if (outcome.kind !== "created") throw new Error(`ask not created: ${outcome.kind}`);
      const link = new URL(outcome.ask.board);
      return {
        port: Number(link.port),
        askId: outcome.ask.askId,
        token: link.searchParams.get("t") ?? "",
        link: outcome.ask.board,
      };
    },
  };
};

export type Answer = {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
};

/**
 * One HTTP request through `node:http`, which lets a test set `Host` and `Origin` as any page or
 * tool could; `host: null` sends no `Host` header at all.
 */
export const request = (
  port: number,
  path: string,
  options: {
    method?: string;
    host?: string | null;
    headers?: Readonly<Record<string, string>>;
  } = {},
): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const host = options.host === undefined ? `${BOARD_HOST}:${port}` : options.host;
    const sent = httpRequest(
      {
        host: BOARD_HOST,
        port,
        path,
        method: options.method ?? "GET",
        setHost: false,
        headers: { ...(host === null ? {} : { Host: host }), ...options.headers },
      },
      (answer) => {
        const chunks: Buffer[] = [];
        answer.on("data", (chunk: Buffer) => chunks.push(chunk));
        answer.on("end", () =>
          resolve({
            status: answer.statusCode ?? 0,
            headers: answer.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    sent.on("error", reject);
    sent.end();
  });

/** A board socket as the board page opens it, with its messages and close queued. */
export type BoardSocket = {
  readonly socket: WebSocket;
  /** The next message `board-host` sent, parsed; fails after a wait. */
  next(): Promise<unknown>;
  /** The close code, once `board-host` closed the socket. */
  closed(): Promise<number>;
  send(message: unknown): void;
  /** Messages received and not taken by `next`. */
  readonly pending: unknown[];
};

const WAIT_MS = 2_000;

const waitFor = async <T>(probe: () => T | undefined, what: string): Promise<T> => {
  const until = Date.now() + WAIT_MS;
  for (;;) {
    const found = probe();
    if (found !== undefined) return found;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await Bun.sleep(5);
  }
};

/** Opens `/ws/<askId>` with the board page's `Origin`, unless `origin` says otherwise. */
export const openSocket = async (
  port: number,
  askId: string,
  options: { origin?: string | null; host?: string } = {},
): Promise<BoardSocket> => {
  const host = options.host ?? `${BOARD_HOST}:${port}`;
  const origin = options.origin === undefined ? `http://${host}` : options.origin;
  const socket = new WebSocket(`ws://${BOARD_HOST}:${port}/ws/${askId}`, {
    headers: { Host: host },
    ...(origin === null ? {} : { origin }),
  });
  const pending: unknown[] = [];
  let code: number | undefined;
  socket.on("message", (data) => pending.push(JSON.parse(String(data))));
  socket.on("close", (closeCode) => {
    code = closeCode;
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, answer) =>
      reject(new Error(`upgrade refused: ${answer.statusCode}`)),
    );
  });
  return {
    socket,
    pending,
    next: () => waitFor(() => pending.shift(), "a message"),
    closed: () => waitFor(() => code, "the close"),
    send: (message) => socket.send(JSON.stringify(message)),
  };
};

/** The status an upgrade to `/ws/<askId>` is refused with, or "open" when it is accepted. */
export const upgradeStatus = (
  port: number,
  path: string,
  headers: Readonly<Record<string, string>>,
): Promise<number | "open"> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${BOARD_HOST}:${port}${path}`, { headers });
    socket.once("open", () => {
      socket.terminate();
      resolve("open");
    });
    socket.once("unexpected-response", (_request, answer) => {
      resolve(answer.statusCode ?? 0);
      answer.resume();
    });
    socket.once("error", (error) => {
      if (/Unexpected server response: (\d+)/.test(error.message)) {
        resolve(Number(/Unexpected server response: (\d+)/.exec(error.message)?.[1]));
      } else reject(error);
    });
  });
