// The test server: the session process's stand-in until Integration (design decisions 11 and 13).
// It listens on 127.0.0.1, serves a view build under the contract's routes as `answerHttp` says,
// and replays the host's half of a transcript over `/ws/<askId>`. Test code, so it uses Bun's
// server; `board-host` itself runs on `node:http` and `ws` (design decision 5).
//
// The session-side steps change what it serves: after `exit` the ask is discarded and no socket
// connects; after `restart` it knows neither the ask nor the token; after `drop` the network is
// down, every request and upgrade failing, until `restore`.

import { BOARD_HOST, boardLink, parseBoardRoute } from "@askboard/contract";
import type { Server, ServerWebSocket } from "bun";
import { answerHttp, type BoardAccess, toResponse } from "./http.ts";
import { Replay } from "./replay.ts";
import type { BoardSession, Scenario } from "./session.ts";

type SocketData = { number: number };

const text = (status: number, body: string) =>
  new Response(`${body}\n`, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });

const isUpgrade = (request: Request) =>
  request.headers.get("upgrade")?.toLowerCase() === "websocket";

export const startTestServer = async ({ transcript, view }: Scenario): Promise<BoardSession> => {
  let access: BoardAccess = { askId: transcript.askId, token: transcript.token, state: "open" };
  let networkUp = true;
  let closed = false;
  const requests: string[] = [];
  const replay = new Replay(transcript.steps, {
    onExit: () => {
      access = { ...access, state: "discarded" };
    },
    onRestart: () => {
      access = { ...access, state: "unknown" };
    },
    onDrop: () => {
      networkUp = false;
    },
  });

  // The upgrade passes the checks `board-host` makes before the token: its route and its Origin
  // (AD-11). The token itself is the replay's business, in the first message.
  const upgrade = (request: Request, server: Server<SocketData>): Response | undefined => {
    const url = new URL(request.url);
    if (parseBoardRoute(url.pathname)?.kind !== "socket") return text(404, "Not found.");
    if (request.headers.get("origin") !== `http://${request.headers.get("host")}`) {
      return text(403, "The upgrade's Origin is not the board's.");
    }
    if (access.state === "discarded") return text(503, "The session process has exited.");
    if (server.upgrade(request, { data: { number: 0 } })) return undefined;
    return text(400, "Not a WebSocket upgrade.");
  };

  const server: Server<SocketData> = Bun.serve<SocketData>({
    hostname: BOARD_HOST,
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}`);
      if (!networkUp) return text(503, "The network is down.");
      if (isUpgrade(request)) return upgrade(request, server);
      const { method, headers } = request;
      return toResponse(answerHttp({ method, url: request.url, headers }, view, access), method);
    },
    websocket: {
      open(socket: ServerWebSocket<SocketData>) {
        socket.data.number = replay.attach({
          send: (message) => socket.send(message),
          close: (code) => socket.close(code),
          terminate: () => socket.terminate(),
        });
      },
      message(socket: ServerWebSocket<SocketData>, message: string | Buffer) {
        replay.receive(socket.data.number, String(message));
      },
      close(socket: ServerWebSocket<SocketData>) {
        replay.detach(socket.data.number);
      },
    },
  });

  return {
    link: boardLink({ port: server.port ?? 0, askId: transcript.askId, token: transcript.token }),
    collected: () => replay.trigger("collected"),
    exit: () => replay.trigger("exit"),
    drop: () => replay.trigger("drop"),
    restore: async () => {
      networkUp = true;
    },
    restart: () => replay.trigger("restart"),
    requests: () => [...requests],
    problems: () => replay.problems(),
    close: async () => {
      if (closed) return;
      closed = true;
      await server.stop(true);
    },
  };
};
