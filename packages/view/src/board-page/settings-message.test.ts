// The board page reads the settings `board-host` sends before the board (settings-languages, task
// 5.1): the message is accepted and, until the board page applies theme, density and placement
// (task 8.2), changes nothing the view is told.

import { describe, expect, test } from "bun:test";
import type { BoardState, HostMessage } from "@askboard/contract";
import { plainChoiceBoardDocument, settingsWithEveryKey } from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewUpdate } from "../view-protocol.ts";
import { runBoardPage } from "./controller.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import type { BoardSocketHandlers } from "./socket.ts";

const version = "1.0";
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = { version, type: "state", state: waiting };

const setUp = () => {
  const sockets: BoardSocketHandlers[] = [];
  const loads: BootData[] = [];
  const updates: ViewUpdate[] = [];
  const logs: string[] = [];
  runBoardPage({
    connect: (events) => {
      sockets.push(events);
      return { send: () => true, close: () => undefined };
    },
    openView: async (data) => {
      loads.push(data);
      return { update: (update) => updates.push(update) };
    },
    schedule: (_ms, run) => {
      queueMicrotask(run);
      return () => undefined;
    },
    showBanner: () => undefined,
    showLoadError: () => undefined,
    setTitle: () => undefined,
    setLanguage: () => undefined,
    log: (text) => logs.push(text),
    copyText: async () => undefined,
  });
  const receive = (...messages: BoardHostMessage[]) => {
    for (const message of messages) sockets[0]?.onMessage(message);
  };
  return { loads, updates, logs, receive };
};

describe("the settings on the board page", () => {
  test("settings before the board are read, and the board opens as without them", async () => {
    const run = setUp();
    run.receive(settingsWithEveryKey, board, state);
    await Bun.sleep(0);
    expect(run.loads).toHaveLength(1);
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
    expect(run.logs).toEqual([]);
  });

  test("settings after the board tell the view nothing yet", async () => {
    const run = setUp();
    run.receive(board, state);
    await Bun.sleep(0);
    run.receive(settingsWithEveryKey);
    expect(run.updates).toEqual([{ type: "state", state: waiting }]);
  });
});
