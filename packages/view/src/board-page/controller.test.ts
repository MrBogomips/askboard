// The board page's controller against fakes of its socket, its view, its timers and its chrome:
// what design decision 8 and AD-21 ask of it, without a browser.

import { describe, expect, test } from "bun:test";
import {
  type AnswerCommand,
  BOARD_CLOSE_CODES,
  type BoardState,
  type HostMessage,
  type PageMessage,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewAnswer, ViewMessage, ViewUpdate } from "../view-protocol.ts";
import type { Banner } from "./board-status.ts";
import { type BoardPageDeps, runBoardPage } from "./controller.ts";
import type { BoardSocketHandlers } from "./socket.ts";
import type { ViewReply } from "./view-host.ts";

const version = "1.0";
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const answered = (receipt: "sent" | "delivered"): BoardState => ({
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
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const stateOf = (state: BoardState): HostMessage => ({ version, type: "state", state });
const answer: ViewAnswer = {
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-30T10:00:00.250Z",
};
const command: AnswerCommand = {
  version,
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: answer.when,
};

type FakeSocket = {
  readonly events: BoardSocketHandlers;
  readonly sent: PageMessage[];
  open: boolean;
  closed: boolean;
  receive(...messages: HostMessage[]): void;
  close(code: number): void;
};

type Timer = { readonly ms: number; readonly run: () => void; cancelled: boolean };

const setUp = (options: { failLoads?: number } = {}) => {
  const sockets: FakeSocket[] = [];
  const timers: Timer[] = [];
  const banners: (Banner | undefined)[] = [];
  const loadErrors: (string | undefined)[] = [];
  const titles: string[] = [];
  const logs: string[] = [];
  const loads: BootData[] = [];
  const updates: ViewUpdate[] = [];
  let handle: ((message: ViewMessage) => Promise<ViewReply>) | undefined;
  let failLoads = options.failLoads ?? 0;
  const deps: BoardPageDeps = {
    connect: (events) => {
      const socket: FakeSocket = {
        events,
        sent: [],
        open: true,
        closed: false,
        receive: (...messages) => {
          for (const message of messages) events.onMessage(message);
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
  const banner = () => banners.at(-1);
  return {
    page,
    sockets,
    socket,
    view,
    tick,
    pending,
    banner,
    banners,
    loadErrors,
    titles,
    logs,
    loads,
    updates,
  };
};

// Lets the view's load settle.
const settled = () => Bun.sleep(0);

// A board opened on socket 1, its view loaded and its question visible.
const opened = async (options?: { failLoads?: number }) => {
  const run = setUp(options);
  run.socket(1).receive(board, stateOf(waiting));
  await settled();
  await run.view({ type: "ready", itemId: "database" });
  return run;
};

describe("the board page opens its board (design decision 8)", () => {
  test("opens one socket at once and loads the view with the board document and the state", async () => {
    const run = setUp();
    expect(run.sockets).toHaveLength(1);
    run.socket(1).receive(board);
    expect(run.titles).toEqual(["Which database should the order service use? · AskBoard"]);
    expect(run.loads).toEqual([]);
    run.socket(1).receive(stateOf(waiting));
    await settled();
    expect(run.loads).toEqual([{ document: plainChoiceBoardDocument, state: waiting }]);
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
    expect(run.banner()).toBeUndefined();
    expect(run.loadErrors).toEqual([undefined]);
  });

  test("each later state, and a receipt, reach the view (FR-22)", async () => {
    const run = await opened();
    run.socket(1).receive(stateOf(answered("sent")));
    run.socket(1).receive({ version, type: "receipt", itemId: "database", receipt: "delivered" });
    expect(run.updates.slice(-2)).toEqual([
      { type: "state", state: answered("sent") },
      { type: "state", state: answered("delivered") },
    ]);
    expect(run.loads).toHaveLength(1);
  });

  test("a message the protocol refuses, or a state that is not the board's, is never acted on", async () => {
    const run = await opened();
    run.socket(1).events.onInvalid([{ path: "/type", message: "no" }]);
    const other: BoardState = {
      ask: "waiting",
      questions: [{ itemId: "cache", rev: 1, state: "open" }],
    };
    run.socket(1).receive(stateOf(other));
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
    expect(run.logs).toEqual([
      "board-host sent a message the board protocol refuses",
      'board-host sent a state the board page cannot act on: the state names "cache", which the board document does not hold at revision 1',
    ]);
  });

  test("the view's ready and item-error messages are recorded, an item error logged", async () => {
    const run = await opened();
    expect(await run.view({ type: "item-error", itemId: "database", error: "boom" })).toEqual({});
    expect(run.logs).toEqual(['the item "database" failed in the view: boom']);
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the question's item failed in the view",
    });
  });

  test("a view that fails to load is shown, and loads again on the next socket", async () => {
    const run = await opened({ failLoads: 1 });
    expect(run.loadErrors).toEqual(["The board could not be loaded: /m answered 503"]);
    expect(run.logs).toEqual(["the view did not load"]);
    run.socket(1).receive(stateOf(waiting));
    await settled();
    expect(run.loads).toHaveLength(1);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    await settled();
    expect(run.loads).toHaveLength(2);
    expect(run.loadErrors).toEqual(["The board could not be loaded: /m answered 503", undefined]);
  });
});

describe("answers (FR-22, AD-10)", () => {
  test("an answer while connected goes at once as the transcript's command", async () => {
    const run = await opened();
    expect(await run.view(answer)).toEqual({ outcome: "sent" });
    expect(run.socket(1).sent).toEqual([command]);
  });

  test("an answer the board page cannot send is refused, saying why, and nothing goes", async () => {
    const run = setUp();
    run.socket(1).receive(board, stateOf(waiting));
    await settled();
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the question never counted as visible",
    });
    expect(run.socket(1).sent).toEqual([]);
  });

  test("while disconnected an answer is queued, then sent once the new socket's state shows it open", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    expect(await run.view(answer)).toEqual({ outcome: "queued" });
    run.tick();
    run.socket(2).receive(board);
    expect(run.socket(2).sent).toEqual([]);
    run.socket(2).receive(stateOf(waiting));
    expect(run.socket(2).sent).toEqual([command]);
    run.socket(2).receive(stateOf(waiting));
    expect(run.socket(2).sent).toEqual([command]);
    run.socket(2).receive(stateOf(answered("sent")));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: answered("sent") });
  });

  test("an answer sent on a socket that dropped before its state showed it goes again on the next", async () => {
    const run = await opened();
    await run.view(answer);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.socket(2).sent).toEqual([command]);
  });

  test("a queued answer whose question the new state shows answered is not sent", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive(board, stateOf(answered("delivered")));
    expect(run.socket(2).sent).toEqual([]);
    run.socket(2).close(1006);
    run.tick();
    run.socket(3).receive(board, stateOf(waiting));
    expect(run.socket(3).sent).toEqual([]);
  });

  test("a held answer the board page would refuse by the time it reconnects is dropped, saying why", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    await run.view({ type: "item-error", itemId: "database", error: "boom" });
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.socket(2).sent).toEqual([]);
    expect(run.logs.at(-1)).toBe(
      'the answer to "database" was not sent: the question\'s item failed in the view',
    );
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting });
  });

  test("an answer board-host refuses is not held any more", async () => {
    const run = await opened();
    await run.view(answer);
    run.socket(1).receive({
      version,
      type: "refused",
      reason: "answer",
      itemId: "database",
      detail: "the question is already answered",
    });
    expect(run.logs).toEqual([
      'board-host refused the answer to "database": the question is already answered',
    ]);
    run.socket(1).close(1006);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.socket(2).sent).toEqual([]);
  });

  test("an answer the socket would not take is queued", async () => {
    const run = await opened();
    run.socket(1).open = false;
    expect(await run.view(answer)).toEqual({ outcome: "queued" });
  });

  test("no answer on a moved or discarded board", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "moved" });
    expect(await run.view(answer)).toEqual({
      outcome: "refused",
      detail: "the board moved to another tab",
    });
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    expect(await run.view(answer)).toEqual({ outcome: "refused", detail: "the ask was discarded" });
    expect(run.socket(1).sent).toEqual([]);
  });
});

