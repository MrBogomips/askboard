// The board page reads the settings `board-host` sends before the board (settings-languages, tasks
// 5.1 and 8.2): the board opens with the presentation they give, in the boot data, and a later
// message reaches the page's own root and the view at once.

import { describe, expect, test } from "bun:test";
import type { BoardState, HostMessage } from "@askboard/contract";
import {
  keyOverridesExample,
  plainChoiceBoardDocument,
  settingsKeysIgnored,
  settingsKeysNotApplied,
  settingsWithEveryKey,
  settingsWithKeys,
} from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewPresentation, ViewUpdate } from "../view-protocol.ts";
import { runBoardPage } from "./controller.ts";
import { type BoardHostMessage, readHostMessage } from "./host-messages.ts";
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
    showSnapshot: () => undefined,
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

// The user's keys (keyboard-shortcuts-help, task 10.1): the view gets the overrides of a row from the
// user file that passed the check, in its updates and never in its boot data.
describe("the user's keys on the board page", () => {
  test("a user row's overrides reach the view with its updates, and its boot data holds none", async () => {
    const run = setUp();
    run.receive(settingsWithKeys, board, state);
    await Bun.sleep(0);
    expect(run.loads[0]).toBeDefined();
    expect(Object.keys(run.loads[0] ?? {})).not.toContain("keys");
    run.receive(settingsWithKeys);
    expect(run.updates.at(-1)?.keys).toEqual(keyOverridesExample);
  });

  test("none when the keys were not applied or the project's were ignored", async () => {
    for (const message of [settingsKeysNotApplied, settingsKeysIgnored]) {
      const run = setUp();
      run.receive(board, state);
      await Bun.sleep(0);
      run.receive(message);
      expect(run.updates.at(-1)).toBeDefined();
      expect(Object.hasOwn(run.updates.at(-1) ?? {}, "keys")).toBe(false);
    }
  });

  test("a row from the user whose value the check refuses passes none on", async () => {
    const run = setUp();
    run.receive(board, state);
    await Bun.sleep(0);
    const refused = {
      ...settingsWithKeys,
      keys: {
        ...settingsWithKeys.keys,
        keys: { from: "user", writable: false, value: { "move.top": ["Alt+Shift+ArrowUp"] } },
      },
    } as BoardHostMessage;
    run.receive(refused);
    expect(Object.hasOwn(run.updates.at(-1) ?? {}, "keys")).toBe(false);
  });

  test("a row the schema refuses drops the message, as any invalid one: with other, or a default with a value", () => {
    const row = (value: unknown) =>
      readHostMessage(
        JSON.stringify({
          ...settingsWithKeys,
          keys: { ...settingsWithKeys.keys, keys: value },
        }),
      );
    expect(row({ from: "user", writable: false, value: keyOverridesExample }).ok).toBe(true);
    const withOther = row({
      from: "user",
      writable: false,
      value: keyOverridesExample,
      other: { file: "project", value: keyOverridesExample },
    });
    expect(withOther.ok).toBe(false);
    expect(row({ from: "default", writable: false, value: keyOverridesExample }).ok).toBe(false);
    expect(row({ from: "project", writable: false, value: keyOverridesExample }).ok).toBe(false);
  });
});
