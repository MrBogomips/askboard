// The view's side of the iframe channel (design decision 8): ext-apps' `App`, connected to the
// board page's `AppBridge`. View messages leave as tool calls, sent once the handshake is done;
// updates arrive as tool-result notifications, heard from before the handshake starts so that
// none is missed. The theme comes in the host context, at the handshake and on each change
// (EXPERIENCE.md, Dark theme). A Snapshot has no host and so no channel (AD-9).

import { readTheme, type Theme } from "../theme.ts";
import {
  readViewUpdate,
  toolCallOf,
  type ViewMessage,
  type ViewToolCall,
  type ViewUpdate,
} from "../view-protocol.ts";

type ToolResult = {
  readonly content?: readonly unknown[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
};

/** What the channel uses of ext-apps' `App`. */
export type ViewApp = {
  callServerTool(params: ViewToolCall): Promise<ToolResult>;
  addEventListener(
    type: "toolresult",
    listener: (params: { structuredContent?: unknown }) => void,
  ): void;
  addEventListener(
    type: "hostcontextchanged",
    listener: (params: { theme?: unknown }) => void,
  ): void;
  getHostContext(): { readonly theme?: unknown } | undefined;
};

export type ViewChannel = {
  /** Sends a view message; resolves to the board page's reply, and fails on its refusal. */
  send(message: ViewMessage): Promise<Record<string, unknown> | undefined>;
  onUpdate(listener: (update: ViewUpdate) => void): () => void;
  /** The board page's theme, once connected and on each change. */
  onTheme(listener: (theme: Theme) => void): () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A refusal's text, as the board page wrote it in the result's content.
const refusalOf = (result: ToolResult): string =>
  (result.content ?? [])
    .map((block) =>
      typeof block === "object" && block !== null && "text" in block ? String(block.text) : "",
    )
    .join("\n") || "the board page refused the view message";

/** The channel over `app`; `connect` runs the handshake once the listener is in place. */
export const openChannel = (app: ViewApp, connect: () => Promise<void>): ViewChannel => {
  const listeners = new Set<(update: ViewUpdate) => void>();
  app.addEventListener("toolresult", (params) => {
    const update = readViewUpdate(params.structuredContent);
    if (update === undefined) return;
    for (const listener of listeners) listener(update);
  });
  const themes = new Set<(theme: Theme) => void>();
  const tellTheme = (value: unknown) => {
    const theme = readTheme(value);
    if (theme !== undefined) for (const listener of themes) listener(theme);
  };
  app.addEventListener("hostcontextchanged", (params) => tellTheme(params.theme));
  const connected = connect();
  connected.then(
    () => tellTheme(app.getHostContext()?.theme),
    () => {},
  );
  return {
    send: async (message) => {
      await connected;
      const result = await app.callServerTool(toolCallOf(message));
      if (result.isError === true) throw new Error(refusalOf(result));
      return isRecord(result.structuredContent) ? result.structuredContent : undefined;
    },
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onTheme: (listener) => {
      themes.add(listener);
      return () => {
        themes.delete(listener);
      };
    },
  };
};

/** No host, as in a Snapshot: nothing is sent and no update or theme comes. */
export const NO_CHANNEL: ViewChannel = {
  send: async () => undefined,
  onUpdate: () => () => {},
  onTheme: () => () => {},
};
