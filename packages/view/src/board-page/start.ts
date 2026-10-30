// The board page at run time (design decision 8), as far as task 8.1 needs it to build: the
// WebSocket with the token first, every message `board-host` sends checked before use, and the
// view's sandboxed iframe hosted through ext-apps' `AppBridge`. Task 8.6 completes it: the
// manifest and chunk fetches, `assemble`, the banners, the answer queue and reconnecting.

import {
  BOARD_PROTOCOL_VERSION,
  BOARD_TOKEN_QUERY,
  type ConnectMessage,
  type HostMessage,
  parseBoardRoute,
  socketPath,
} from "@askboard/contract";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { readHostMessage } from "./host-messages.ts";

const HOST_INFO = { name: "askboard-board-page", version: "0.0.0" };

/** The view's iframe: exactly `sandbox="allow-scripts"`, so the view's origin is opaque (AD-8). */
export const createViewFrame = (document: Document): HTMLIFrameElement => {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.title = "AskBoard";
  return frame;
};

/** Hosts the view's ext-apps `App` in the frame; the board page answers its calls itself. */
export const bridgeView = async (frame: HTMLIFrameElement): Promise<AppBridge> => {
  const target = frame.contentWindow;
  if (target === null) throw new Error("the view's frame is not in the document");
  const bridge = new AppBridge(null, HOST_INFO, {});
  await bridge.connect(new PostMessageTransport(target, target));
  return bridge;
};

const socketUrl = (location: Location, askId: string): string => {
  const url = new URL(socketPath(askId), location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = "";
  return url.href;
};

/** Opens the board's WebSocket and hands on every message that passes the board protocol. */
export const connectBoard = (
  location: Location,
  onMessage: (message: HostMessage) => void,
): WebSocket | undefined => {
  const route = parseBoardRoute(location.pathname);
  const token = new URLSearchParams(location.search).get(BOARD_TOKEN_QUERY);
  if (route?.kind !== "board" || token === null) return undefined;
  const socket = new WebSocket(socketUrl(location, route.askId));
  const connect: ConnectMessage = { version: BOARD_PROTOCOL_VERSION, type: "connect", token };
  socket.addEventListener("open", () => socket.send(JSON.stringify(connect)));
  socket.addEventListener("message", (event) => {
    const checked = readHostMessage(event.data);
    if (checked.ok) onMessage(checked.value);
  });
  return socket;
};

export const startBoardPage = (window: Window): void => {
  const frame = createViewFrame(window.document);
  window.document.body.append(frame);
  void bridgeView(frame);
  connectBoard(window.location, () => {});
};
