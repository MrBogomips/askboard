// The board's WebSocket (design decision 8, AD-11): it opens at the ask's socket route with no
// token in the URL, sends the token as its first message, and hands on only the messages that
// pass the board protocol (AD-7, AD-10). Task 8.6 adds reconnecting with backoff, no reconnect
// after the contract's close codes, and the queue of answers sent while disconnected.

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
  addEventListener(type: "open" | "message", listener: (event: { data?: unknown }) => void): void;
};

export type SocketConstructor = new (url: string) => SocketLike;

export type BoardSocketHandlers = {
  readonly onMessage: (message: HostMessage) => void;
  /** A message the board protocol refuses: never acted on, only reported. */
  readonly onInvalid: (problems: readonly Problem[]) => void;
};

export type BoardConnection = {
  /** Sends a page message if the socket is open; says whether it did. */
  send(message: PageMessage): boolean;
};

const OPEN = 1;

/** The ask's ID and the board's token, when the page is a board link that carries one. */
export const boardLinkOf = (
  location: BoardLocation,
): { readonly askId: string; readonly token: string } | undefined => {
  const route = parseBoardRoute(location.pathname);
  const token = new URLSearchParams(location.search).get(BOARD_TOKEN_QUERY);
  return route?.kind === "board" && token !== null ? { askId: route.askId, token } : undefined;
};

const socketUrl = (location: BoardLocation, askId: string): string => {
  const url = new URL(socketPath(askId), location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = "";
  return url.href;
};

/** Opens the board's socket; undefined when the page is no board link with a token. */
export const connectBoard = (
  location: BoardLocation,
  handlers: BoardSocketHandlers,
  Socket: SocketConstructor = WebSocket,
): BoardConnection | undefined => {
  const link = boardLinkOf(location);
  if (link === undefined) return undefined;
  const socket = new Socket(socketUrl(location, link.askId));
  const connect: ConnectMessage = {
    version: BOARD_PROTOCOL_VERSION,
    type: "connect",
    token: link.token,
  };
  socket.addEventListener("open", () => socket.send(JSON.stringify(connect)));
  socket.addEventListener("message", (event) => {
    const checked = readHostMessage(event.data);
    if (checked.ok) handlers.onMessage(checked.value);
    else handlers.onInvalid(checked.problems);
  });
  return {
    send: (message) => {
      if (socket.readyState !== OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
  };
};
