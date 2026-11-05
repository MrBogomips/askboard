// Board routes, the token's places and what each route answers (design decision 5). Both the board
// page and `board-host` read them, and the view's test server answers as `board-host` does, so they
// live in the contract.

import { BOARD_HOST, ID_PATTERN } from "./constants.ts";
import { SHA256_HEX_PATTERN } from "./hash.ts";

export const BOARD_ROUTES = {
  /** `GET /b/<askId>?t=<token>`: the board page. */
  board: "/b/",
  /** `GET /c/<sha256>` with the token header: a chunk's script or style, by its SHA-256 in lowercase hex. */
  chunk: "/c/",
  /** `GET /m` with the token header: the view manifest, from which the board page picks the chunks. */
  manifest: "/m",
  /**
   * The WebSocket upgrade at `/ws/<askId>`, accepted for any well-formed ask ID once `Host` and
   * `Origin` pass: the token travels in the first message, which is where a wrong one is refused.
   */
  socket: "/ws/",
  /**
   * `GET /s/<askId>/<itemId>?t=<token>&scheme=<light|dark>`: the source view of a pointer excerpt or
   * pointer reference, which the reading panel frames (excerpts, design decision 2; AD-8).
   */
  source: "/s/",
} as const;

/** The board link's query parameter that holds the token. */
export const BOARD_TOKEN_QUERY = "t";

/** The request header that holds the token on every request but the board link (AD-11). */
export const BOARD_TOKEN_HEADER = "X-AskBoard-Token";

export const boardPath = (askId: string): string => `${BOARD_ROUTES.board}${askId}`;
export const chunkPath = (sha256: string): string => `${BOARD_ROUTES.chunk}${sha256}`;
export const manifestPath = (): string => BOARD_ROUTES.manifest;
export const socketPath = (askId: string): string => `${BOARD_ROUTES.socket}${askId}`;
export const sourcePath = (askId: string, itemId: string): string =>
  `${BOARD_ROUTES.source}${askId}/${itemId}`;

/** The source view's query parameter for its colour scheme, `light` or `dark`. */
export const SOURCE_SCHEME_QUERY = "scheme";

/** `http://127.0.0.1:<port>/b/<askId>?t=<token>`, the link the `ask` result returns. */
export const boardLink = (link: { port: number; askId: string; token: string }): string =>
  `http://${BOARD_HOST}:${link.port}${boardPath(link.askId)}?${BOARD_TOKEN_QUERY}=${link.token}`;

const HTML = "text/html; charset=utf-8";
const TEXT = "text/plain; charset=utf-8";

/**
 * The status and `Content-Type` of each answer an HTTP route gives. Every response also carries
 * `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` and sets no cookie (AD-11).
 * `/c/` and `/m` check the token header first, so a request without a valid one learns nothing of
 * the manifest; a valid one is the token of any board the session process serves and has not
 * discarded, since a chunk or the manifest is no ask's content.
 */
export const BOARD_RESPONSES = {
  /** `/b/`: the board page, for a board's link with that board's token. */
  boardPage: { status: 200, contentType: HTML },
  /**
   * `/b/`: the invalid-link page, for a link without `t`, with a token that does not open that
   * ask's board, or naming an ask the session process does not know.
   */
  invalidLink: { status: 403, contentType: HTML },
  /** `/b/`: the invalid-link page saying only that the ask was discarded, for a discarded ask's link. */
  discardedLink: { status: 410, contentType: HTML },
  /** `/m`: the manifest file's bytes, as the view build wrote them. */
  manifest: { status: 200, contentType: "application/json; charset=utf-8" },
  /** `/c/`: a script the manifest lists under a chunk. */
  script: { status: 200, contentType: "text/javascript; charset=utf-8" },
  /** `/c/`: a style the manifest lists under a chunk. */
  style: { status: 200, contentType: "text/css; charset=utf-8" },
  /** `/c/` and `/m`: no token header, or a token that opens no board of this session process. */
  tokenRefused: { status: 403, contentType: TEXT },
  /** `/c/` with a hash no chunk of the manifest lists, and any path that names no route. */
  notFound: { status: 404, contentType: TEXT },
  /**
   * Any route, before anything else: a request whose `Host` is not a loopback name, whose `Origin`
   * is not `http://` plus its `Host`, or that lacks the `Origin` an upgrade or a method other than
   * GET or HEAD needs (AD-11). A WebSocket upgrade refused for it gets this status.
   */
  refused: { status: 403, contentType: TEXT },
  /**
   * `/s/`: the source view, for a pointer item of an ask the token opens (excerpts). Without `t`,
   * or with a token that does not open that ask, it is `tokenRefused`; for a discarded ask,
   * `discardedLink`'s status as plain text; for any other item, `notFound`.
   */
  sourceView: { status: 200, contentType: HTML },
} as const;

export type BoardRoute =
  | { readonly kind: "board"; readonly askId: string }
  | { readonly kind: "chunk"; readonly sha256: string }
  | { readonly kind: "manifest" }
  | { readonly kind: "socket"; readonly askId: string }
  | { readonly kind: "source"; readonly askId: string; readonly itemId: string };

const ID = new RegExp(ID_PATTERN);
const SHA256 = new RegExp(SHA256_HEX_PATTERN);

// The source route: exactly two IDs after its prefix, read with no decoding, so `%2e%2e` is no ID.
const sourceRoute = (rest: string): BoardRoute | undefined => {
  const [askId = "", itemId = "", ...more] = rest.split("/");
  return more.length === 0 && ID.test(askId) && ID.test(itemId)
    ? { kind: "source", askId, itemId }
    : undefined;
};

/** The route a request path names, without its query; undefined for any other path. */
export const parseBoardRoute = (pathname: string): BoardRoute | undefined => {
  if (pathname === BOARD_ROUTES.manifest) return { kind: "manifest" };
  if (pathname.startsWith(BOARD_ROUTES.source)) {
    return sourceRoute(pathname.slice(BOARD_ROUTES.source.length));
  }
  for (const kind of ["board", "chunk", "socket"] as const) {
    const prefix = BOARD_ROUTES[kind];
    if (!pathname.startsWith(prefix)) continue;
    const rest = pathname.slice(prefix.length);
    if (kind === "chunk") return SHA256.test(rest) ? { kind, sha256: rest } : undefined;
    return ID.test(rest) ? { kind, askId: rest } : undefined;
  }
  return undefined;
};
