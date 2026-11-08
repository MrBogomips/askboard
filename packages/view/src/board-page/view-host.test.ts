// The board page's `AppBridge` and the view's `App`, end to end over the frame transport between
// two window stand-ins: the messages design decision 8 sends across the iframe.

import { afterEach, describe, expect, mock, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import { App } from "@modelcontextprotocol/ext-apps";
import { FrameTransport } from "../frame-transport.ts";
import { openChannel, type ViewChannel } from "../shell/channel.ts";
import type { Theme } from "../theme.ts";
import type { ViewMessage, ViewUpdate } from "../view-protocol.ts";
import { hostView, type ViewHost } from "./view-host.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const answered: BoardState = {
  ask: "answered",
  questions: [
    {
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { choice: ["PostgreSQL"], when: "2026-10-29T09:41:27Z", receipt: "sent" },
    },
  ],
};

// The board page's window and the view's: each posts into the other's event target, cloned and
// stamped with its own window as the source, as `postMessage` does.
const windows = () => {
  const pageEvents = new EventTarget();
  const viewEvents = new EventTarget();
  const deliver = (events: EventTarget, source: object) => (data: unknown) =>
    queueMicrotask(() =>
      events.dispatchEvent(
        Object.assign(new Event("message"), { data: structuredClone(data), source }),
      ),
    );
  const view: { postMessage: (data: unknown) => void } = { postMessage: () => {} };
  const page: { postMessage: (data: unknown) => void } = { postMessage: () => {} };
  view.postMessage = deliver(viewEvents, page);
  page.postMessage = deliver(pageEvents, view);
  return { pageEvents, viewEvents, view, page };
};

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const item of open.splice(0)) await item.close();
});

const setUp = async (
  handle = mock(async (_message: ViewMessage) => ({})),
  theme: Theme = "light",
) => {
  const { pageEvents, viewEvents, view, page } = windows();
  const host: ViewHost = await hostView(view, pageEvents, handle, theme);
  open.push(host);
  const connectView = (): {
    app: App;
    channel: ViewChannel;
    updates: ViewUpdate[];
    themes: Theme[];
  } => {
    const app = new App({ name: "askboard-view", version: "0.0.0" }, {}, { autoResize: false });
    open.push(app);
    const updates: ViewUpdate[] = [];
    const themes: Theme[] = [];
    const channel = openChannel(app, () => app.connect(new FrameTransport(page, viewEvents)));
    channel.onUpdate((update) => updates.push(update));
    channel.onTheme((theme) => themes.push(theme));
    return { app, channel, updates, themes };
  };
  return { host, handle, connectView };
};

const settled = () => Bun.sleep(20);

describe("the board page hosting the view (design decision 8)", () => {
  test("keeps chunks across states coalesced before the view handshake", async () => {
    const { host, connectView } = await setUp();
    const chunk = {
      name: "new",
      script: { text: "newWidget();", sha256: "a".repeat(64) },
      styles: [],
    };
    host.update({ type: "state", state: waiting, chunks: [chunk] });
    host.update({ type: "state", state: answered });
    const { updates } = connectView();
    await settled();
    expect(updates).toEqual([{ type: "state", state: answered, chunks: [chunk] }]);
    host.update({ type: "state", state: waiting });
    await settled();
    expect(updates.at(-1)?.chunks).toBeUndefined();
  });
  test("a view message reaches the board page, checked, and its reply comes back", async () => {
    const handle = mock(async (_message: ViewMessage) => ({ seen: true }));
    const { connectView } = await setUp(handle);
    const { channel } = connectView();
    expect(await channel.send({ type: "ready", itemId: "database" })).toEqual({ seen: true });
    expect(handle.mock.calls).toEqual([[{ type: "ready", itemId: "database" }]]);
  });

  test("a call that is no view message is refused, and the board page never acts on it", async () => {
    const { handle, connectView } = await setUp();
    const { app } = connectView();
    await settled();
    const result = await app.callServerTool({ name: "askboard.view.drop", arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("/name");
    expect(handle).not.toHaveBeenCalled();
  });

  test("the latest state reaches the view once it has connected, then each new one", async () => {
    const { host, connectView } = await setUp();
    host.update({ type: "state", state: waiting });
    host.update({ type: "state", state: answered });
    const { updates } = connectView();
    await settled();
    expect(updates).toEqual([{ type: "state", state: answered }]);
    host.update({ type: "state", state: waiting, lock: "discarded" });
    await settled();
    expect(updates).toEqual([
      { type: "state", state: answered },
      { type: "state", state: waiting, lock: "discarded" },
    ]);
  });

  test("the view gets the board page's theme at connect, then each change (Dark theme)", async () => {
    const { host, connectView } = await setUp(undefined, "dark");
    const { themes } = connectView();
    await settled();
    expect(themes).toEqual(["dark"]);
    host.setTheme("dark");
    host.setTheme("light");
    await settled();
    expect(themes).toEqual(["dark", "light"]);
  });

  test("before any state, the view hears nothing", async () => {
    const { connectView } = await setUp();
    const { updates } = connectView();
    await settled();
    expect(updates).toEqual([]);
  });
});
