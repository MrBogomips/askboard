// The board listener's HTTP side (design decision 5): the gate of every request, then the board page
// at its link, the manifest at `/m` and the chunks at `/c/<sha256>` behind the token header, each
// answer with the status and type of the contract's `BOARD_RESPONSES`, and the WebSocket upgrade at
// `/ws/<askId>`, whose token comes in the first message.

import { type IncomingMessage, type ServerResponse, STATUS_CODES } from "node:http";
import type { Duplex } from "node:stream";
import {
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
  BOARD_TOKEN_QUERY,
  type BoardRoute,
  parseBoardRoute,
} from "@askboard/contract";
import { gateRefusal } from "./gate.ts";
import type { HostCore } from "./index.ts";
import { INVALID_LINK_PAGES, PLAIN_POLICY } from "./pages.ts";
import type { BoardTokens } from "./tokens.ts";
import type { LoadedView } from "./view.ts";

export type HttpDeps = {
  readonly core: HostCore;
  readonly tokens: BoardTokens;
  readonly view: LoadedView;
  readonly report: (error: unknown) => void;
  /** Whether the host is closing: no socket is accepted then. */
  readonly closed: () => boolean;
};

type Answer = { readonly status: number; readonly contentType: string };

/** Sent on every response (AD-11): no referrer, no sniffing, no caching of a tokenized page. */
const COMMON_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
} as const;

/** What one request is answered with. */
type Reply = {
  readonly answer: Answer;
  readonly body: string | Buffer;
  readonly policy?: string;
};

const text = (answer: Answer): Reply => ({
  answer,
  body: `${STATUS_CODES[answer.status] ?? "Refused"}\n`,
});

const send = (request: IncomingMessage, response: ServerResponse, reply: Reply): void => {
  const bytes = typeof reply.body === "string" ? Buffer.from(reply.body, "utf8") : reply.body;
  response.writeHead(reply.answer.status, {
    ...COMMON_HEADERS,
    "Content-Type": reply.answer.contentType,
    "Content-Length": bytes.length,
    "Content-Security-Policy": reply.policy ?? PLAIN_POLICY,
  });
  response.end(request.method === "HEAD" ? undefined : bytes);
};

const NO_ROUTE = { query: new URLSearchParams() } as const;

/**
 * The request target's route and query. Only an origin-form target names one; a backslash, which
 * the URL parser reads as a slash, or a target it cannot parse names none.
 */
const targetOf = (url: string | undefined): { route?: BoardRoute; query: URLSearchParams } => {
  if (url === undefined || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    return NO_ROUTE;
  }
  let parsed: URL;
  try {
    parsed = new URL(url, "http://127.0.0.1");
  } catch {
    return NO_ROUTE;
  }
  const route = parseBoardRoute(parsed.pathname);
  return { ...(route ? { route } : {}), query: parsed.searchParams };
};

const gateOf = (request: IncomingMessage, upgrade: boolean): string | undefined =>
  gateRefusal({
    host: request.headers.host,
    origin: request.headers.origin,
    method: request.method,
    upgrade,
  });

// A board the session process serves and has not discarded; a closed ask's board still is (FR-6).
const isLive = (core: HostCore, askId: string): boolean => {
  const board = core.lifecycleBoard(askId);
  return board !== undefined && board.state !== "discarded";
};

// `/m` and `/c/` take the token of any live board, in the header only, checked before anything else.
const headerTokenOpens = (deps: HttpDeps, request: IncomingMessage): boolean => {
  const presented = request.headers[BOARD_TOKEN_HEADER.toLowerCase()];
  return (
    typeof presented === "string" &&
    presented !== "" &&
    deps.tokens.opensAny(presented, (askId) => isLive(deps.core, askId))
  );
};

const boardPage = (deps: HttpDeps, askId: string, query: URLSearchParams): Reply => {
  const token = query.get(BOARD_TOKEN_QUERY);
  if (token === null || token === "") {
    return { answer: BOARD_RESPONSES.invalidLink, body: INVALID_LINK_PAGES.incomplete };
  }
  const board = deps.tokens.opens(askId, token) ? deps.core.lifecycleBoard(askId) : undefined;
  if (board === undefined) {
    return { answer: BOARD_RESPONSES.invalidLink, body: INVALID_LINK_PAGES.invalid };
  }
  if (board.state === "discarded") {
    return { answer: BOARD_RESPONSES.discardedLink, body: INVALID_LINK_PAGES.discarded };
  }
  return { answer: BOARD_RESPONSES.boardPage, body: deps.view.boardPage, policy: deps.view.policy };
};

const replyTo = (deps: HttpDeps, request: IncomingMessage): Reply => {
  if (gateOf(request, false) !== undefined) return text(BOARD_RESPONSES.refused);
  const { route: target, query } = targetOf(request.url);
  const readable = request.method === "GET" || request.method === "HEAD";
  // The source view's branch comes with it (excerpts, task 5.2); until then `/s/` names nothing.
  if (target === undefined || !readable || target.kind === "socket" || target.kind === "source") {
    return text(BOARD_RESPONSES.notFound);
  }
  if (target.kind === "board") return boardPage(deps, target.askId, query);
  if (!headerTokenOpens(deps, request)) return text(BOARD_RESPONSES.tokenRefused);
  if (target.kind === "manifest") {
    return { answer: BOARD_RESPONSES.manifest, body: deps.view.manifest };
  }
  const chunk = deps.view.chunks.get(target.sha256);
  if (chunk === undefined) return text(BOARD_RESPONSES.notFound);
  return { answer: { status: 200, contentType: chunk.contentType }, body: chunk.body };
};

/** Answers one HTTP request; a handler failure is reported and answered with 500. */
export const handleRequest = (
  deps: HttpDeps,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  let reply: Reply;
  try {
    reply = replyTo(deps, request);
  } catch (error) {
    deps.report(error);
    reply = text({ status: 500, contentType: BOARD_RESPONSES.notFound.contentType });
  }
  send(request, response, reply);
};

// Refuses an upgrade with a bare HTTP answer and closes the connection.
const refuseUpgrade = (socket: Duplex, status: number): void => {
  const headers = [
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? "Refused"}`,
    "Connection: close",
    "Content-Length: 0",
    ...Object.entries(COMMON_HEADERS).map(([name, value]) => `${name}: ${value}`),
  ];
  socket.end(`${headers.join("\r\n")}\r\n\r\n`);
};

/**
 * Passes a WebSocket upgrade at `/ws/<askId>` that clears the gate to `accept`; refuses any other.
 * The socket is accepted for any well-formed ask ID: its first message must carry the token.
 */
export const handleUpgrade = (
  deps: HttpDeps,
  request: IncomingMessage,
  socket: Duplex,
  accept: (askId: string) => void,
): void => {
  socket.on("error", (error) => deps.report(error));
  try {
    if (gateOf(request, true) !== undefined) {
      refuseUpgrade(socket, BOARD_RESPONSES.refused.status);
      return;
    }
    const { route: target } = targetOf(request.url);
    if (target?.kind !== "socket" || deps.closed()) {
      refuseUpgrade(socket, BOARD_RESPONSES.notFound.status);
    } else {
      accept(target.askId);
    }
  } catch (error) {
    // A throw here would escape the listener's event and end the session process.
    deps.report(error);
    socket.destroy();
  }
};
