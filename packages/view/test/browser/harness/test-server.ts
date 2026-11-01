// The test server: the session process's stand-in until Integration (design decisions 11 and 13).
// It listens on 127.0.0.1, serves a view build under the contract's routes as `answerHttp` says,
// and replays the host's half of a transcript over `/ws/<askId>`. Test code, so it uses Bun's
// server; `board-host` itself runs on `node:http` and `ws` (design decision 5).
//
// The session-side steps change what it serves: after `exit` the ask is discarded and no socket
// connects; after `restart` it knows neither the ask nor the token; after `drop` the network is
// down, every request and upgrade failing, until `restore`.

import { BOARD_HOST, boardLink, parseBoardRoute } from "@askboard/contract";
import type { Server, WebSocketHandler } from "bun";
import { answerHttp, type BoardAccess, toResponse } from "./http.ts";
import { Replay } from "./replay.ts";
import type { BoardSession, Scenario } from "./session.ts";
import type { ReplayTranscript } from "./transcripts.ts";
import type { ViewBuild } from "./view-build.ts";

type SocketData = { number: number };

const NO_AGENT =
  "the test server replays transcripts and has no agent: an ask of the lifecycle runs on the session process";

/** What the session-side steps change, and the requests that reached the server. */
type ServerState = { access: BoardAccess; networkUp: boolean; readonly requests: string[] };

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

// The replay of the transcript's host half, whose session-side steps change the state.
const replayOf = ({ steps }: ReplayTranscript, state: ServerState): Replay =>
  new Replay(steps, {
    onExit: () => {
      state.access = { ...state.access, state: "discarded" };
    },
    onRestart: () => {
      state.access = { ...state.access, state: "unknown" };
    },
    onDrop: () => {
      state.networkUp = false;
    },
  });

// The upgrade passes the checks `board-host` makes before the token: its route and its Origin
// (AD-11). The token itself is the replay's business, in the first message.
const upgrade = (
  request: Request,
  server: Server<SocketData>,
  access: BoardAccess,
): Response | undefined => {
  const url = new URL(request.url);
  if (parseBoardRoute(url.pathname)?.kind !== "socket") return text(404, "Not found.");
  if (request.headers.get("origin") !== `http://${request.headers.get("host")}`) {
    return text(403, "The upgrade's Origin is not the board's.");
  }
  if (access.state === "discarded") return text(503, "The session process has exited.");
  if (server.upgrade(request, { data: { number: 0 } })) return undefined;
  return text(400, "Not a WebSocket upgrade.");
};

// Each socket the replay attaches gets its number, by which it sends and reads that socket.
const socketsOf = (replay: Replay): WebSocketHandler<SocketData> => ({
  open(socket) {
    socket.data.number = replay.attach({
      send: (message) => socket.send(message),
      close: (code) => socket.close(code),
      terminate: () => socket.terminate(),
    });
  },
  message(socket, message) {
    replay.receive(socket.data.number, String(message));
  },
  close(socket) {
    replay.detach(socket.data.number);
  },
});

const serve = (view: ViewBuild, state: ServerState, replay: Replay): Server<SocketData> =>
  Bun.serve<SocketData>({
    hostname: BOARD_HOST,
    port: 0,
    fetch(request, server) {
      const { method, headers, url } = request;
      state.requests.push(`${method} ${new URL(url).pathname}`);
      if (!state.networkUp) return text(503, "The network is down.");
      if (isUpgrade(request)) return upgrade(request, server, state.access);
      return toResponse(answerHttp({ method, url, headers }, view, state.access), method);
    },
    websocket: socketsOf(replay),
  });

export const startTestServer = async ({ transcript, view }: Scenario): Promise<BoardSession> => {
  const { askId, token } = transcript;
  const state: ServerState = {
    access: { askId, token, state: "open" },
    networkUp: true,
    requests: [],
  };
  const replay = replayOf(transcript, state);
  const server = serve(view, state, replay);
  let closed = false;
  return {
    link: boardLink({ port: server.port ?? 0, askId, token }),
    collected: () => replay.trigger("collected"),
    collect: () => Promise.reject(new Error(NO_AGENT)),
    update: () => Promise.reject(new Error(NO_AGENT)),
    exit: () => replay.trigger("exit"),
    drop: () => replay.trigger("drop"),
    restore: async () => {
      state.networkUp = true;
    },
    restart: () => replay.trigger("restart"),
    requests: () => [...state.requests],
    problems: () => replay.problems(),
    close: async () => {
      if (closed) return;
      closed = true;
      await server.stop(true);
    },
  };
};
