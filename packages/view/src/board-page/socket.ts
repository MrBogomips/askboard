// One of the board's WebSockets (design decision 8, AD-11): it opens at the ask's socket route with
// no token in the URL, sends the token as its first message at once on open (Track A's
// `board-host` closes a socket that sends no `connect` within 5 s), hands on only the messages
// that pass the board protocol (AD-7, AD-10), and reports its close with the code. Reconnecting is
// the controller's (`controller.ts`): each attempt is a new socket.

import {
  BOARD_PROTOCOL_VERSION,
  BOARD_TOKEN_QUERY,
  type ConnectMessage,
  type HostMessage,
  type PageMessage,
  parseBoardRoute,
  socketPath,
} from "@askboard/contract";
import type { Problem } from "@askboard/contract/validate";
import { readHostMessage } from "./host-messages.ts";

/** The board's link, as the page's location gives it. */
export type BoardLocation = Pick<URL, "href" | "pathname" | "search">;

/** What the board page uses of a WebSocket. */
export type SocketLike = {
  readonly readyState: number;
  send(text: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "close",
    listener: (event: { data?: unknown; code?: number }) => void,
  ): void;
};

export type SocketConstructor = new (url: string) => SocketLike;

export type BoardSocketHandlers = {
  readonly onMessage: (message: HostMessage) => void;
  /** A message the board protocol refuses: never acted on, only reported. */
  readonly onInvalid: (problems: readonly Problem[]) => void;
  /** The socket closed, or could not open, with this code; called once. */
  readonly onClose: (code: number) => void;
};

export type BoardConnection = {
  /** Sends a page message if the socket is open; says whether it did. */
  send(message: PageMessage): boolean;
  /** Closes the socket; its close is still reported. */
  close(): void;
};

const OPEN = 1;

/** The code of a close that came with none, or of a socket that never opened: a drop. */
export const ABNORMAL_CLOSE = 1006;

/** The board the page shows: its ask's ID and its token. */
export type BoardLink = { readonly askId: string; readonly token: string };

/** The history entry's state the board page keeps the token in once it is out of the URL. */
export const tokenState = (link: BoardLink): { readonly token: string } => ({ token: link.token });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The board the page is a link to: the ask's ID from its path and the token from its query, or,
 * once the board page has taken the token out of the URL so that the view cannot read it from its
 * base URL (AD-8), from the history entry's state, which a reload keeps (not Web Storage: AD-20).
 */
export const boardLinkOf = (location: BoardLocation, state: unknown): BoardLink | undefined => {
  const route = parseBoardRoute(location.pathname);
  if (route?.kind !== "board") return undefined;
  const fromQuery = new URLSearchParams(location.search).get(BOARD_TOKEN_QUERY);
  const fromState = isRecord(state) ? state.token : undefined;
  const token = fromQuery ?? (typeof fromState === "string" ? fromState : "");
  return token === "" ? undefined : { askId: route.askId, token };
};

const socketUrl = (location: BoardLocation, askId: string): string => {
  const url = new URL(socketPath(askId), location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = "";
  return url.href;
};

/** Opens a socket to the board at the page's origin; the token goes in its first message. */
export const connectBoard = (
  location: BoardLocation,
  link: BoardLink,
  handlers: BoardSocketHandlers,
  Socket: SocketConstructor = WebSocket,
): BoardConnection => {
  let closed = false;
  const onClose = (code: number) => {
    if (closed) return;
    closed = true;
    handlers.onClose(code);
  };
  let socket: SocketLike;
  try {
    socket = new Socket(socketUrl(location, link.askId));
  } catch {
    // Reported after the call returns, as a real close would be.
    queueMicrotask(() => onClose(ABNORMAL_CLOSE));
    return { send: () => false, close: () => {} };
  }
  const connect: ConnectMessage = {
    version: BOARD_PROTOCOL_VERSION,
    type: "connect",
    token: link.token,
  };
  socket.addEventListener("open", () => socket.send(JSON.stringify(connect)));
  socket.addEventListener("message", (event) => {
    if (closed) return;
    const checked = readHostMessage(event.data);
    if (checked.ok) handlers.onMessage(checked.value);
    else handlers.onInvalid(checked.problems);
  });
  socket.addEventListener("close", (event) => onClose(event.code ?? ABNORMAL_CLOSE));
  return {
    send: (message) => {
      if (closed || socket.readyState !== OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    close: () => socket.close(),
  };
};
