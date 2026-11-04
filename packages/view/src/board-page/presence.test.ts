// The board page's presence messages (design decision 10; view spec, "The board's working signal"):
// sent on a socket once its connect is accepted, with the signal's current flag, then on each
// change while the socket is open; and the view's activity message, which the controller passes
// to the signal as an input.

import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  type ContextPageMessage,
  type HostMessage,
  type LifecyclePageMessage,
  type PresenceMessage,
  type SnapshotCommand,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewMessage } from "../view-protocol.ts";
import { runBoardPage } from "./controller.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import { presenceMessage, withPresence } from "./presence.ts";
import type { BoardSocketHandlers, PageConnection } from "./socket.ts";
import type { ViewReply } from "./view-host.ts";

const version = "1.0";
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = {
  version,
  type: "state",
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
};
const refusedToken: HostMessage = {
  version,
  type: "refused",
  reason: "token",
  detail: "the token does not open a board of this session",
};

// A signal the test sets by hand.
const fakeSignal = (initial: boolean) => {
  let working = initial;
  const listeners = new Set<(working: boolean) => void>();
  return {
    working: () => working,
    subscribe: (listener: (working: boolean) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next: boolean) => {
      working = next;
      for (const listener of listeners) listener(next);
    },
    listeners,
  };
};

// One socket: what was sent on it, and the handlers the page gave it.
const fakeConnect = () => {
  const sent: (
    | LifecyclePageMessage
    | ContextPageMessage
    | SnapshotCommand
    | PresenceMessage
  )[] = [];
  let handlers: BoardSocketHandlers | undefined;
  let open = true;
  const connect = (events: BoardSocketHandlers): PageConnection => {
    handlers = events;
    return {
      send: (message) => {
        if (!open) return false;
        sent.push(message);
        return true;
      },
      close: () => undefined,
    };
  };
  const host = () => {
    if (handlers === undefined) throw new Error("not connected");
    return handlers;
  };
  const close = (code: number) => {
    open = false;
    host().onClose(code);
  };
  return { connect, sent, host, close };
};

const heard = () => {
  const messages: BoardHostMessage[] = [];
  const closes: number[] = [];
  const invalid: unknown[] = [];
  const events: BoardSocketHandlers = {
    onMessage: (message) => messages.push(message),
    onInvalid: (problems) => invalid.push(problems),
    onClose: (code) => closes.push(code),
  };
  return { events, messages, closes, invalid };
};

describe("presence on the board's socket", () => {
  test("is the contract's message: the flag and nothing else", () => {
    expect(presenceMessage(true)).toEqual({
      version: BOARD_PROTOCOL_VERSION,
      type: "presence",
      working: true,
    });
  });

  test("goes once the board is accepted, with the current flag, before the board is handled", () => {
    const signal = fakeSignal(true);
    const socket = fakeConnect();
    const page = heard();
    const order: string[] = [];
    withPresence(
      socket.connect,
      signal,
    )({
      ...page.events,
      onMessage: (message) => {
        order.push(`heard ${message.type} after ${socket.sent.length} sent`);
        page.events.onMessage(message);
      },
    });
    expect(socket.sent).toEqual([]);
    socket.host().onMessage(board);
    socket.host().onMessage(state);
    expect(socket.sent).toEqual([presenceMessage(true)]);
    expect(order).toEqual(["heard board after 1 sent", "heard state after 1 sent"]);
  });

  test("goes on each change while the socket is open, and not after it closes", () => {
    const signal = fakeSignal(false);
    const socket = fakeConnect();
    const page = heard();
    withPresence(socket.connect, signal)(page.events);
    socket.host().onMessage(board);
    signal.set(true);
    signal.set(false);
    socket.close(1006);
    signal.set(true);
    expect(socket.sent).toEqual([
      presenceMessage(false),
      presenceMessage(true),
      presenceMessage(false),
    ]);
    expect(page.closes).toEqual([1006]);
    expect(signal.listeners.size).toBe(0);
  });

  test("never goes on a socket whose connect is refused", () => {
    const signal = fakeSignal(true);
    const socket = fakeConnect();
    const page = heard();
    withPresence(socket.connect, signal)(page.events);
    socket.host().onMessage(refusedToken);
    signal.set(false);
    socket.close(4403);
    expect(socket.sent).toEqual([]);
    expect(page.messages).toEqual([refusedToken]);
    expect(signal.listeners.size).toBe(0);
  });

  test("goes once per socket, and what the protocol refuses still reaches the page", () => {
    const signal = fakeSignal(true);
    const socket = fakeConnect();
    const page = heard();
    withPresence(socket.connect, signal)(page.events);
    socket.host().onMessage(board);
    socket.host().onMessage(board);
    socket.host().onInvalid([{ path: "/", message: "x" }]);
    expect(socket.sent).toEqual([presenceMessage(true)]);
    expect(page.invalid).toHaveLength(1);
    expect(signal.listeners.size).toBe(1);
  });
});

describe("the view's activity message", () => {
  const boardPage = (onActivity?: () => void) => {
    let handle: ((message: ViewMessage) => Promise<ViewReply>) | undefined;
    const socket = fakeConnect();
    runBoardPage({
      connect: socket.connect,
      openView: async (_data, onMessage) => {
        handle = onMessage;
        return { update: () => undefined };
      },
      schedule: () => () => undefined,
      showBanner: () => undefined,
      showLoadError: () => undefined,
      showSnapshot: () => undefined,
      setTitle: () => undefined,
      log: () => undefined,
      copyText: async () => undefined,
      ...(onActivity === undefined ? {} : { onActivity }),
    });
    socket.host().onMessage(board);
    socket.host().onMessage(state);
    return async (message: ViewMessage) => {
      await Bun.sleep(0);
      if (handle === undefined) throw new Error("the view is not loaded");
      return handle(message);
    };
  };

  test("is an input for the working signal, answered with an empty reply", async () => {
    const inputs: number[] = [];
    const view = boardPage(() => inputs.push(1));
    expect(await view({ type: "activity" })).toEqual({});
    expect(await view({ type: "activity" })).toEqual({});
    expect(inputs).toEqual([1, 1]);
  });

  test("changes nothing on a board page without the signal", async () => {
    const view = boardPage();
    expect(await view({ type: "activity" })).toEqual({});
  });
});
