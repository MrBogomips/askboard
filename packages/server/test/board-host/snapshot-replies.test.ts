import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { validateBoardMessage } from "@askboard/contract/validate";
import { BoardSetupError, type SnapshotOutcome } from "@askboard/core";
import { createBoardHost } from "../../src/board-host/index.ts";
import { type FakeHostCore, fakeHostCore, plainView, SNAPSHOT_PATH } from "./fake-core.ts";
import { type BoardSocket, freeRange, openSocket, removeViews, writeView } from "./helpers.ts";

// Board-host spec, A Snapshot requested by the board, A board's Snapshot that fails and Unsent work
// passed on as a fact (snapshot task 6.1, design decision 8), against a fake core: the request goes
// to ask-core as the user's with its unsent-work flag as it came, each outcome gets its reply naming
// the request, a discard meanwhile is answered before the discard, and only the live board's
// request is taken.

const version = BOARD_PROTOCOL_VERSION;
const askId = plainView.askId;
const token = "snapshot-replies-token";
const FIRST = "aB3dE5fG7hJ9kL1mN3pQ5r";
const SECOND = "sT7uV9wX1yZ3aB5cD7eF9g";
const FOLDER = "/Users/paola/src/order-service/.askboard/snapshots";
const LAST_DRAFT = {
  delivery: "immediate",
  inView: "database",
  questions: { database: { rev: 1, note: "typed before the takeover" } },
} as const;

afterAll(removeViews);

const request = (requestId: string, unsentWork = false) => ({
  version,
  type: "snapshot",
  requestId,
  ...(unsentWork ? { unsentWork: true } : {}),
});

const saved = (requestId: string) => ({
  version,
  type: "snapshot-saved",
  requestId,
  path: SNAPSHOT_PATH,
});

const failed = (requestId: string, reason: string, folder?: string) => ({
  version,
  type: "snapshot-failed",
  requestId,
  reason,
  ...(folder === undefined ? {} : { folder }),
});

/** An outcome the test settles by hand. */
const held = () => {
  let settle: (outcome: SnapshotOutcome) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const outcome = new Promise<SnapshotOutcome>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { outcome, settle, fail };
};

const hostOf = async (fake: FakeHostCore, takeoverFlushMs = 2_000) => {
  const reported: unknown[] = [];
  const host = createBoardHost({
    core: () => fake.core,
    view: writeView(),
    report: (error) => reported.push(error),
    ports: await freeRange(1),
    token: () => token,
    limits: { takeoverFlushMs },
  });
  const link = new URL(await host.address.link(askId));
  const open = async (): Promise<BoardSocket> => {
    const socket = await openSocket(Number(link.port), askId);
    socket.send({ version, type: "connect", token });
    return socket;
  };
  const opened = async (): Promise<BoardSocket> => {
    const socket = await open();
    await socket.next();
    await socket.next();
    return socket;
  };
  return { host, open, opened, reported };
};

const snapshotCalls = (fake: FakeHostCore) => fake.calls.filter(([kind]) => kind === "snapshot");

// The board's messages sent after a moment, which must be none.
const quiet = async (socket: BoardSocket) => {
  await Bun.sleep(50);
  expect(socket.pending).toEqual([]);
};

