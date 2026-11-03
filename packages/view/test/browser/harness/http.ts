// How the test server answers an HTTP request, as `board-host` does (design decision 5): the
// contract's routes, each answer with the status and `Content-Type` of `BOARD_RESPONSES`, the
// token checked first on `/m` and `/c/`, and on every answer `nosniff` and `no-referrer`, with no
// cookie (AD-11). The board page carries the policy computed from the manifest (AD-8).

import {
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
  BOARD_TOKEN_QUERY,
  boardPagePolicy,
  parseBoardRoute,
} from "@askboard/contract";
import type { ViewBuild } from "./view-build.ts";

/**
 * What the session side knows of the ask: `open` while it serves the board, `discarded` once it
 * has exited, `unknown` once a restart has forgotten the ask and its token.
 */
export type BoardAccess = {
  readonly askId: string;
  readonly token: string;
  readonly state: "open" | "discarded" | "unknown";
};

export type HttpRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
};

export type HttpAnswer = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

type Kind = (typeof BOARD_RESPONSES)[keyof typeof BOARD_RESPONSES];

const INVALID_LINK =
  '<!doctype html><html lang="en"><title>AskBoard</title><p>This link opens no board. Ask the agent for the board\'s link again.</p></html>';
const DISCARDED_LINK =
  '<!doctype html><html lang="en"><title>AskBoard</title><p>This ask was discarded.</p></html>';

const answer = (
  kind: Kind,
  body: string,
  extra: Readonly<Record<string, string>> = {},
): HttpAnswer => ({
  status: kind.status,
  headers: {
    "Content-Type": kind.contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extra,
  },
  body,
});

// A page with no script or style at all.
const page = (kind: Kind, body: string) =>
  answer(kind, body, { "Content-Security-Policy": "default-src 'none'" });

const notFound = () => answer(BOARD_RESPONSES.notFound, "Not found.\n");
const tokenRefused = () => answer(BOARD_RESPONSES.tokenRefused, "The token opens no board.\n");

const boardPage = (url: URL, askId: string, view: ViewBuild, access: BoardAccess) => {
  const token = url.searchParams.get(BOARD_TOKEN_QUERY);
  if (access.state === "unknown" || askId !== access.askId || token !== access.token) {
    return page(BOARD_RESPONSES.invalidLink, INVALID_LINK);
  }
  if (access.state === "discarded") return page(BOARD_RESPONSES.discardedLink, DISCARDED_LINK);
  const html = view.files.get(view.manifest.boardPage.html.path) ?? "";
  return answer(BOARD_RESPONSES.boardPage, html, {
    "Content-Security-Policy": boardPagePolicy(view.manifest),
  });
};

const chunkFile = (sha256: string, view: ViewBuild) => {
  for (const chunk of Object.values(view.manifest.chunks)) {
    if (chunk.script.sha256 === sha256) {
      return answer(BOARD_RESPONSES.script, view.files.get(chunk.script.path) ?? "");
    }
    const style = chunk.styles.find((file) => file.sha256 === sha256);
    if (style !== undefined) return answer(BOARD_RESPONSES.style, view.files.get(style.path) ?? "");
  }
  return notFound();
};

/** The answer to one request; WebSocket upgrades are the server's own business. */
export const answerHttp = (
  request: HttpRequest,
  view: ViewBuild,
  access: BoardAccess,
): HttpAnswer => {
  if (request.method !== "GET" && request.method !== "HEAD") return notFound();
  const url = new URL(request.url);
  const route = parseBoardRoute(url.pathname);
  // The fixture source view comes with the reading panel (excerpts, task 6.6).
  if (route === undefined || route.kind === "socket" || route.kind === "source") return notFound();
  if (route.kind === "board") return boardPage(url, route.askId, view, access);
  if (request.headers.get(BOARD_TOKEN_HEADER) !== access.token || access.state !== "open") {
    return tokenRefused();
  }
  if (route.kind === "manifest") return answer(BOARD_RESPONSES.manifest, view.manifestText);
  return chunkFile(route.sha256, view);
};

export const toResponse = (http: HttpAnswer, method: string): Response =>
  new Response(method === "HEAD" ? null : http.body, {
    status: http.status,
    headers: http.headers,
  });
