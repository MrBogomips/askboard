import { describe, expect, mock, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import type { ViewUpdate } from "../view-protocol.ts";
import { NO_CHANNEL, openChannel, type ViewApp } from "./channel.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};

type Result = Awaited<ReturnType<ViewApp["callServerTool"]>>;

const fakeApp = (reply: Result = { content: [], structuredContent: { outcome: "sent" } }) => {
  let toolResult: ((params: { structuredContent?: unknown }) => void) | undefined;
  const app = {
    callServerTool: mock(
      async (_params: { name: string; arguments: Record<string, unknown> }) => reply,
    ),
    addEventListener: mock((_type: "toolresult", listener: typeof toolResult) => {
      toolResult = listener;
    }),
  };
  const notify = (structuredContent: unknown) => toolResult?.({ structuredContent });
  return { app, notify };
};

describe("the view's channel to the board page (design decision 8)", () => {
  test("listens for updates before it connects, so none is missed", () => {
    const { app } = fakeApp();
    const order: string[] = [];
    app.addEventListener.mockImplementation(() => {
      order.push("listen");
    });
    openChannel(app, async () => {
      order.push("connect");
    });
    expect(order).toEqual(["listen", "connect"]);
  });

  test("sends a view message as a tool call once connected, and returns the reply", async () => {
    const { app } = fakeApp();
    let connect = () => {};
    const channel = openChannel(app, () => new Promise<void>((resolve) => (connect = resolve)));
    const reply = channel.send({ type: "ready", itemId: "database" });
    await Bun.sleep(0);
    expect(app.callServerTool).not.toHaveBeenCalled();
    connect();
    expect(await reply).toEqual({ outcome: "sent" });
    expect(app.callServerTool.mock.calls).toEqual([
      [{ name: "askboard.view.ready", arguments: { itemId: "database" } }],
    ]);
  });

  test("a refused call fails with the board page's reason", async () => {
    const { app } = fakeApp({ isError: true, content: [{ type: "text", text: "no such item" }] });
    const channel = openChannel(app, async () => {});
    expect(channel.send({ type: "ready", itemId: "x" })).rejects.toThrow("no such item");
  });

  test("a failed connection fails every send", async () => {
    const { app } = fakeApp();
    const channel = openChannel(app, async () => {
      throw new Error("no host");
    });
    expect(channel.send({ type: "ready", itemId: "x" })).rejects.toThrow("no host");
  });

  test("state updates reach each listener; anything else does not", () => {
    const { app, notify } = fakeApp();
    const channel = openChannel(app, async () => {});
    const listener = mock((_update: ViewUpdate) => {});
    const unsubscribe = channel.onUpdate(listener);
    notify({ type: "state", state: waiting });
    notify({ type: "unknown" });
    notify(undefined);
    expect(listener.mock.calls).toEqual([[{ type: "state", state: waiting }]]);
    unsubscribe();
    notify({ type: "state", state: waiting });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("without a host, as in a Snapshot, nothing is sent and no update comes (AD-9)", async () => {
    expect(await NO_CHANNEL.send({ type: "ready", itemId: "x" })).toBeUndefined();
    expect(typeof NO_CHANNEL.onUpdate(() => {})).toBe("function");
  });
});
