import { afterAll, describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  DRAFT_RECORD_MAX_CHARS,
  type DraftRecord,
  GRACE_PERIOD_MS,
  TAKEOVER_FLUSH_WAIT_MS,
} from "@askboard/contract";
import { LIFECYCLE, lifecycleAsk, lifecycleDraftRecord } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { createBoardHost } from "../../src/board-host/index.ts";
import { type FakeHostCore, fakeHostCore, plainView } from "./fake-core.ts";
import {
  freeRange,
  manualClock,
  openSocket,
  removeViews,
  request,
  startHost,
  writeView,
} from "./helpers.ts";

// Board-host spec, Connections reported to the core, One live board per ask, Draft mirror and Board
// protocol over a WebSocket (ask-lifecycle, task 5.2): what board-host reports to ask-core, the
// takeover's flush of the older tab's last draft, drafts checked before ask-core holds them, and a
// board gone past the grace period.

const version = BOARD_PROTOCOL_VERSION;
const { token } = LIFECYCLE;
const plainAsk = plainView.askId;

afterAll(removeViews);

const draftOf = (note: string): DraftRecord => ({
  delivery: "immediate",
  inView: "database",
  questions: { database: { rev: 1, note } },
});

const draftMessage = (record: DraftRecord) => ({ version, type: "draft", record });

const hostOf = async (fake: FakeHostCore, takeoverFlushMs = TAKEOVER_FLUSH_WAIT_MS) => {
  const host = createBoardHost({
    core: () => fake.core,
    view: writeView(),
    report: () => undefined,
    ports: await freeRange(1),
    token: () => token,
    limits: { takeoverFlushMs },
  });
  const link = new URL(await host.address.link(plainAsk));
  const port = Number(link.port);
  const open = async () => {
    const socket = await openSocket(port, plainAsk);
    socket.send({ version, type: "connect", token });
    return socket;
  };
  return { host, open, port };
};

const types = async (socket: { next(): Promise<unknown> }, count: number) => {
  const seen: string[] = [];
  for (let n = 0; n < count; n += 1) seen.push(((await socket.next()) as { type: string }).type);
  return seen;
};

describe("connections reported to the core", () => {
  test("an accepted board is one connection, and its close one disconnection", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const tab = await open();
      await types(tab, 2);
      expect(fake.reports()).toEqual(["connected"]);
      tab.socket.close();
      await tab.closed();
      await Bun.sleep(20);
      expect(fake.reports()).toEqual(["connected", "disconnected"]);
    } finally {
      await host.close();
    }
  });

  test("a takeover is no disconnection: ask-core hears one connection, and the live tab's close", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake, 50);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(second, 2)).toEqual(["board", "state"]);
      await Bun.sleep(20);
      expect(fake.reports()).toEqual(["connected"]);
      second.socket.close();
      await second.closed();
      await Bun.sleep(20);
      expect(fake.reports()).toEqual(["connected", "disconnected"]);
    } finally {
      await host.close();
    }
  });

  test("a refused connect, a socket that never connects and the host's own close report nothing", async () => {
    const fake = fakeHostCore();
    const { host, port, open } = await hostOf(fake);
    const refused = await openSocket(port, plainAsk);
    refused.send({ version, type: "connect", token: "wrong-token-xxxxxxxxxx" });
    expect(await refused.closed()).toBe(BOARD_CLOSE_CODES.refused);
    const silent = await openSocket(port, plainAsk);
    silent.socket.close();
    await silent.closed();
    const live = await open();
    await types(live, 2);
    await host.close();
    expect(await live.closed()).toBe(1001);
    await Bun.sleep(20);
    expect(fake.reports()).toEqual(["connected"]);
  });
});