describe("the answers the view hears the board page holds (M3)", () => {
  const held = (outcome: "sent" | "queued") => ({
    itemId: "database",
    choice: ["PostgreSQL"],
    when: answer.when,
    outcome,
  });

  test("an answer shows as held before its reply, sent or queued", async () => {
    const run = await opened();
    const reply = run.view(answer);
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, pending: [held("sent")] });
    expect(await reply).toEqual({ outcome: "sent" });
    run.socket(1).close(1006);
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, pending: [held("sent")] });
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, pending: [held("sent")] });
    run.socket(2).receive(stateOf(answered("sent")));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: answered("sent") });
  });

  test("a queued answer shows as queued, then sent on the new socket", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    expect(run.updates.at(-1)?.pending).toEqual([held("queued")]);
    run.tick();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)?.pending).toEqual([held("sent")]);
  });

  test("an answer board-host refuses is no longer held, so the view can answer again", async () => {
    const run = await opened();
    await run.view(answer);
    run.socket(1).receive({
      version,
      type: "refused",
      reason: "answer",
      itemId: "database",
      detail: "the question is already answered",
    });
    run.socket(1).receive(stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting });
    expect(await run.view(answer)).toEqual({ outcome: "sent" });
  });

  test("a discard drops what was held", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive({ version, type: "refused", reason: "token", detail: "no" });
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, lock: "discarded" });
  });
});

