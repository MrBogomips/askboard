import { afterAll, describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  DRAFT_RECORD_MAX_CHARS,
  type DraftRecord,
} from "@askboard/contract";
import { PLAIN_CHOICE, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { CLOSE_GRACE_MS, MESSAGE_MAX_BYTES } from "../../src/board-host/boards.ts";
import {
  clientFrame,
  freeRange,
  openSocket,
  rawUpgrade,
  removeViews,
  startHost,
} from "./helpers.ts";

// Board-host spec, Board protocol over a WebSocket, "A socket that does not start with its token"
// (AD-11, NFR-4): until its `connect` is accepted, a socket costs the host little. A first message
// that is not `connect` with the board's token is refused before the schema validator reads it, a
// socket may send far less before `connect` than a live board may, and a refused socket that never
// answers the close is ended.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = PLAIN_CHOICE;
const itemId = plainChoiceBoardDocument.items[0].id;

afterAll(removeViews);

// A record whose question keys name no question: the schema validator reports each one.
const manyKeys = (count: number): Record<string, unknown> =>
  Object.fromEntries(Array.from({ length: count }, (_, n) => [`q${n}`, { rev: 0 }]));

describe("a first message that is not connect with the board's token", () => {
  const firstMessages: [string, unknown][] = [
    [
      "a draft of 160,000 entries",
      { version, type: "draft", record: { delivery: "immediate", questions: manyKeys(160_000) } },
    ],
    [
      "a connect with a wrong token and 160,000 unknown fields",
      { version, type: "connect", token: "wrong", ...manyKeys(160_000) },
    ],
  ];
  for (const [what, message] of firstMessages) {
    test(`${what} is refused at once, before any schema check`, async () => {
      // A live board's bound before connect too, so that only the order of the checks is measured.
      const fixture = startHost({
        ports: await freeRange(1),
        tokens: [token],
        limits: { preConnectMaxBytes: MESSAGE_MAX_BYTES },
      });
      try {
        const { port } = await fixture.ask(askId);
        const socket = await openSocket(port, askId);
        const text = JSON.stringify(message);
        expect(Buffer.byteLength(text)).toBeGreaterThan(2 * 1024 * 1024);
        const sent = performance.now();
        socket.socket.send(text);
        expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
        expect(performance.now() - sent).toBeLessThan(100);
        expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
        expect(socket.pending).toEqual([]);
      } finally {
        await fixture.host.close();
      }
    });
  }
});

describe("what a socket may send before connect", () => {
  test("a first message of 1 MB is cut off unanswered, and the host keeps serving", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const socket = await openSocket(port, askId);
      const note = "x".repeat(1024 * 1024);
      socket.send({
        version,
        type: "draft",
        record: { delivery: "immediate", questions: { [itemId]: { rev: 1, note } } },
      });
      expect([1006, 1009]).toContain(await socket.closed());
      expect(socket.pending).toEqual([]);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      expect(await tab.next()).toMatchObject({ type: "board" });
    } finally {
      await fixture.host.close();
    }
  });

  test("is counted as it arrives: a frame announced at 1 MB is cut off before the rest is sent", async () => {
    const fixture = startHost({
      ports: await freeRange(1),
      tokens: [token],
      limits: { connectTimeoutMs: 60_000 },
    });
    try {
      const { port } = await fixture.ask(askId);
      const frame = clientFrame(
        JSON.stringify({ version, type: "draft", junk: "x".repeat(1024 * 1024) }),
      );
      const peer = await rawUpgrade(port, askId, frame.subarray(0, 128 * 1024));
      expect(await peer.endedWithin(2_000)).toBe(true);
      peer.socket.destroy();
    } finally {
      await fixture.host.close();
    }
  });

  test("a connected board still sends a draft near the draft limit", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      expect(await tab.next()).toMatchObject({ type: "board" });
      expect(await tab.next()).toMatchObject({ type: "state" });
      const record: DraftRecord = {
        delivery: "immediate",
        questions: {
          [itemId]: { rev: 1, values: { [itemId]: "€".repeat(DRAFT_RECORD_MAX_CHARS - 1_000) } },
        },
      };
      const message = JSON.stringify({ version, type: "draft", record });
      expect(Buffer.byteLength(message)).toBeGreaterThan(MESSAGE_MAX_BYTES - 64 * 1024);
      tab.socket.send(message);
      const held = () => fixture.core.draftToRestore(askId);
      for (let tries = 0; tries < 200 && held() === undefined; tries += 1) await Bun.sleep(10);
      expect(fixture.core.draftToRestore(askId)).toEqual(record);
      expect(tab.pending).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("a socket refused before connect", () => {
  test("that never answers the close is ended within the close bound", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const peer = await rawUpgrade(port, askId);
      peer.socket.write(clientFrame(JSON.stringify({ version, type: "draft" })));
      expect(await peer.endedWithin(CLOSE_GRACE_MS + 1_500)).toBe(true);
      peer.socket.destroy();
    } finally {
      await fixture.host.close();
    }
  });
});
