// The board page reads the settings `board-host` sends before the board (settings-languages, tasks
// 5.1 and 8.2): the board opens with the presentation they give, in the boot data, and a later
// message reaches the page's own root and the view at once.

import { describe, expect, test } from "bun:test";
import type { BoardState, HostMessage } from "@askboard/contract";
import { plainChoiceBoardDocument, settingsWithEveryKey } from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewPresentation, ViewUpdate } from "../view-protocol.ts";
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
  const applied: ViewPresentation[] = [];
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
    applyPresentation: (presentation) => applied.push(presentation),
    log: (text) => logs.push(text),
    copyText: async () => undefined,
  });
  const receive = (...messages: BoardHostMessage[]) => {
    for (const message of messages) sockets[0]?.onMessage(message);
  };
  return { loads, updates, logs, applied, receive };
};

const dark: ViewPresentation = {
  theme: "dark",
  density: "compact",
  contextPlacement: "inline",
  locked: ["contextPlacement"],
};

describe("the settings on the board page", () => {
  test("settings before the board are applied and open the board with the presentation", async () => {
    const run = setUp();
    run.receive(settingsWithEveryKey, board, state);
    await Bun.sleep(0);
    expect(run.applied).toEqual([dark]);
    expect(run.loads).toHaveLength(1);
    expect(run.loads[0]?.presentation).toEqual(dark);
    expect(run.logs).toEqual([]);
  });

  test("settings after the board reach the page and the view at once", async () => {
    const run = setUp();
    run.receive(board, state);
    await Bun.sleep(0);
    run.receive(settingsWithEveryKey);
    expect(run.applied).toEqual([dark]);
    expect(run.updates.at(-1)).toEqual({ type: "state", state: waiting, presentation: dark });
  });
});