describe("the takeover flush", () => {
  test("the older tab's draft within the wait is held, ends the wait, and reaches the new tab", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const first = await open();
      await types(first, 2);
      first.send(draftMessage(draftOf("typed in the first tab")));
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      const started = Date.now();
      first.send(draftMessage(draftOf("its last draft")));
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(Date.now() - started).toBeLessThan(TAKEOVER_FLUSH_WAIT_MS);
      expect(await types(second, 2)).toEqual(["board", "state"]);
      expect(await second.next()).toEqual(draftMessage(draftOf("its last draft")));
      expect(fake.draft).toEqual(draftOf("its last draft"));
    } finally {
      await host.close();
    }
  });

  test("with no draft from the older tab, the new tab opens once the wait has passed", async () => {
    const fake = fakeHostCore({ draft: draftOf("held before") });
    const { host, open } = await hostOf(fake, 100);
    try {
      const first = await open();
      await types(first, 3);
      const second = await open();
      expect(await first.next()).toEqual({ version, type: "moved" });
      await Bun.sleep(30);
      expect(second.pending).toEqual([]);
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(second, 3)).toEqual(["board", "state", "draft"]);
    } finally {
      await host.close();
    }
  });

  // Board-host spec, Acknowledging commands: an act the user made before the tab saw `moved` is a
  // genuine act, applied once by its action ID, and answered on the tab that sent it.
  test("the older tab's act during the wait is applied and answered, and its close ends the wait", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      await first.next();
      const actionId = "aX9kQ2mPz7RtLw4nB8cYhA";
      const acts = [{ type: "postpone", itemId: "database", rev: 1 }];
      first.send({ version, type: "act", actionId, acts });
      expect(await first.next()).toEqual({ version, type: "done", actionId });
      expect(await first.next()).toMatchObject({ type: "state" });
      expect(fake.calls).toContainEqual(["act", plainAsk, { actionId, acts }]);
      // One outside the schema is refused as on the live board.
      first.send({ version, type: "act", acts });
      expect(await first.next()).toMatchObject({ type: "refused", reason: "message" });
      first.socket.close();
      expect(await types(second, 2)).toEqual(["board", "state"]);
    } finally {
      await host.close();
    }
  });

  test("the older tab's refused act during the wait is answered with its action ID", async () => {
    const fake = fakeHostCore({
      act: () => ({ ok: false, refusal: "state", detail: "the question is postponed", index: 0 }),
    });
    const { host, open } = await hostOf(fake);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      await first.next();
      const actionId = "bX9kQ2mPz7RtLw4nB8cYhA";
      first.send({
        version,
        type: "act",
        actionId,
        acts: [{ type: "postpone", itemId: "database", rev: 1 }],
      });
      expect(await first.next()).toMatchObject({ type: "refused", reason: "act", actionId });
      expect(await first.next()).toMatchObject({ type: "state" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(second, 2)).toEqual(["board", "state"]);
    } finally {
      await host.close();
    }
  });

  test("an invalid draft from the older tab is refused and ends the wait", async () => {
    const fake = fakeHostCore({ draft: draftOf("held before") });
    const { host, open } = await hostOf(fake);
    try {
      const first = await open();
      await types(first, 3);
      const second = await open();
      await first.next();
      first.send(draftMessage({ ...draftOf("x"), questions: { "no-such-question": { rev: 1 } } }));
      expect(await first.next()).toMatchObject({ type: "refused", reason: "message" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(second, 3)).toEqual(["board", "state", "draft"]);
      expect(fake.draft).toEqual(draftOf("held before"));
    } finally {
      await host.close();
    }
  });

  test("a draft outside the schema from the older tab is refused and ends the wait", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      await first.next();
      first.send({ version, type: "draft", record: { delivery: "later", questions: {} } });
      expect(await first.next()).toMatchObject({ type: "refused", reason: "message" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(second, 2)).toEqual(["board", "state"]);
      expect(fake.draft).toBeUndefined();
    } finally {
      await host.close();
    }
  });

  test("a third tab during the wait takes the board from the second, which never opened", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake, 100);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      await first.next();
      const third = await open();
      expect(await second.next()).toEqual({ version, type: "moved" });
      expect(await second.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await types(third, 2)).toEqual(["board", "state"]);
      expect(second.pending).toEqual([]);
      expect(fake.reports()).toEqual(["connected"]);
    } finally {
      await host.close();
    }
  });

  test("a draft from a tab that lost the board after the wait is ignored; the new tab's is held", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake, 50);
    try {
      const first = await open();
      await types(first, 2);
      const second = await open();
      await first.next();
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      await types(second, 2);
      try {
        first.send(draftMessage(draftOf("too late")));
      } catch {
        // The socket is closed: the draft cannot even be sent.
      }
      second.send(draftMessage(draftOf("the new tab's")));
      await Bun.sleep(50);
      expect(fake.draft).toEqual(draftOf("the new tab's"));
    } finally {
      await host.close();
    }
  });
});

