import { describe, expect, mock, test } from "bun:test";
import type { JSONRPCMessage } from "@modelcontextprotocol/client";
import { FrameTransport } from "./frame-transport.ts";

const message: JSONRPCMessage = { jsonrpc: "2.0", method: "ui/notifications/initialized" };

// A window-like pair: the frame's window the transport posts to and hears from, and the window
// whose `message` events it listens to.
const setUp = () => {
  const events = new EventTarget();
  const peer = { postMessage: mock((_data: unknown, _origin: string) => {}) };
  const transport = new FrameTransport(peer, events);
  const received: unknown[] = [];
  transport.onmessage = (data) => received.push(data);
  const deliver = (data: unknown, source: unknown = peer) =>
    events.dispatchEvent(Object.assign(new Event("message"), { data, source }));
  return { events, peer, transport, received, deliver };
};

describe("the postMessage transport between the board page and the view (design decision 8)", () => {
  test("hears JSON-RPC messages from its peer once started", async () => {
    const { transport, received, deliver } = setUp();
    deliver(message);
    expect(received).toEqual([]);
    await transport.start();
    deliver(message);
    expect(received).toEqual([message]);
  });

  test("ignores messages from any other window", async () => {
    const { transport, received, deliver } = setUp();
    await transport.start();
    deliver(message, {});
    deliver(message, null);
    expect(received).toEqual([]);
  });

  test("ignores what is not JSON-RPC 2.0, without logging it", async () => {
    const { transport, received, deliver } = setUp();
    const debug = mock(() => {});
    const original = console.debug;
    console.debug = debug;
    try {
      await transport.start();
      for (const data of ["text", null, [], { method: "x" }, { jsonrpc: "1.0", method: "x" }]) {
        deliver(data);
      }
    } finally {
      console.debug = original;
    }
    expect(received).toEqual([]);
    expect(debug).not.toHaveBeenCalled();
  });

  test("posts to its peer for any origin: the view's is opaque (AD-8)", async () => {
    const { transport, peer } = setUp();
    await transport.start();
    await transport.send(message);
    expect(peer.postMessage).toHaveBeenCalledWith(message, "*");
  });

  test("starts once", async () => {
    const { transport } = setUp();
    await transport.start();
    expect(transport.start()).rejects.toThrow("already started");
  });

  test("closing stops listening and says so", async () => {
    const { transport, received, deliver } = setUp();
    const closed = mock(() => {});
    transport.onclose = closed;
    await transport.start();
    await transport.close();
    deliver(message);
    expect(received).toEqual([]);
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
