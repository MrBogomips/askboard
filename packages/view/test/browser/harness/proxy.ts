// A TCP proxy in front of the session process's board listener: the session-process target's
// means to drop and restore the board's connection and to list the requests that reached the
// session side, as the test server does itself (`BoardSession`).
//
// It forwards bytes unchanged. The browser makes `Host` and `Origin` from the page's origin, the
// proxy's, so both name the proxy's port and still agree; board-host accepts a loopback `Host` on
// any port and an `Origin` equal to `http://` plus that `Host` (board-host spec, "Host and Origin
// checks"), so its checks run on what the browser sent. Below the browser, it works the same in
// all three engines: a dropped connection ends with no close frame, as a network drop does.

import { createConnection, createServer, type Socket } from "node:net";
import { BOARD_HOST } from "@askboard/contract";

const HEAD_END = "\r\n\r\n";

type ErrorEvents = { on(event: "error", listener: (error: Error) => void): unknown };

/**
 * Reads the request lines of one client connection, as `METHOD /path` without the query, until
 * a WebSocket upgrade, after which the connection carries frames. A board page sends GET and HEAD
 * requests and upgrades; a body is skipped by its `Content-Length`, and a chunked one, which no
 * board page sends, ends the reading.
 */
export class RequestHeads {
  readonly #onRequest: (line: string) => void;
  #buffer = "";
  #skip = 0;
  #done = false;

  constructor(onRequest: (line: string) => void) {
    this.#onRequest = onRequest;
  }

  push(chunk: Uint8Array): void {
    if (this.#done) return;
    this.#buffer += Buffer.from(chunk).toString("latin1");
    for (;;) {
      const skipped = Math.min(this.#skip, this.#buffer.length);
      this.#buffer = this.#buffer.slice(skipped);
      this.#skip -= skipped;
      if (this.#skip > 0) return;
      const end = this.#buffer.indexOf(HEAD_END);
      if (end < 0) return;
      const [requestLine = "", ...fields] = this.#buffer.slice(0, end).split("\r\n");
      this.#buffer = this.#buffer.slice(end + HEAD_END.length);
      const [method = "", target = ""] = requestLine.split(" ");
      this.#onRequest(`${method} ${target.split("?")[0]}`);
      const header = (name: string) =>
        fields
          .find((field) => field.toLowerCase().startsWith(`${name}:`))
          ?.slice(name.length + 1)
          .trim()
          .toLowerCase();
      if (header("upgrade") === "websocket" || header("transfer-encoding") !== undefined) {
        this.#done = true;
        return;
      }
      this.#skip = Number(header("content-length") ?? 0) || 0;
    }
  }
}

export type BoardProxy = {
  /** The port the browser connects to, on `127.0.0.1`. */
  readonly port: number;
  /** Every request that reached the session side through the proxy, as `METHOD /path`. */
  requests(): readonly string[];
  /** Ends every connection with no close frame and refuses new ones until `restore`. */
  drop(): void;
  restore(): void;
  /** Sends new connections to another port, such as a restarted session process's. */
  retarget(port: number): void;
  /** Stops listening and ends every connection; safe to call more than once. */
  close(): Promise<void>;
};

/** A proxy on `127.0.0.1` to the board listener at `upstreamPort`; `listenPort` 0 picks a free one. */
export const startProxy = async (upstreamPort: number, listenPort = 0): Promise<BoardProxy> => {
  let upstream = upstreamPort;
  let up = true;
  const requests: string[] = [];
  const open = new Set<Socket>();
  const track = (socket: Socket) => {
    open.add(socket);
    socket.on("close", () => open.delete(socket));
  };

  const server = createServer((client) => {
    track(client);
    if (!up) {
      client.destroy();
      return;
    }
    const target = createConnection({ host: BOARD_HOST, port: upstream });
    track(target);
    const heads = new RequestHeads((line) => requests.push(line));
    client.on("data", (chunk: Buffer) => heads.push(chunk));
    client.pipe(target);
    target.pipe(client);
    // A failure on either side ends both, with no close frame: the other side sees a drop.
    const fail = () => {
      client.destroy();
      target.destroy();
    };
    client.on("error", fail);
    target.on("error", fail);
    target.on("close", () => client.end());
  });

  // An error after listening has nothing to reject: the promise has settled. The test program
  // loads two versions of Node's types (tasks.md, 1.3), under which `Server` loses its event
  // methods' types; the method is Node's all the same.
  await new Promise<void>((resolve, reject) => {
    (server as unknown as ErrorEvents).on("error", reject);
    server.listen({ port: listenPort, host: BOARD_HOST }, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  let closing: Promise<void> | undefined;

  const endAll = () => {
    for (const socket of open) socket.destroy();
  };

  return {
    port,
    requests: () => [...requests],
    drop: () => {
      up = false;
      endAll();
    },
    restore: () => {
      up = true;
    },
    retarget: (next) => {
      upstream = next;
    },
    close: () => {
      closing ??= new Promise<void>((resolve) => {
        server.close(() => resolve());
        endAll();
      });
      return closing;
    },
  };
};
