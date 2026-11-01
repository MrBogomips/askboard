// The local API's HTTP side (design decision 2; AD-5, AD-11): every request passes the same checks,
// in order, before a route sees it. A request carrying `Origin` is refused (403), since only a
// browser sends one; the session token header must match, compared in constant time (403); the
// method and path must name a route (404); a POST body must be JSON under 64 KiB, valid against its
// schema at a supported major (400, naming the problems). Every handler answers at once.

import type { IncomingMessage, ServerResponse } from "node:http";
import { STATUS_CODES } from "node:http";
import {
  LOCAL_API_HOST,
  LOCAL_API_ROUTES,
  type LocalApiMessageName,
  type LocalApiMessages,
  SESSION_TOKEN_HEADER,
} from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { sameToken } from "../tokens.ts";

/** The largest request body: a record or a report is a few hundred bytes. */
export const REQUEST_MAX_BYTES = 64 * 1024;

export type RouteName = keyof typeof LOCAL_API_ROUTES;

/** What a handler answers: a JSON body, or a refusal with the problems that explain it. */
export type Reply =
  | { readonly status: 200; readonly json: unknown }
  | { readonly status: Refusal; readonly problems: readonly string[] };

type Refusal = 400 | 403 | 404 | 409;

/** One handler per route; POST handlers get their body, checked against its schema. */
export type Handlers = {
  readonly records: (body: LocalApiMessages["recordsRequest"]) => Reply;
  readonly stop: (body: LocalApiMessages["stopRequest"]) => Reply;
  readonly rule: () => Promise<Reply>;
  readonly notice: (query: URLSearchParams) => Reply;
  readonly modHello: (body: LocalApiMessages["modHelloRequest"]) => Reply;
  readonly modTurn: (body: LocalApiMessages["modTurnRequest"]) => Reply;
  readonly poll: (query: URLSearchParams) => Reply;
  readonly delivered: (body: LocalApiMessages["deliveredRequest"]) => Reply;
};

export type HttpDeps = {
  readonly token: string;
  readonly handlers: Handlers;
  /** AskBoard's own fixed text for stderr: a refused request's route and status. */
  readonly diagnose: (text: string) => void;
  /** A handler that threw: answered 500. */
  readonly report: (error: unknown) => void;
};

export const ok = (json: unknown): Reply => ({ status: 200, json });

export const refused = (status: Refusal, ...problems: string[]): Reply => ({
  status,
  problems,
});

const COMMON_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

type Routed = { readonly name: RouteName; readonly query: URLSearchParams };

const ROUTES = new Map(
  (Object.entries(LOCAL_API_ROUTES) as [RouteName, { method: string; path: string }][]).map(
    ([name, { method, path }]) => [`${method} ${path}`, name],
  ),
);

// The route a method and an origin-form target name; a backslash, which the URL parser reads as a
// slash, or a target it cannot parse names none.
const routeOf = (method: string | undefined, url: string | undefined): Routed | undefined => {
  if (url === undefined || !url.startsWith("/") || url.startsWith("//") || url.includes("\\")) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(url, `http://${LOCAL_API_HOST}`);
  } catch {
    return undefined;
  }
  const name = ROUTES.get(`${method} ${parsed.pathname}`);
  return name === undefined ? undefined : { name, query: parsed.searchParams };
};

type Body =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly problem: string };

const TOO_LARGE = `the body is over ${REQUEST_MAX_BYTES / 1024} KiB`;

// The body as JSON, read up to the limit: a longer one is refused as soon as it shows.
const readBody = (request: IncomingMessage): Promise<Body> =>
  new Promise((resolve) => {
    if (Number(request.headers["content-length"]) > REQUEST_MAX_BYTES) {
      resolve({ ok: false, problem: TOO_LARGE });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const settle = (body: Body) => {
      if (settled) return;
      settled = true;
      resolve(body);
    };
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > REQUEST_MAX_BYTES) settle({ ok: false, problem: TOO_LARGE });
      else if (!settled) chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        settle({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch {
        settle({ ok: false, problem: "the body is not JSON" });
      }
    });
    request.on("error", () => settle({ ok: false, problem: "the body could not be read" }));
  });

const withBody = async <N extends LocalApiMessageName>(
  request: IncomingMessage,
  name: N,
  handle: (body: LocalApiMessages[N]) => Reply,
): Promise<Reply> => {
  const body = await readBody(request);
  if (!body.ok) return refused(400, body.problem);
  const checked = validateLocalApi(name, body.value);
  if (!checked.ok) {
    return refused(400, ...checked.problems.map(({ path, message }) => `${path}: ${message}`));
  }
  return handle(checked.value);
};

const dispatch = (
  { handlers }: HttpDeps,
  { name, query }: Routed,
  request: IncomingMessage,
): Reply | Promise<Reply> => {
  switch (name) {
    case "records":
      return withBody(request, "recordsRequest", handlers.records);
    case "stop":
      return withBody(request, "stopRequest", handlers.stop);
    case "rule":
      return handlers.rule();
    case "notice":
      return handlers.notice(query);
    case "modHello":
      return withBody(request, "modHelloRequest", handlers.modHello);
    case "modTurn":
      return withBody(request, "modTurnRequest", handlers.modTurn);
    case "poll":
      return handlers.poll(query);
    case "delivered":
      return withBody(request, "deliveredRequest", handlers.delivered);
  }
};

const send = (response: ServerResponse, status: number, type: string, text: string): void => {
  const body = Buffer.from(text, "utf8");
  response.writeHead(status, {
    ...COMMON_HEADERS,
    "Content-Type": `${type}; charset=utf-8`,
    "Content-Length": body.length,
  });
  response.end(body);
};

const sendRefusal = (response: ServerResponse, status: number, problems: readonly string[]) => {
  const lines = [STATUS_CODES[status] ?? "Refused", ...problems.map((problem) => `- ${problem}`)];
  // The connection closes after a refusal, so a body left unread goes with it.
  response.setHeader("Connection", "close");
  send(response, status, "text/plain", `${lines.join("\n")}\n`);
};

// The refusal of a request before any route sees it, or undefined when it passes.
const gate = (
  deps: HttpDeps,
  request: IncomingMessage,
  routed: Routed | undefined,
): Reply | undefined => {
  if (request.headers.origin !== undefined) {
    return refused(403, "a request that carries Origin is refused");
  }
  const presented = request.headers[SESSION_TOKEN_HEADER.toLowerCase()];
  if (typeof presented !== "string" || !sameToken(presented, deps.token)) {
    return refused(403, "the session token is missing or wrong");
  }
  if (routed === undefined) return refused(404, "the local API has no such route");
  return undefined;
};

/** Answers one local API request; a handler that throws is reported and answered 500. */
export const handleLocalRequest = async (
  deps: HttpDeps,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const routed = routeOf(request.method, request.url);
  // Only a route's own name reaches stderr, never the target a client sent (AD-11).
  const label =
    routed === undefined
      ? "a request to an unknown route"
      : `${LOCAL_API_ROUTES[routed.name].method} ${LOCAL_API_ROUTES[routed.name].path}`;
  let status: number;
  try {
    const reply = gate(deps, request, routed) ?? (await dispatch(deps, routed as Routed, request));
    status = reply.status;
    if ("json" in reply) send(response, 200, "application/json", JSON.stringify(reply.json));
    else sendRefusal(response, reply.status, reply.problems);
  } catch (error) {
    deps.report(error);
    status = 500;
    if (!response.headersSent) sendRefusal(response, status, []);
    else response.destroy();
  }
  if (status !== 200) deps.diagnose(`local API ${label} answered ${status}`);
};
