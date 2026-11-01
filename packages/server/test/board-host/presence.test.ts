import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { PLAIN_CHOICE, workingPresence } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  startHost,
  type TestHost,
} from "./helpers.ts";

// Board-host spec, Working boards (task 5.2, design decisions 5 and 10): each live board's working
// signal from its presence messages, checked with the contract's `validatePresence` before E1's
// page messages, reported to ask-core with `setWorking`, and false when the board's socket closes
// or another tab takes the board over. The opener decision is ask-core's: no board opens while a
// board of the session is working.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = PLAIN_CHOICE;
const idle = { ...workingPresence, working: false };

afterAll(removeViews);

// A board host around the real ask-core, its `setWorking` calls recorded.
const workingHost = async (tokens: readonly string[] = [token]) => {
  const fixture = startHost({ ports: await freeRange(1), tokens });
  const reported: [string, boolean][] = [];
  const setWorking = fixture.core.setWorking.bind(fixture.core);
  fixture.core.setWorking = (id, working) => {
    reported.push([id, working]);
    setWorking(id, working);
  };
  return { fixture, reported };
};

type Asked = Awaited<ReturnType<TestHost["ask"]>>;

// A board connected and accepted: its board document and state taken.
const connected = async ({ port, askId: id, token: boardToken }: Asked) => {
  const socket = await openSocket(port, id);
  socket.send({ version, type: "connect", token: boardToken });
  expect(await socket.next()).toMatchObject({ type: "board" });
  expect(await socket.next()).toMatchObject({ type: "state" });
  return socket;
};

const quiet = async (socket: BoardSocket) => {
  await Bun.sleep(50);
  expect(socket.pending).toEqual([]);
};

const eventually = async (check: () => boolean, what: string) => {
  for (let tries = 0; tries < 200 && !check(); tries += 1) await Bun.sleep(5);
  if (!check()) throw new Error(`timed out waiting for ${what}`);
};

describe("presence on a live board", () => {
  test("its working flag reaches ask-core on each change, with no reply", async () => {
    const { fixture, reported } = await workingHost();
    try {
      const board = await connected(await fixture.ask(askId));
      board.send(workingPresence);
      await eventually(() => reported.length === 1, "the working report");
      board.send(workingPresence);
      board.send(idle);
      await eventually(() => reported.length === 2, "the idle report");
      expect(reported).toEqual([
        [askId, true],
        [askId, false],
      ]);
      await quiet(board);
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  const refused: [string, unknown, string][] = [
    ["a presence with content", { ...workingPresence, text: "the answer" }, "message"],
    ["a presence with an item", { ...workingPresence, itemId: "database" }, "message"],
    ["a presence without the flag", { version, type: "presence" }, "message"],
    ["a presence whose flag is not a boolean", { ...workingPresence, working: "yes" }, "message"],
    ["a presence of another major", { ...workingPresence, version: "2.0" }, "version"],
  ];
  for (const [what, message, reason] of refused) {
    test(`${what} is refused with reason ${reason}, the socket left open`, async () => {
      const { fixture, reported } = await workingHost();
      try {
        const board = await connected(await fixture.ask(askId));
        board.send(message);
        const refusal = await board.next();
        expect(refusal).toMatchObject({ version, type: "refused", reason });
        expect(validateBoardMessage("toPage", refusal).ok).toBe(true);
        // The socket is still the live board: a valid presence counts.
        board.send(workingPresence);
        await eventually(() => reported.length === 1, "the working report");
        expect(reported).toEqual([[askId, true]]);
        await quiet(board);
      } finally {
        await fixture.host.close();
      }
    });
  }

  test("a presence as the first message is refused like any but connect, and counts for nothing", async () => {
    const { fixture, reported } = await workingHost();
    try {
      const { port } = await fixture.ask(askId);
      const socket = await openSocket(port, askId);
      socket.send(workingPresence);
      expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
      expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
      expect(socket.pending).toEqual([]);
      expect(reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("a working board that goes away", () => {
  test("its socket closing reports it not working", async () => {
    const { fixture, reported } = await workingHost();
    try {
      const board = await connected(await fixture.ask(askId));
      board.send(workingPresence);
      await eventually(() => reported.length === 1, "the working report");
      board.socket.close();
      await eventually(() => reported.length === 2, "the report at close");
      expect(reported).toEqual([
        [askId, true],
        [askId, false],
      ]);
    } finally {
      await fixture.host.close();
    }
  });

  test("a board that never worked reports nothing when it closes", async () => {
    const { fixture, reported } = await workingHost();
    try {
      const board = await connected(await fixture.ask(askId));
      board.send(idle);
      board.socket.close();
      await board.closed();
      await Bun.sleep(50);
      expect(reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("a takeover ends the old tab's signal; the new tab's presence counts", async () => {
    const { fixture, reported } = await workingHost();
    try {
      const asked = await fixture.ask(askId);
      const first = await connected(asked);
      first.send(workingPresence);
      await eventually(() => reported.length === 1, "the first tab's report");
      const second = await connected(asked);
      expect(await first.next()).toEqual({ version, type: "moved" });
      await first.closed();
      expect(reported).toEqual([
        [askId, true],
        [askId, false],
      ]);
      second.send(workingPresence);
      await eventually(() => reported.length === 3, "the second tab's report");
      expect(reported.at(-1)).toEqual([askId, true]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("the opener decision, with the real ask-core", () => {
  test("no board opens while a board of the session works; one does once it stops", async () => {
    const { fixture } = await workingHost(["tokenAAAAAAAAAAAAAAAAA", "tokenBBBBBBBBBBBBBBBBBB"]);
    try {
      const first = await fixture.ask("first-ask");
      expect(fixture.opened).toEqual([first.link]);
      const board = await connected(first);
      board.send(workingPresence);
      await Bun.sleep(50);
      await fixture.ask("second-ask");
      expect(fixture.opened).toEqual([first.link]);
      board.socket.close();
      await board.closed();
      await Bun.sleep(50);
      const third = await fixture.ask("third-ask");
      expect(fixture.opened).toEqual([first.link, third.link]);
    } finally {
      await fixture.host.close();
    }
  });
});
