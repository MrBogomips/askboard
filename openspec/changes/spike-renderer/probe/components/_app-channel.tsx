// Shared by the AppChannel chunks (task 4.1): the view's ext-apps `App`, connected to the board
// page's `AppBridge` over `postMessage`. On a click it sends the draft as model context. The
// outcome of each step is view state in the draft record.

import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { useEffect, useRef, useState } from "react";
import { type ItemProps, useReadyAfterLayout } from "../port/index.ts";

export const AppChannel = ({ item, ui, emit, ready }: ItemProps) => {
  const app = useRef<App | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const instance = new App({ name: "askboard-view", version: "0.0.0" }, {}, { autoResize: false });
    app.current = instance;
    instance
      .connect(new PostMessageTransport(window.parent, window.parent))
      .then(() => emit({ type: "ui.set", id: item.id, value: { connected: true, host: instance.getHostVersion()?.name ?? null } }))
      .catch((error: unknown) => emit({ type: "ui.set", id: item.id, value: { connected: false, error: String(error) } }))
      .finally(() => setSettled(true));
    return () => {
      instance.close().catch(() => undefined);
    };
  }, [emit, item.id]);
  useReadyAfterLayout(ready, settled);
  const state = (ui ?? {}) as { connected?: boolean; host?: string; sent?: boolean; error?: string };
  const send = () =>
    app.current
      ?.updateModelContext({ content: [{ type: "text", text: "draft: retry policy = exponential" }] })
      .then(() => emit({ type: "ui.set", id: item.id, value: { ...state, sent: true } }))
      .catch((error: unknown) => emit({ type: "ui.set", id: item.id, value: { ...state, sent: false, error: String(error) } }));
  return (
    <div className="flex items-center gap-2 text-body">
      <span data-connected={String(state.connected ?? "pending")}>
        {state.connected ? `connected to ${state.host}` : state.error ? `not connected: ${state.error}` : "connecting"}
      </span>
      <button type="button" className="rounded-md border border-input px-2 py-1 text-control" onClick={send} disabled={!state.connected}>
        Send context
      </button>
      {state.sent ? <span data-sent="true">sent</span> : null}
    </div>
  );
};

