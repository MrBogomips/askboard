// The board link as the session process gives it, in `ask`'s result and to `BROWSER`:
// `http://127.0.0.1:<port>/b/<askId>?t=<token>`, on a port of the board range (mcp-adapter spec,
// "The ask result"; board-host spec, "Loopback listener"). The session-process target reads it to
// put its proxy in front of the board and gives the tests the same link on the proxy's port.

import {
  BOARD_HOST,
  BOARD_PORT_RANGE,
  BOARD_TOKEN_PATTERN,
  BOARD_TOKEN_QUERY,
  boardLink,
  parseBoardRoute,
} from "@askboard/contract";

export type BoardLink = { readonly port: number; readonly askId: string; readonly token: string };

const TOKEN = new RegExp(BOARD_TOKEN_PATTERN);

const problemOf = (url: URL): string | undefined => {
  const port = url.port === "" ? undefined : Number(url.port);
  const tokens = url.searchParams.getAll(BOARD_TOKEN_QUERY);
  const range = `${BOARD_PORT_RANGE.first}-${BOARD_PORT_RANGE.last}`;
  if (url.protocol !== "http:") return `${url.protocol} is not http`;
  if (url.hostname !== BOARD_HOST) return `host ${url.hostname}, not ${BOARD_HOST}`;
  if (port === undefined || port < BOARD_PORT_RANGE.first || port > BOARD_PORT_RANGE.last) {
    return `port ${port ?? "none"}, not in ${range}`;
  }
  if (parseBoardRoute(url.pathname)?.kind !== "board") return `path ${url.pathname}`;
  if (tokens.length > 1) return `${tokens.length} tokens`;
  const [token] = tokens;
  if (token === undefined || !TOKEN.test(token)) return `token ${token ?? "none"}`;
  if (url.hash !== "") return `fragment ${url.hash}`;
  return undefined;
};

/** The port, ask and token of a board link; fails saying what is wrong with it. */
export const parseBoardLink = (link: string): BoardLink => {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error(`not a board link (not a URL): ${JSON.stringify(link)}`);
  }
  const problem = problemOf(url);
  if (problem !== undefined) throw new Error(`not a board link (${problem}): ${link}`);
  const route = parseBoardRoute(url.pathname);
  const askId = route?.kind === "board" ? route.askId : "";
  return { port: Number(url.port), askId, token: url.searchParams.get(BOARD_TOKEN_QUERY) ?? "" };
};

/** The same board link on another port of the loopback host, such as a proxy's. */
export const linkThrough = (link: BoardLink, port: number): string => boardLink({ ...link, port });
