// The transport ext-apps' `App` and `AppBridge` talk over across the view's iframe (design
// decision 8, AD-8): `postMessage` to the other window, and `message` events heard only from it.
// It stands in for ext-apps' own `PostMessageTransport`, which logs every message it sends and
// receives to the console; this one logs nothing. Each side passes the other's window: the board
// page the frame's, the view its parent.

import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/client";

/** The other window, as far as the transport uses it. */
export type FramePeer = { postMessage(message: unknown, targetOrigin: string): void };

/** The window whose `message` events the transport listens to. */
export type MessageEvents = Pick<EventTarget, "addEventListener" | "removeEventListener">;

const isJsonRpc = (data: unknown): data is JSONRPCMessage =>
  typeof data === "object" && data !== null && !Array.isArray(data) && "jsonrpc" in data
    ? data.jsonrpc === "2.0"
    : false;

export class FrameTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  readonly #peer: FramePeer;
  readonly #events: MessageEvents;
  #started = false;

  // Only the peer's messages count: any other window may post to this one too.
  readonly #listener = (event: Event): void => {
    const { source, data } = event as MessageEvent;
    if (source !== this.#peer || !isJsonRpc(data)) return;
    this.onmessage?.(data);
  };

  constructor(peer: FramePeer, events: MessageEvents) {
    this.#peer = peer;
    this.#events = events;
  }

  async start(): Promise<void> {
    if (this.#started) throw new Error("the frame transport is already started");
    this.#started = true;
    this.#events.addEventListener("message", this.#listener);
  }

  /** Posts for any origin: the view's is opaque, so no narrower target origin can reach it. */
  async send(message: JSONRPCMessage): Promise<void> {
    this.#peer.postMessage(message, "*");
  }

  async close(): Promise<void> {
    this.#events.removeEventListener("message", this.#listener);
    this.onclose?.();
  }
}
