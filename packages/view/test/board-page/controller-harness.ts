// The board page's controller run against fakes of its socket, its view, its timers and its
// chrome, shared by the controller's tests: the fakes, the timers it runs by hand, and the
// fixtures the tests send.

import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  type BoardState,
  type ContextHostMessage,
  type ContextPageMessage,
  type HostMessage,
  type LifecycleHostMessage,
  type LifecyclePageMessage,
  type SnapshotCommand,
  type SnapshotReply,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { Banner } from "../../src/board-page/board-status.ts";
import { type BoardPageDeps, runBoardPage } from "../../src/board-page/controller.ts";
import type {
  PanelActions,
  PanelRequest,
  ReadingPanel,
} from "../../src/board-page/reading-panel.ts";
import type { BoardSocketHandlers } from "../../src/board-page/socket.ts";
import type { ViewReply } from "../../src/board-page/view-host.ts";
import type { BootData } from "../../src/boot-data.ts";
import type {
  SnapshotFeedback,
  ViewAnswer,
  ViewMessage,
  ViewUpdate,
} from "../../src/view-protocol.ts";

export const version = BOARD_PROTOCOL_VERSION;
export const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
export const answered = (receipt: "sent" | "delivered"): BoardState => ({
  ask: "answered",
  questions: [
    {
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { choice: ["PostgreSQL"], when: "2026-10-30T10:00:00.250Z", receipt },
    },
  ],
});
export const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
export const stateOf = (state: BoardState): HostMessage => ({ version, type: "state", state });
export const answer: ViewAnswer = {
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-30T10:00:00.250Z",
};
// The action IDs the fake draws, in order.
export const ID = (n: number) => `${String(n).padStart(2, "0")}${"a".repeat(20)}`;
export const commandOf = (n: number, acts: ActCommand["acts"] = [answerAct]): ActCommand => ({
  version,
  type: "act",
  actionId: ID(n),
  acts,
});
export const answerAct = {
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: answer.when,
} as const;
export const command = commandOf(1);
export const sent = (n = 1) => ({ outcome: "sent", actionId: ID(n) }) as const;
export const queued = (n = 1) => ({ outcome: "queued", actionId: ID(n) }) as const;
export const done = (n = 1): LifecycleHostMessage => ({ version, type: "done", actionId: ID(n) });

export type FakeSocket = {
  readonly events: BoardSocketHandlers;
  readonly sent: (LifecyclePageMessage | ContextPageMessage | SnapshotCommand)[];
  open: boolean;
  closed: boolean;
  receive(
    ...messages: (HostMessage | LifecycleHostMessage | ContextHostMessage | SnapshotReply)[]
  ): void;
  close(code: number): void;
};

export type Timer = { readonly ms: number; readonly run: () => void; cancelled: boolean };

// A reading panel that records what the controller does to it.
const fakePanel = () => {
  const events: string[] = [];
  let shown: { request: PanelRequest; actions: PanelActions } | undefined;
  const port: ReadingPanel = {
    open: (request, actions) => {
      shown = { request, actions };
      events.push(`open ${request.itemId}`);
    },
    sourceState: (message) => events.push(`state ${message.itemId} ${message.status}`),
    editorOutcome: (message) => events.push(`outcome ${message.itemId} ${message.outcome}`),
    close: () => {
      shown = undefined;
      events.push("close");
    },
    get itemId() {
      return shown?.request.itemId;
    },
  };
  return { port, events, shown: () => shown };
};

export const setUp = (options: { failLoads?: number } = {}) => {
  const sockets: FakeSocket[] = [];
  const timers: Timer[] = [];
  const banners: (Banner | undefined)[] = [];
  const loadErrors: (string | undefined)[] = [];
  const titles: string[] = [];
  const logs: string[] = [];
  const loads: BootData[] = [];
  const updates: ViewUpdate[] = [];
  const copies: string[] = [];
  const opened: string[] = [];
  const panel = fakePanel();
  const bannerSnapshots: SnapshotFeedback[] = [];
  let handle: ((message: ViewMessage) => Promise<ViewReply>) | undefined;
  let failLoads = options.failLoads ?? 0;
  let drawn = 0;
  const deps: BoardPageDeps = {
    connect: (events) => {
      const socket: FakeSocket = {
        events,
        sent: [],
        open: true,
        closed: false,
        receive: (...messages) => {
          for (const message of messages) events.onMessage(message as HostMessage);
        },
        close: (code) => {
          socket.open = false;
          events.onClose(code);
        },
      };
      sockets.push(socket);
      return {
        send: (message) => {
          if (!socket.open) return false;
          socket.sent.push(message);
          return true;
        },
        close: () => {
          socket.closed = true;
        },
      };
    },
    openView: async (data, onMessage) => {
      loads.push(data);
      handle = onMessage;
      if (failLoads > 0) {
        failLoads -= 1;
        throw new Error("/m answered 503");
      }
      return { update: (update) => updates.push(update) };
    },
    schedule: (ms, run) => {
      const timer: Timer = { ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    showBanner: (banner) => banners.push(banner),
    showLoadError: (error) => loadErrors.push(error),
    setTitle: (title) => titles.push(title),
    log: (text) => logs.push(text),
    showSnapshot: (feedback) => bannerSnapshots.push(feedback),
    openLink: (url) => {
      opened.push(url);
    },
    readingPanel: panel.port,
    copyText: async (text) => {
      copies.push(text);
    },
    newActionId: () => {
      drawn += 1;
      return ID(drawn);
    },
  };
  const page = runBoardPage(deps);
  const socket = (n: number): FakeSocket => {
    const found = sockets[n - 1];
    if (found === undefined) throw new Error(`no socket ${n}`);
    return found;
  };
  const view = async (message: ViewMessage): Promise<ViewReply> => {
    if (handle === undefined) throw new Error("the view is not loaded");
    return handle(message);
  };
  // Runs the next pending timer; fails if there is none.
  const tick = (): number => {
    const timer = timers.find((entry) => !entry.cancelled);
    if (timer === undefined) throw new Error("no timer is pending");
    timer.cancelled = true;
    timer.run();
    return timer.ms;
  };
  const pending = () => timers.filter((timer) => !timer.cancelled).map((timer) => timer.ms);
  // Runs the first pending timer of `ms`; fails if there is none.
  const fire = (ms: number): void => {
    const timer = timers.find((entry) => !entry.cancelled && entry.ms === ms);
    if (timer === undefined) throw new Error(`no ${ms} ms timer is pending`);
    timer.cancelled = true;
    timer.run();
  };
  const banner = () => banners.at(-1);
  return {
    page,
    sockets,
    socket,
    view,
    tick,
    fire,
    pending,
    banner,
    banners,
    loadErrors,
    titles,
    logs,
    loads,
    updates,
    copies,
    bannerSnapshots,
    opened,
    panel,
    // What the page sent on a socket, drafts left out.
    acts: (n: number) => socket(n).sent.filter((message) => message.type !== "draft"),
    drafts: (n: number) => socket(n).sent.filter((message) => message.type === "draft"),
  };
};

// Lets the view's load settle.
export const settled = () => Bun.sleep(0);

// A board opened on socket 1, its view loaded and its question visible.
export const opened = async (options?: { failLoads?: number }) => {
  const run = setUp(options);
  run.socket(1).receive(board, stateOf(waiting));
  await settled();
  await run.view({ type: "ready", itemId: "database" });
  return run;
};
