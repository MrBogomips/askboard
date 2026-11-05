// What the board page does with the view's presentation messages (settings-languages, task 8.3):
// a toggle's value applies at once, on the page and in the view, and goes to `board-host` as a
// `setting` command; a key the project sets is refused; a write that failed or was refused keeps
// the value on this board; "Settings" asks the page to open its panel.

import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  type BoardState,
  type HostMessage,
  type SettingsMessage,
} from "@askboard/contract";
import { plainChoiceBoardDocument, settingsWithEveryKey } from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import type { ViewMessage, ViewPresentation, ViewUpdate } from "../view-protocol.ts";
import { runBoardPage } from "./controller.ts";
import type { BoardHostMessage } from "./host-messages.ts";
import type { BoardSocketHandlers } from "./socket.ts";
import type { ViewReply } from "./view-host.ts";

const version = BOARD_PROTOCOL_VERSION;
const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const board: HostMessage = { version, type: "board", document: plainChoiceBoardDocument };
const state: HostMessage = { version, type: "state", state: waiting };

const setUp = async () => {
  const sockets: BoardSocketHandlers[] = [];
  const sent: unknown[] = [];
  const updates: ViewUpdate[] = [];
  const applied: ViewPresentation[] = [];
  const opened: string[] = [];
  const handles: ((message: ViewMessage) => Promise<ViewReply>)[] = [];
  runBoardPage({
    connect: (events) => {
      sockets.push(events);
      return {
        send: (message) => {
          sent.push(message);
          return true;
        },
        close: () => undefined,
      };
    },
    openView: async (_data: BootData, handle) => {
      handles.push(handle);
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
    openSettings: () => opened.push("settings"),
    log: () => undefined,
    copyText: async () => undefined,
  });
  const receive = (...messages: BoardHostMessage[]) => {
    for (const message of messages) sockets[0]?.onMessage(message);
  };
  receive(settingsWithEveryKey, board, state);
  await Bun.sleep(0);
  const view = (message: ViewMessage) => {
    const handle = handles[0];
    if (handle === undefined) throw new Error("the view did not open");
    return handle(message);
  };
  return { sockets, sent, updates, applied, opened, receive, view };
};

describe("a toggle's value from the view", () => {
  test("applies at once on the page and in the view and goes to board-host as a command", async () => {
    const run = await setUp();
    const reply = await run.view({ type: "setting", key: "density", value: "comfortable" });
    expect(reply).toEqual({ outcome: "sent" });
    expect(run.sent).toContainEqual({
      version,
      type: "setting",
      key: "density",
      value: "comfortable",
    });
    expect(run.applied.at(-1)).toEqual({
      theme: "dark",
      density: "comfortable",
      contextPlacement: "inline",
      locked: ["contextPlacement"],
    });
    expect(run.updates.at(-1)?.presentation?.density).toBe("comfortable");
  });

  test("a key the project sets is refused, and nothing is sent or applied", async () => {
    const run = await setUp();
    const applied = run.applied.length;
    const reply = await run.view({ type: "setting", key: "contextPlacement", value: "beside" });
    expect(reply.outcome).toBe("refused");
    expect(run.sent.filter((message) => (message as { type: string }).type === "setting")).toEqual(
      [],
    );
    expect(run.applied).toHaveLength(applied);
  });

  test("a write that failed keeps the value on this board; a saved one agrees with it", async () => {
    const run = await setUp();
    await run.view({ type: "setting", key: "density", value: "comfortable" });
    const failed: SettingsMessage = {
      ...settingsWithEveryKey,
      write: { key: "density", outcome: "failed", reason: "EACCES", path: "/home/u/config.json" },
    };
    run.receive(failed);
    expect(run.applied.at(-1)?.density).toBe("comfortable");
    expect(run.updates.at(-1)?.presentation?.density).toBe("comfortable");
    const saved: SettingsMessage = {
      ...settingsWithEveryKey,
      keys: {
        ...settingsWithEveryKey.keys,
        density: { value: "comfortable", from: "user", writable: true },
      },
      write: { key: "density", outcome: "saved" },
    };
    run.receive(saved);
    expect(run.applied.at(-1)?.density).toBe("comfortable");
  });

  test("a later settings message with no write takes the file's values again", async () => {
    const run = await setUp();
    await run.view({ type: "setting", key: "density", value: "comfortable" });
    run.receive(settingsWithEveryKey);
    expect(run.applied.at(-1)?.density).toBe("compact");
  });
});

describe("Settings from the view", () => {
  test("asks the page to open its panel and replies", async () => {
    const run = await setUp();
    expect(await run.view({ type: "open-settings" })).toEqual({});
    expect(run.opened).toEqual(["settings"]);
  });
});
