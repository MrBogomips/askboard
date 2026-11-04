// Test helpers for board-host: Track 0's fixture view build written to a temporary folder, a board
// host around the real ask-core with fixed tokens, raw HTTP requests that set any `Host` and
// `Origin`, and board sockets whose messages and close are queued for the test to await.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BOARD_HOST } from "@askboard/contract";
import { fixtureViewFiles, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { AskCore, type Clock, type CorePorts, type SnapshotPorts } from "@askboard/core";
import WebSocket from "ws";
import type { SocketLimits } from "../../src/board-host/boards.ts";
import { type BoardHost, createBoardHost } from "../../src/board-host/index.ts";

const folders: string[] = [];

/** Writes a view build's files to a new temporary folder and returns the folder. */

// ask-core's Clock port over the runtime's timers, as the session entry point gives it, except that
// a timer left running, such as the grace timer of a board a test closed, does not hold the test
// process.
export const runtimeClock: Clock = {
  now: () => Date.now(),
  after: (ms, run) => {
    const timer = setTimeout(run, ms);
    timer.unref();
    return () => clearTimeout(timer);
  },
};

/** A Clock the test moves by hand: `advance` runs the timers that fall due, in order. */
export const manualClock = () => {
  let now = Date.parse("2026-10-31T14:00:00Z");
  const pending = new Map<number, { at: number; run: () => void }>();
  const delays: number[] = [];
  let next = 0;
  const clock: Clock = {
    now: () => now,
    after: (ms, run) => {
      const id = next++;
      delays.push(ms);
      pending.set(id, { at: now + ms, run });
      return () => pending.delete(id);
    },
  };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...pending.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, a], [, b]) => a.at - b.at)[0];
      if (due === undefined) break;
      const [id, timer] = due;
      now = timer.at;
      pending.delete(id);
      timer.run();
    }
    now = target;
  };
  return { clock, advance, delays, pending: () => pending.size };
};

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
  /**
   * Creates an ask, with the plain-choice question unless `request` gives another ask, and the
   * call identity `call` when given (push delivery), and returns its link's port, ID and token.
   */
  ask(
    askId?: string,
    request?: unknown,
    call?: Parameters<AskCore["ask"]>[1],
  ): Promise<{ port: number; askId: string; token: string; link: string }>;
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
    limits?: Partial<SocketLimits>;
    /** ask-core's clock; the runtime's by default. */
    clock?: Clock;
    /** The session project, which turns on the context header's messages (push delivery). */
    projectDir?: string;
    /** Push delivery's record table and the context header's ports. */
    push?: Pick<CorePorts, "records" | "header">;
    /** E7's Snapshot writer, with the origin row's project folder. */
    snapshots?: SnapshotPorts;
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
    ...(options.limits ? { limits: options.limits } : {}),
    ...(options.tokens ? { token: () => tokens.shift() ?? `random-${crypto.randomUUID()}` } : {}),
    ...(options.projectDir === undefined ? {} : { projectDir: options.projectDir }),
  });
  const created = new AskCore({
    address: host.address,
    showing: { check: async () => ({ showable: true }), open: (link) => opened.push(link) },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    report: (error) => reported.push(error),
    clock: options.clock ?? runtimeClock,
    ...options.push,
    ...(options.snapshots === undefined ? {} : { snapshots: options.snapshots }),
  });
  core = created;
  return {
    host,
    core: created,
    reported,
    opened,
    ask: async (askId, request, call) => {
      const outcome = await created.ask(request ?? plainChoiceAsk(askId), call);
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

/**
 * A board socket as the board page opens it, with its messages and close queued. The context
 * header's origin and agent messages (push delivery, design decision 12) are queued apart, as the
 * browser harness keeps presence apart, so that E1's exchanges read as they were recorded.
 */
export type BoardSocket = {
  readonly socket: WebSocket;
  /** The next message `board-host` sent, parsed, other than the header's; fails after a wait. */
  next(): Promise<unknown>;
  /** The close code, once `board-host` closed the socket. */
  closed(): Promise<number>;
  /**
   * Sends a message; resolves once `ws` has written it to the socket, or failed to, so that a
   * `terminate()` that follows cannot drop it (the replays' network drops).
   */
  send(message: unknown): Promise<void>;
  /** Messages received and not taken by `next`. */
  readonly pending: unknown[];
  /** The next origin or agent message; fails after a wait. */
  nextHeader(): Promise<unknown>;
  /** Origin and agent messages received and not taken by `nextHeader`. */
  readonly header: unknown[];
  /** The type of every message received, in order, the header's included. */
  readonly types: string[];
};

const HEADER_TYPES: readonly unknown[] = ["origin", "agent"];

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
  const header: unknown[] = [];
  const types: string[] = [];
  let code: number | undefined;
  socket.on("message", (data) => {
    const message = JSON.parse(String(data)) as { type?: unknown };
    types.push(String(message.type));
    (HEADER_TYPES.includes(message.type) ? header : pending).push(message);
  });
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
    header,
    types,
    next: () => waitFor(() => pending.shift(), "a message"),
    nextHeader: () => waitFor(() => header.shift(), "an origin or agent message"),
    closed: () => waitFor(() => code, "the close"),
    send: (message) =>
      new Promise<void>((resolve) => socket.send(JSON.stringify(message), () => resolve())),
  };
};

/** A client's text frame of `payload`: masked, as RFC 6455 requires of a client, of any length. */
export const clientFrame = (payload: string): Buffer => {
  const data = Buffer.from(payload);
  const mask = Buffer.from([1, 2, 3, 4]);
  let header: Buffer;
  if (data.length < 126) {
    header = Buffer.from([0x81, 0x80 | data.length]);
  } else if (data.length < 65_536) {
    header = Buffer.from([0x81, 0x80 | 126, 0, 0]);
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.from([0x81, 0x80 | 127, 0, 0, 0, 0, 0, 0, 0, 0]);
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  const masked = data.map((byte, at) => byte ^ (mask[at % 4] ?? 0));
  return Buffer.concat([header, mask, masked]);
};

/** A peer on raw TCP that has opened `/ws/<askId>`, and whether the host has ended it. */
export type RawPeer = {
  readonly socket: Socket;
  /** Whether the host ended the TCP connection within `ms`. */
  endedWithin(ms: number): Promise<boolean>;
};

/**
 * Opens `/ws/<askId>` over raw TCP, writing `trailing` in the same write as the opening handshake,
 * as a peer that does not wait for the answer may, and never answering a close frame.
 */
export const rawUpgrade = (
  port: number,
  askId: string,
  trailing: Buffer = Buffer.alloc(0),
): Promise<RawPeer> =>
  new Promise((resolve, reject) => {
    let ended = false;
    const socket = connect({ host: BOARD_HOST, port }, () => {
      const handshake = [
        `GET /ws/${askId} HTTP/1.1`,
        `Host: ${BOARD_HOST}:${port}`,
        `Origin: http://${BOARD_HOST}:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n");
      socket.write(Buffer.concat([Buffer.from(handshake), trailing]));
    });
    socket.on("close", () => {
      ended = true;
    });
    socket.on("error", () => undefined);
    socket.once("data", (data) => {
      if (!String(data).startsWith("HTTP/1.1 101")) {
        reject(new Error(String(data).split("\r\n")[0]));
        return;
      }
      resolve({
        socket,
        endedWithin: async (ms) => {
          const until = Date.now() + ms;
          while (!ended && Date.now() < until) await Bun.sleep(5);
          return ended;
        },
      });
    });
  });

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