describe("drafts from the live board", () => {
  test("are held as sent, with no reply", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const tab = await open();
      await types(tab, 2);
      tab.send(draftMessage(draftOf("a note")));
      await Bun.sleep(30);
      expect(fake.draft).toEqual(draftOf("a note"));
      expect(tab.pending).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("a record its board cannot hold is refused and not held", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const tab = await open();
      await types(tab, 2);
      tab.send(draftMessage({ ...draftOf("x"), questions: { constructor: { rev: 1 } } }));
      const refused = await tab.next();
      expect(refused).toMatchObject({ type: "refused", reason: "message" });
      expect((refused as { detail: string }).detail).toContain("constructor");
      tab.send(draftMessage({ ...draftOf("x"), questions: { database: { rev: 2 } } }));
      expect(await tab.next()).toMatchObject({ type: "refused", reason: "message" });
      expect(fake.calls.some(([kind]) => kind === "holdDraft")).toBe(false);
    } finally {
      await host.close();
    }
  });

  test("a record over the draft limit is refused, the socket stays open", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const tab = await open();
      await types(tab, 2);
      const text = "n".repeat(10_000);
      const questions = Object.fromEntries(
        Array.from({ length: 70 }, (_, n) => [
          `q${n}`,
          { rev: 1, note: text, other: text, composer: text },
        ]),
      );
      const record = { delivery: "immediate", questions } as DraftRecord;
      expect(JSON.stringify(record).length).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
      tab.send(draftMessage(record));
      const refused = await tab.next();
      expect(refused).toMatchObject({ type: "refused", reason: "message" });
      expect((refused as { detail: string }).detail).toContain("the draft record takes");
      expect(validateBoardMessage("toPage", refused).ok).toBe(true);
      tab.send(draftMessage(draftOf("still open")));
      await Bun.sleep(30);
      expect(fake.draft).toEqual(draftOf("still open"));
    } finally {
      await host.close();
    }
  });

  test("a draft far larger than an E1 message is taken whole", async () => {
    const fake = fakeHostCore();
    const { host, open } = await hostOf(fake);
    try {
      const tab = await open();
      await types(tab, 2);
      const text = "€".repeat(10_000);
      const big: DraftRecord = {
        delivery: "submitted",
        questions: { database: { rev: 1, note: text, other: text, composer: text } },
      };
      expect(Buffer.byteLength(JSON.stringify(draftMessage(big)))).toBeGreaterThan(64 * 1024);
      tab.send(draftMessage(big));
      await Bun.sleep(50);
      expect(fake.draft).toEqual(big);
    } finally {
      await host.close();
    }
  });

  test("a draft sent before connect is the token refusal of a first message", async () => {
    const fake = fakeHostCore();
    const { host, port } = await hostOf(fake);
    try {
      const tab = await openSocket(port, plainAsk);
      tab.send(draftMessage(draftOf("x")));
      expect(await tab.next()).toMatchObject({ type: "refused", reason: "token" });
      expect(await tab.closed()).toBe(BOARD_CLOSE_CODES.refused);
      expect(fake.draft).toBeUndefined();
    } finally {
      await host.close();
    }
  });
});

describe("a board gone past the grace period", () => {
  test("is discarded: its link opens the discarded page and its token stops working", async () => {
    const time = manualClock();
    const fixture = startHost({ ports: await freeRange(1), tokens: [token], clock: time.clock });
    try {
      const { port, link } = await fixture.ask(undefined, lifecycleAsk);
      const tab = await openSocket(port, LIFECYCLE.askId);
      tab.send({ version, type: "connect", token });
      await types(tab, 2);
      tab.socket.close();
      await tab.closed();
      await Bun.sleep(20);
      expect(time.delays).toEqual([GRACE_PERIOD_MS]);
      time.advance(GRACE_PERIOD_MS);
      const read = fixture.core.read(LIFECYCLE.askId, `${fixture.core.epoch}.0`);
      expect(read.kind === "events" && read.events).toEqual([
        { cursor: `${fixture.core.epoch}.1`, type: "discarded", reason: "board-closed" },
      ]);
      const page = await request(port, link.slice(link.indexOf("/b/")));
      expect(page.status).toBe(BOARD_RESPONSES.discardedLink.status);
      const again = await openSocket(port, LIFECYCLE.askId);
      again.send({ version, type: "connect", token });
      expect(await again.next()).toMatchObject({ type: "refused", reason: "token" });
      expect(await again.closed()).toBe(BOARD_CLOSE_CODES.refused);
    } finally {
      await fixture.host.close();
    }
  });

  test("a reload within the grace period keeps the ask and its draft", async () => {
    const time = manualClock();
    const fixture = startHost({ ports: await freeRange(1), tokens: [token], clock: time.clock });
    try {
      const { port } = await fixture.ask(undefined, lifecycleAsk);
      const tab = await openSocket(port, LIFECYCLE.askId);
      tab.send({ version, type: "connect", token });
      await types(tab, 2);
      tab.send(draftMessage(lifecycleDraftRecord));
      await Bun.sleep(20);
      tab.socket.close();
      await tab.closed();
      await Bun.sleep(20);
      time.advance(GRACE_PERIOD_MS - 1);
      const back = await openSocket(port, LIFECYCLE.askId);
      back.send({ version, type: "connect", token });
      expect(await types(back, 3)).toEqual(["board", "state", "draft"]);
      time.advance(GRACE_PERIOD_MS);
      expect(time.pending()).toBe(0);
      expect(fixture.core.lifecycleBoard(LIFECYCLE.askId)?.state).toBe("waiting");
    } finally {
      await fixture.host.close();
    }
  });

  test("a takeover starts no grace timer", async () => {
    const time = manualClock();
    const fixture = startHost({
      ports: await freeRange(1),
      tokens: [token],
      clock: time.clock,
      limits: { takeoverFlushMs: 50 },
    });
    try {
      const { port } = await fixture.ask(undefined, lifecycleAsk);
      const first = await openSocket(port, LIFECYCLE.askId);
      first.send({ version, type: "connect", token });
      await types(first, 2);
      const second = await openSocket(port, LIFECYCLE.askId);
      second.send({ version, type: "connect", token });
      expect(await first.next()).toMatchObject({ type: "moved" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      await types(second, 2);
      expect(time.delays).toEqual([]);
      second.socket.close();
      await second.closed();
      await Bun.sleep(20);
      expect(time.delays).toEqual([GRACE_PERIOD_MS]);
    } finally {
      await fixture.host.close();
    }
  });
});
