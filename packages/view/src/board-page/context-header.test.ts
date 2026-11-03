// The board page keeps who asked and where and the agent status (task 8.4, design decision 12): it
// passes them to the view in the `askboard-data` block when it has them at boot, and in the view's
// updates afterwards, as it does the state. A message the board protocol refuses is never acted on.

import { describe, expect, test } from "bun:test";
import type { BoardState, HostMessage } from "@askboard/contract";
import {
  plainChoiceBoardDocument,
  subagentOrigin,
  uncheckedOrigin,
  waitingAgentStatus,
} from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewUpdate } from "../view-protocol.ts";
import { type BoardPageDeps, runBoardPage } from "./controller.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import type { BoardSocketHandlers } from "./socket.ts";

const version = "1.0";
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = { version, type: "state", state: waiting };
const working = { ...waitingAgentStatus, status: "working" } as const;

const { version: _v, type: _t, ...subagentHeader } = subagentOrigin;
const { version: _v2, type: _t2, ...uncheckedHeader } = uncheckedOrigin;

const setUp = (options: { readonly failLoads?: number } = {}) => {
  const sockets: BoardSocketHandlers[] = [];
  const loads: BootData[] = [];
  const updates: ViewUpdate[] = [];
  const logs: string[] = [];
  let failLoads = options.failLoads ?? 0;
  const deps: BoardPageDeps = {
    connect: (events) => {
      sockets.push(events);
      return { send: () => true, close: () => undefined };
    },
    openView: async (data) => {
      loads.push(data);
      if (failLoads > 0) {
        failLoads -= 1;
        throw new Error("/m answered 503");
      }
      return { update: (update) => updates.push(update) };
    },
    schedule: (_ms, run) => {
      queueMicrotask(run);
      return () => undefined;
    },
    showBanner: () => undefined,
    showLoadError: () => undefined,
    setTitle: () => undefined,
    log: (text) => logs.push(text),
    copyText: async () => undefined,
  };
  runBoardPage(deps);
  const receive = (n: number, ...messages: BoardHostMessage[]) => {
    for (const message of messages) sockets[n - 1]?.onMessage(message);
  };
  return { sockets, loads, updates, logs, receive };
};

const settled = () => Bun.sleep(0);

describe("who asked and where, and the agent status, on the board page", () => {
  test("after the state, each reaches the view as an update, the state with it", async () => {
    const run = setUp();
    run.receive(1, board, state);
    await settled();
    run.receive(1, subagentOrigin, waitingAgentStatus);
    expect(run.updates).toEqual([
      { type: "state", state: waiting },
      { type: "state", state: waiting, origin: subagentHeader },
      { type: "state", state: waiting, origin: subagentHeader, agent: "waiting" },
    ]);
  });

  test("each change of the agent status reaches the view at once", async () => {
    const run = setUp();
    run.receive(1, board, state, uncheckedOrigin, working);
    await settled();
    run.receive(1, waitingAgentStatus);
    run.receive(1, working);
    expect(run.updates.map((update) => update.agent)).toEqual(["working", "waiting", "working"]);
  });

  test("the boot block carries them when the board page has them as the view loads", async () => {
    const run = setUp({ failLoads: 1 });
    run.receive(1, board, state, uncheckedOrigin, working);
    await settled();
    expect(run.loads).toEqual([{ document: plainChoiceBoardDocument, state: waiting }]);
    // The view loads again on the next socket, which the board page opens after a drop.
    run.sockets[0]?.onClose(1006);
    await settled();
    run.receive(2, board, state);
    await settled();
    expect(run.loads[1]).toEqual({
      document: plainChoiceBoardDocument,
      state: waiting,
      origin: uncheckedHeader,
      agent: "working",
    });
  });

  test("they are kept across a reconnect, until the new socket's own arrive", async () => {
    const run = setUp();
    run.receive(1, board, state, subagentOrigin, waitingAgentStatus);
    await settled();
    run.sockets[0]?.onClose(1006);
    await settled();
    run.receive(2, board, state);
    expect(run.updates.at(-1)).toMatchObject({ origin: subagentHeader, agent: "waiting" });
    run.receive(2, uncheckedOrigin, working);
    expect(run.updates.at(-1)).toMatchObject({ origin: uncheckedHeader, agent: "working" });
  });

  test("a message the board protocol refuses is only reported, and the view hears nothing", async () => {
    const run = setUp();
    run.receive(1, board, state);
    await settled();
    run.sockets[0]?.onInvalid([
      { path: "/status", message: "must be equal to one of the allowed values" },
    ]);
    expect(run.updates).toHaveLength(1);
    expect(run.logs).toEqual(["board-host sent a message the board protocol refuses"]);
  });
});
