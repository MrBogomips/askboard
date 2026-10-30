// Probe only: the board page's side of the view message set (task 4.1), an ext-apps `AppBridge`
// talking to the view's `App` over `postMessage`. The board-page stand-in inlines this chunk,
// by hash, for fixtures that ask for it. It logs every request and notification it receives.

import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

type Logged = { method: string; t: number; params?: unknown };

const log: Logged[] = [];
const now = () => performance.timeOrigin + performance.now();
const record = (method: string, params?: unknown) => log.push({ method, t: now(), params });

Object.assign(window, {
  __bridgeLog: log,
  __askboardBridge: async (frame: HTMLIFrameElement) => {
    const target = frame.contentWindow;
    if (!target) return record("bridge/no-frame");
    const bridge = new AppBridge(
      null,
      { name: "askboard-board-stand-in", version: "0.0.0" },
      { updateModelContext: { text: {} }, message: { text: {} } },
      { hostContext: { theme: "light" } },
    );
    bridge.oninitialized = () => record("ui/notifications/initialized");
    bridge.onupdatemodelcontext = async (params) => {
      record("ui/update-model-context", params);
      return {};
    };
    bridge.onmessage = async (params) => {
      record("ui/message", params);
      return {};
    };
    bridge.onsizechange = (params) => record("ui/notifications/size-changed", params);
    try {
      await bridge.connect(new PostMessageTransport(target, target));
      record("bridge/connected");
    } catch (error) {
      record("bridge/connect-failed", String(error));
    }
  },
});
