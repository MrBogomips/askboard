// The board page's side of the iframe channel (design decision 8, AD-8): ext-apps' `AppBridge`,
// talking to the view's `App` over the frame transport. It answers the view's tool calls itself
// and never forwards them: each must read as a view message, or it is refused and the board page
// never acts on it. It sends the board state on as tool-result notifications, the latest one once
// the view has finished its handshake and each new one after that.

import type { BoardState } from "@askboard/contract";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { type FramePeer, FrameTransport, type MessageEvents } from "../frame-transport.ts";
import { readViewMessage, type ViewMessage, viewUpdateResult } from "../view-protocol.ts";

const HOST_INFO = { name: "askboard-board-page", version: "0.0.0" };

/** The board page's reply to a view message, as the tool result's structured content. */
export type ViewReply = Record<string, unknown>;

export type ViewHost = {
  /** The board state the view shows: sent now if the view is connected, else once it is. */
  update(state: BoardState): void;
  close(): Promise<void>;
};

const refusal = (text: string) => ({ isError: true, content: [{ type: "text" as const, text }] });

/**
 * Hosts the view in the frame whose window is `peer`, hearing it on `events` (the board page's
 * window). Connect it before the frame's srcdoc is set, so that the view's handshake is heard.
 */
export const hostView = async (
  peer: FramePeer,
  events: MessageEvents,
  handle: (message: ViewMessage) => Promise<ViewReply>,
): Promise<ViewHost> => {
  const bridge = new AppBridge(null, HOST_INFO, { serverTools: {} });
  let initialized = false;
  let latest: BoardState | undefined;
  const send = () => {
    if (!initialized || latest === undefined) return;
    void bridge.sendToolResult(viewUpdateResult({ type: "state", state: latest }));
  };
  bridge.oninitialized = () => {
    initialized = true;
    send();
  };
  bridge.oncalltool = async (params) => {
    const checked = readViewMessage(params);
    if (!checked.ok) {
      return refusal(checked.problems.map(({ path, message }) => `${path}: ${message}`).join("\n"));
    }
    return { content: [], structuredContent: await handle(checked.value) };
  };
  await bridge.connect(new FrameTransport(peer, events));
  return {
    update: (state) => {
      latest = state;
      send();
    },
    close: () => bridge.close(),
  };
};