describe("a board's Snapshot request", () => {
  test("is taken as the user's, with no unsent work, and answered with the path; nothing else follows", async () => {
    const fake = fakeHostCore();
    const { host, opened, reported } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      const reply = await board.next();
      expect(reply).toEqual(saved(FIRST));
      expect(validateBoardMessage("toPage", reply).ok).toBe(true);
      expect(snapshotCalls(fake)).toEqual([
        ["snapshot", askId, { takenBy: "user", unsentWork: false }],
      ]);
      await quiet(board);
      expect(reported).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("passes the unsent-work flag on as it came, consulting no draft record", async () => {
    const fake = fakeHostCore({ draft: LAST_DRAFT });
    const { host, opened } = await hostOf(fake);
    try {
      const board = await opened();
      await board.next();
      board.send(request(FIRST, true));
      expect(await board.next()).toEqual(saved(FIRST));
      board.send(request(SECOND));
      expect(await board.next()).toEqual(saved(SECOND));
      expect(snapshotCalls(fake)).toEqual([
        ["snapshot", askId, { takenBy: "user", unsentWork: true }],
        ["snapshot", askId, { takenBy: "user", unsentWork: false }],
      ]);
    } finally {
      await host.close();
    }
  });

  test.each([
    [
      "a write failure names the folder",
      { outcome: "write-failed", folder: FOLDER, code: "EACCES" },
      failed(FIRST, "write-failed", FOLDER),
    ],
    [
      "no project root names no folder",
      { outcome: "no-project-root", variable: "CLAUDE_PROJECT_DIR" },
      failed(FIRST, "no-project-root"),
    ],
    ["a discarded ask", { outcome: "discarded" }, failed(FIRST, "discarded")],
  ] as const)("%s", async (_, outcome, reply) => {
    const fake = fakeHostCore({ snapshot: async () => outcome as SnapshotOutcome });
    const { host, opened, reported } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      const received = await board.next();
      expect(received).toEqual(reply);
      expect(validateBoardMessage("toPage", received).ok).toBe(true);
      await quiet(board);
      expect(reported).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("two requests at once are each answered by their ID, in the order they end", async () => {
    const outcomes = [held(), held()];
    const fake = fakeHostCore({
      snapshot: () => (outcomes.shift() ?? held()).outcome,
    });
    const [first, second] = outcomes as [ReturnType<typeof held>, ReturnType<typeof held>];
    const { host, opened } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      board.send(request(SECOND, true));
      await Bun.sleep(50);
      second.settle({ outcome: "saved", path: SNAPSHOT_PATH, state: "waiting", unchecked: true });
      expect(await board.next()).toEqual(saved(SECOND));
      first.settle({ outcome: "write-failed", folder: FOLDER, code: "ENOSPC" });
      expect(await board.next()).toEqual(failed(FIRST, "write-failed", FOLDER));
    } finally {
      await host.close();
    }
  });
});

describe("a board's Snapshot AskBoard fails to take", () => {
  test("a rejection, a damaged view build's included, is reported and answers internal-error; the board stays", async () => {
    class DamagedBuild extends BoardSetupError {
      override readonly name = "DamagedBuild";
    }
    const damaged = new DamagedBuild("VIEW_FILE_INVALID", "a notice text cannot be read");
    const failures: unknown[] = [damaged, new Error("the writer broke its port")];
    const fake = fakeHostCore({
      snapshot: async () => {
        if (failures.length > 0) throw failures.shift();
        return { outcome: "saved", path: SNAPSHOT_PATH, state: "waiting", unchecked: true };
      },
    });
    const { host, opened, reported } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      board.send(request(SECOND));
      for (const id of [FIRST, SECOND]) {
        const received = await board.next();
        expect(received).toEqual(failed(id, "internal-error"));
        expect(validateBoardMessage("toPage", received).ok).toBe(true);
      }
      expect(reported).toEqual([damaged, expect.any(Error)]);
      expect((reported[1] as Error).message).toBe("the writer broke its port");
      board.send(request("cD5eF7gH9jK1lM3nP5qR7s"));
      expect(await board.next()).toEqual(saved("cD5eF7gH9jK1lM3nP5qR7s"));
    } finally {
      await host.close();
    }
  });

  test("ask-core's owner refusal, which only an agent's request gets, is reported and answers internal-error", async () => {
    const fake = fakeHostCore({
      snapshot: async () => ({ outcome: "refused", why: "other-owner" }),
    });
    const { host, opened, reported } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      expect(await board.next()).toEqual(failed(FIRST, "internal-error"));
      await quiet(board);
      expect(reported).toHaveLength(1);
      expect(String(reported[0])).toContain("refused");
    } finally {
      await host.close();
    }
  });
});

describe("a discard while a Snapshot is taken", () => {
  test("answers discarded before the discard, and the late outcome sends nothing", async () => {
    const outcome = held();
    const fake = fakeHostCore({ snapshot: () => outcome.outcome });
    const { host, opened, reported } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      board.send(request(SECOND, true));
      await Bun.sleep(50);
      expect(snapshotCalls(fake)).toHaveLength(2);
      fake.emit({ type: "discarded", askId, reason: "session-exit" });
      expect(await board.next()).toEqual(failed(FIRST, "discarded"));
      expect(await board.next()).toEqual(failed(SECOND, "discarded"));
      expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
      expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
      outcome.settle({ outcome: "saved", path: SNAPSHOT_PATH, state: "waiting", unchecked: true });
      await quiet(board);
      expect(reported).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("a request already answered is not answered again at the discard", async () => {
    const fake = fakeHostCore();
    const { host, opened } = await hostOf(fake);
    try {
      const board = await opened();
      board.send(request(FIRST));
      expect(await board.next()).toEqual(saved(FIRST));
      fake.emit({ type: "discarded", askId, reason: "board-closed" });
      expect(await board.next()).toEqual({ version, type: "discarded", reason: "board-closed" });
    } finally {
      await host.close();
    }
  });
});

describe("only the live board takes a Snapshot", () => {
  test("a tab that lost the board asks in vain; its request reaches no core", async () => {
    const fake = fakeHostCore();
    const { host, open, opened } = await hostOf(fake, 50);
    try {
      const first = await opened();
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      first.send(request(FIRST));
      // The request does not end the flush wait, as a draft would.
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await second.next()).toMatchObject({ type: "board" });
      expect(await second.next()).toMatchObject({ type: "state" });
      expect(first.pending).toEqual([]);
      expect(snapshotCalls(fake)).toEqual([]);
      second.send(request(SECOND));
      expect(await second.next()).toEqual(saved(SECOND));
    } finally {
      await host.close();
    }
  });

  test("an outcome after a takeover goes to the tab that asked, never to the tab that took over", async () => {
    const outcome = held();
    const fake = fakeHostCore({ snapshot: () => outcome.outcome });
    const { host, open, opened } = await hostOf(fake);
    try {
      const first = await opened();
      first.send(request(FIRST));
      await Bun.sleep(50);
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      outcome.settle({ outcome: "saved", path: SNAPSHOT_PATH, state: "waiting", unchecked: true });
      expect(await first.next()).toEqual(saved(FIRST));
      first.send({ version, type: "draft", record: LAST_DRAFT });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await second.next()).toMatchObject({ type: "board" });
      expect(await second.next()).toMatchObject({ type: "state" });
      expect(await second.next()).toEqual({ version, type: "draft", record: LAST_DRAFT });
      await quiet(second);
    } finally {
      await host.close();
    }
  });
});
