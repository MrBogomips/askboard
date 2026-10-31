import { describe, expect, mock, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import type { ViewUpdate } from "../view-protocol.ts";
import { NO_CHANNEL, openChannel, type ViewApp } from "./channel.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};

type Result = Awaited<ReturnType<ViewApp["callServerTool"]>>;

type Listener = (params: { structuredContent?: unknown; theme?: unknown }) => void;

const fakeApp = (
  reply: Result = { content: [], structuredContent: { outcome: "sent" } },
  hostContext: { theme?: unknown } | undefined = undefined,
) => {
  const listeners = new Map<string, Listener>();
  const app = {
    callServerTool: mock(
      async (_params: { name: string; arguments: Record<string, unknown> }) => reply,
    ),
    addEventListener: mock((type: "toolresult" | "hostcontextchanged", listener: Listener) => {
      listeners.set(type, listener);
    }),
    getHostContext: () => hostContext,
  };
  const notify = (structuredContent: unknown) =>
    listeners.get("toolresult")?.({ structuredContent });
  const changeContext = (context: { theme?: unknown }) =>
    listeners.get("hostcontextchanged")?.(context);
  return { app, notify, changeContext };
};

describe("the view's channel to the board page (design decision 8)", () => {
  test("listens for updates and the theme before it connects, so none is missed", () => {
    const { app } = fakeApp();
    const order: string[] = [];
    app.addEventListener.mockImplementation(() => {
      order.push("listen");
    });
    openChannel(app, async () => {
      order.push("connect");
    });
    expect(order).toEqual(["listen", "listen", "connect"]);
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

  test("the board page's theme reaches the view once connected, then each change", async () => {
    const { app, changeContext } = fakeApp(undefined, { theme: "dark" });
    const themes: string[] = [];
    const channel = openChannel(app, async () => {});
    const unsubscribe = channel.onTheme((theme) => themes.push(theme));
    await Bun.sleep(0);
    expect(themes).toEqual(["dark"]);
    changeContext({ theme: "light" });
    changeContext({});
    changeContext({ theme: "sepia" });
    expect(themes).toEqual(["dark", "light"]);
    unsubscribe();
    changeContext({ theme: "dark" });
    expect(themes).toEqual(["dark", "light"]);
  });

  test("no theme reaches the view when the host sends none, or the connection fails", async () => {
    const { app } = fakeApp(undefined, {});
    const themes: string[] = [];
    openChannel(app, async () => {}).onTheme((theme) => themes.push(theme));
    const failing = fakeApp(undefined, { theme: "dark" }).app;
    const channel = openChannel(failing, async () => {
      throw new Error("no host");
    });
    channel.onTheme((theme) => themes.push(theme));
    channel.send({ type: "ready", itemId: "x" }).catch(() => {});
    await Bun.sleep(0);
    expect(themes).toEqual([]);
  });

  test("without a host, as in a Snapshot, nothing is sent and no update comes (AD-9)", async () => {
    expect(await NO_CHANNEL.send({ type: "ready", itemId: "x" })).toBeUndefined();
    expect(typeof NO_CHANNEL.onUpdate(() => {})).toBe("function");
    expect(typeof NO_CHANNEL.onTheme(() => {})).toBe("function");
  });
});