describe("the connection (design decision 5, AD-21)", () => {
  for (const code of [1006, 1013]) {
    test(`a close with ${code} shows Connection lost, retrying, and reconnects with backoff`, async () => {
      const run = await opened();
      run.socket(1).close(code);
      expect(run.banner()?.variant).toBe("connection-lost");
      expect(run.pending()).toEqual([250]);
      run.tick();
      expect(run.sockets).toHaveLength(2);
      run.socket(2).close(1006);
      expect(run.pending()).toEqual([500]);
      run.tick();
      run.socket(3).receive(board);
      expect(run.banner()?.variant).toBe("connection-lost");
      run.socket(3).receive(stateOf(answered("sent")));
      expect(run.banner()).toBeUndefined();
      expect(run.updates.at(-1)).toEqual({ type: "state", state: answered("sent") });
      run.socket(3).close(1006);
      expect(run.pending()).toEqual([250]);
    });
  }

  test("after 4403, 4409 or 4410 it does not reconnect on its own", async () => {
    for (const code of Object.values(BOARD_CLOSE_CODES)) {
      const run = await opened();
      run.socket(1).close(code);
      expect(run.pending()).toEqual([]);
      expect(run.sockets).toHaveLength(1);
    }
  });

  test("the session ends: Discarded takes the focus and locks the view", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    run.socket(1).close(BOARD_CLOSE_CODES.discarded);
    expect(run.banner()).toMatchObject({ variant: "discarded", takesFocus: true });
    expect(run.banner()?.detail).toBeUndefined();
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, lock: "discarded" });
    expect(run.banners.filter((banner) => banner?.variant === "discarded")).toHaveLength(1);
  });

  test("a token refused on reconnect discards the board; a queued answer was not sent", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    await run.view(answer);
    run.tick();
    run.socket(2).receive({
      version,
      type: "refused",
      reason: "token",
      detail: "the token does not open a board of this session",
    });
    expect(run.banner()).toEqual({
      variant: "discarded",
      text: "This ask was discarded. The board is read-only.",
      detail: "Your unsent work was not sent",
      takesFocus: true,
    });
    run.socket(2).close(BOARD_CLOSE_CODES.refused);
    expect(run.pending()).toEqual([]);
    expect(run.socket(2).sent).toEqual([]);
  });

  test("other refusals are only logged", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "refused", reason: "message", detail: "no draft" });
    expect(run.logs).toEqual(["board-host refused a message: no draft"]);
    expect(run.banner()).toBeUndefined();
  });

  test("moved locks the view; Continue here reconnects, which takes the board back", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "moved" });
    run.socket(1).close(BOARD_CLOSE_CODES.moved);
    expect(run.banner()).toMatchObject({ variant: "moved", action: "Continue here" });
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, lock: "moved" });
    expect(run.pending()).toEqual([]);
    run.page.continueHere();
    expect(run.sockets).toHaveLength(2);
    expect(run.banner()).toBeUndefined();
    run.socket(2).receive(board, stateOf(waiting));
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting });
    run.page.continueHere();
    expect(run.sockets).toHaveLength(2);
  });

  test("Continue here before the close arrives closes the old socket, whose events are then ignored", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "moved" });
    run.page.continueHere();
    expect(run.socket(1).closed).toBe(true);
    run.socket(1).close(BOARD_CLOSE_CODES.moved);
    run.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    run.socket(1).events.onInvalid([]);
    expect(run.banner()).toBeUndefined();
    expect(run.logs).toEqual([]);
    run.socket(2).receive(board, stateOf(waiting));
    expect(await run.view(answer)).toEqual({ outcome: "sent" });
  });

  test("a page going away stops reconnecting; coming back reconnects", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    run.page.suspend();
    expect(run.pending()).toEqual([]);
    run.page.resume();
    expect(run.sockets).toHaveLength(2);
    run.page.suspend();
    run.socket(2).close(1001);
    expect(run.pending()).toEqual([]);
    run.page.resume();
    expect(run.sockets).toHaveLength(3);
    run.page.resume();
    expect(run.sockets).toHaveLength(3);
  });
});
