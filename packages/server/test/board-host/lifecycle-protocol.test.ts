import { afterAll, describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  type DraftRecord,
} from "@askboard/contract";
import {
  LIFECYCLE,
  type LifecycleTranscript,
  type LifecycleTranscriptStep,
  lifecycleAsk,
  lifecycleBoardDocument,
  lifecycleDraftRecord,
  lifecycleProtocolExamples,
  lifecycleTranscripts,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { ActOutcome } from "@askboard/core";
import { createBoardHost } from "../../src/board-host/index.ts";
import { type FakeHostCore, fakeHostCore, type OpenView, plainView } from "./fake-core.ts";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  request,
  startHost,
  writeView,
} from "./helpers.ts";

// Board-host spec, Board protocol over a WebSocket, Acknowledging commands and A closed ask's board
// (ask-lifecycle, task 5.1): the board page's half of each lifecycle transcript, replayed against
// board-host around the real ask-core, gets exactly the host's half; then acts, agent changes and
// closing against a fake core.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = LIFECYCLE;
const ACTION = "aX9kQ2mPz7RtLw4nB8cYhA";
const when = "2026-10-31T14:05:12Z";

afterAll(removeViews);

// A refusal's detail is text for people: the replay checks that it is there, not its words.
const expectMessage = (received: unknown, expected: object) => {
  expect(validateBoardMessage("toPage", received).ok).toBe(true);
  if ((expected as { type?: string }).type === "refused") {
    const { detail, ...rest } = received as { detail: unknown };
    const { detail: _, ...wanted } = expected as { detail: unknown };
    expect(rest).toEqual(wanted);
    expect(typeof detail).toBe("string");
    return;
  }
  expect(received).toEqual(expected);
};

const replay = async (transcript: LifecycleTranscript) => {
  const fixture = startHost({ ports: await freeRange(1), tokens: [transcript.token] });
  const { port } = await fixture.ask(undefined, lifecycleAsk);
  const sockets = new Map<number, BoardSocket>();
  const socketOf = async (step: LifecycleTranscriptStep & { socket: number }) => {
    const known = sockets.get(step.socket);
    if (known !== undefined) return known;
    const opened = await openSocket(port, transcript.askId);
    sockets.set(step.socket, opened);
    return opened;
  };
  try {
    for (const step of transcript.steps) {
      if (step.from === "page") {
        await (await socketOf(step)).send("message" in step ? step.message : step.invalid);
      } else if (step.from === "host") {
        const socket = await socketOf(step);
        if ("message" in step) expectMessage(await socket.next(), step.message);
        else expect(await socket.closed()).toBe(step.close);
      } else if (step.from === "network") {
        (await socketOf(step)).socket.terminate();
      } else if (step.event === "update") {
        expect(await fixture.core.update(step.request)).toMatchObject({ kind: "updated" });
      } else if (step.event === "collected") {
        const read = fixture.core.read(transcript.askId, `${fixture.core.epoch}.0`);
        if (read.kind !== "events") throw new Error(`read ${read.kind}`);
        fixture.core.markRead(transcript.askId, read.cursor);
      } else {
        fixture.core.discardAll("session-exit");
      }
    }
    await Bun.sleep(50);
    for (const socket of sockets.values()) expect(socket.pending).toEqual([]);
  } finally {
    for (const socket of sockets.values()) socket.socket.terminate();
    await fixture.host.close();
  }
  return fixture;
};

describe("the lifecycle transcripts, replayed from the board page's side", () => {
  for (const [name, transcript] of Object.entries(lifecycleTranscripts)) {
    test(`${name}: board-host sends exactly the host's half`, async () => {
      const fixture = await replay(transcript);
      expect(fixture.reported).toEqual([]);
    });
  }

  test("submit appends its three events once, in one command", async () => {
    const fixture = await replay(lifecycleTranscripts.submit as LifecycleTranscript);
    const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
    expect(read.kind === "events" && read.events.map((event) => event.type)).toEqual([
      "answer",
      "answer",
      "postponed",
    ]);
    expect(read.kind === "events" && new Set(read.groups).size).toBe(1);
  });

  test("staleSubmit and closedAsk append nothing", async () => {
    for (const name of ["staleSubmit", "closedAsk"]) {
      const fixture = await replay(lifecycleTranscripts[name] as LifecycleTranscript);
      const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      expect(read.kind === "events" && read.events).toEqual([]);
    }
  });

  test("takeoverDraft and restoredDraft leave the tab's last draft held", async () => {
    for (const name of ["takeoverDraft", "restoredDraft"]) {
      const fixture = await replay(lifecycleTranscripts[name] as LifecycleTranscript);
      expect(fixture.core.draftToRestore(askId)).toEqual(lifecycleDraftRecord);
    }
  });

  test("every message protocol 1.1 adds is one the host may send", () => {
    for (const message of lifecycleProtocolExamples.toPage) {
      expect(validateBoardMessage("toPage", message).ok).toBe(true);
    }
  });
});

// A board host around a fake core, its board connected and opened.
const connected = async (fake: FakeHostCore, limits: { takeoverFlushMs?: number } = {}) => {
  const reported: unknown[] = [];
  const host = createBoardHost({
    core: () => fake.core,
    view: writeView(),
    report: (error) => reported.push(error),
    ports: await freeRange(1),
    token: () => token,
    limits,
  });
  const link = new URL(await host.address.link(fake.view.askId));
  const port = Number(link.port);
  const open = async () => {
    const socket = await openSocket(port, fake.view.askId);
    socket.send({ version, type: "connect", token });
    return socket;
  };
  const tab = await open();
  await tab.next();
  await tab.next();
  return { host, tab, open, port, reported, link };
};

const answerAct = { type: "answer", itemId: "database", rev: 1, choice: ["SQLite"], when };
const act = (acts: object[] = [answerAct], actionId = ACTION) => ({
  version,
  type: "act",
  actionId,
  acts,
});
const waitingState = {
  version,
  type: "state",
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
};

describe("acknowledging act commands", () => {
  test("a command ask-core applies is acknowledged with done, then the state", async () => {
    const fake = fakeHostCore();
    const { host, tab } = await connected(fake);
    try {
      tab.send(act());
      expect(await tab.next()).toEqual({ version, type: "done", actionId: ACTION });
      expect(await tab.next()).toEqual(waitingState);
      expect(fake.calls.filter(([kind]) => kind === "act")).toEqual([
        ["act", plainView.askId, { actionId: ACTION, acts: [answerAct] }],
      ]);
    } finally {
      await host.close();
    }
  });

  test("ask-core's event during the command sends no state before done", async () => {
    const fake = fakeHostCore();
    fake.core.act = (id) => {
      const event = { cursor: "k3x9.1", type: "postponed", itemId: "database", rev: 1 } as const;
      fake.emit({ type: "appended", askId: id, event, events: [event] });
      return { ok: true, events: [event], repeated: false };
    };
    const { host, tab } = await connected(fake);
    try {
      tab.send(act([{ type: "postpone", itemId: "database", rev: 1 }]));
      expect(await tab.next()).toMatchObject({ type: "done" });
      expect(await tab.next()).toMatchObject({ type: "state" });
      await Bun.sleep(30);
      expect(tab.pending).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("a repeated command is acknowledged as before", async () => {
    const { host, tab } = await connected(
      fakeHostCore({ act: () => ({ ok: true, events: [], repeated: true }) }),
    );
    try {
      tab.send(act());
      expect(await tab.next()).toEqual({ version, type: "done", actionId: ACTION });
      expect(await tab.next()).toMatchObject({ type: "state" });
    } finally {
      await host.close();
    }
  });

  test("a refused command names its action ID, the act and why, then the state; the socket stays", async () => {
    const refusal: ActOutcome = {
      ok: false,
      refusal: "stale-rev",
      detail: "act 1 names revision 1 of the question database, which is at revision 2",
      index: 1,
      itemId: "database",
    };
    const { host, tab } = await connected(fakeHostCore({ act: () => refusal }));
    try {
      tab.send(act([answerAct, answerAct]));
      const refused = await tab.next();
      expect(refused).toEqual({
        version,
        type: "refused",
        reason: "act",
        actionId: ACTION,
        index: 1,
        itemId: "database",
        detail: refusal.ok ? "" : refusal.detail,
      });
      expect(validateBoardMessage("toPage", refused).ok).toBe(true);
      expect(await tab.next()).toEqual(waitingState);
      tab.send(act());
      expect(await tab.next()).toMatchObject({ type: "refused" });
    } finally {
      await host.close();
    }
  });

  test("a refusal naming no item names the refused act's question", async () => {
    const { host, tab } = await connected(
      fakeHostCore({ act: () => ({ ok: false, refusal: "act", detail: "no", index: 0 }) }),
    );
    try {
      tab.send(act());
      expect(await tab.next()).toMatchObject({ reason: "act", index: 0, itemId: "database" });
    } finally {
      await host.close();
    }
  });

  test("a command on a closed ask is refused with reason closed, naming its action ID", async () => {
    const { host, tab } = await connected(
      fakeHostCore({ act: () => ({ ok: false, refusal: "closed", detail: "the ask is closed" }) }),
    );
    try {
      tab.send(act());
      const refused = await tab.next();
      expect(refused).toEqual({
        version,
        type: "refused",
        reason: "closed",
        actionId: ACTION,
        detail: "the ask is closed",
      });
      expect(await tab.next()).toMatchObject({ type: "state" });
    } finally {
      await host.close();
    }
  });

  test.each([
    ["command", "the command holds no act"],
    ["discarded", "the ask was discarded"],
    ["unknown-ask", "the ask is not one of this session"],
  ] as const)("ask-core's refusal %s is refused with reason message", async (refusal, detail) => {
    const { host, tab } = await connected(
      fakeHostCore({ act: () => ({ ok: false, refusal, detail }) }),
    );
    try {
      tab.send(act());
      expect(await tab.next()).toEqual({ version, type: "refused", reason: "message", detail });
    } finally {
      await host.close();
    }
  });

  test("an act command outside the schema is refused with reason message, reaching no core", async () => {
    const fake = fakeHostCore();
    const { host, tab } = await connected(fake);
    try {
      tab.send({ ...act(), actionId: "short" });
      expect(await tab.next()).toMatchObject({ type: "refused", reason: "message" });
      expect(fake.calls.some(([kind]) => kind === "act")).toBe(false);
    } finally {
      await host.close();
    }
  });
});

describe("agent changes reach the live board", () => {
  test("a new board after a document change, the state after a state change, closed on close", async () => {
    const fake = fakeHostCore();
    const { host, tab } = await connected(fake);
    try {
      const closed: OpenView = {
        ...plainView,
        state: "closed",
        closed: "agent",
        document: { ...plainView.document, title: "Reworded" },
      };
      fake.view = closed;
      fake.emit({ type: "document", askId: plainView.askId });
      fake.emit({ type: "state", askId: plainView.askId });
      fake.emit({ type: "closed", askId: plainView.askId, reason: "agent" });
      expect(await tab.next()).toEqual({ version, type: "board", document: closed.document });
      expect(await tab.next()).toMatchObject({ type: "state", state: { ask: "closed" } });
      expect(await tab.next()).toEqual({ version, type: "closed", reason: "agent" });
      fake.emit({ type: "document", askId: "another-ask" });
      await Bun.sleep(30);
      expect(tab.pending).toEqual([]);
    } finally {
      await host.close();
    }
  });

  test("a discard past the grace period is told with its reason, and the socket closed with 4410", async () => {
    const fake = fakeHostCore();
    const { host, tab } = await connected(fake);
    try {
      fake.emit({ type: "discarded", askId: plainView.askId, reason: "board-closed" });
      expect(await tab.next()).toEqual({ version, type: "discarded", reason: "board-closed" });
      expect(await tab.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    } finally {
      await host.close();
    }
  });

  test("the state shows answers with their receipts, previous answers and threads", async () => {
    const fake = fakeHostCore();
    const { host, tab } = await connected(fake);
    try {
      const answer = { choice: ["SQLite"], who: "Sara Conti", when, cursor: "k3x9.3" };
      const answered: OpenView = {
        ...plainView,
        state: "answered",
        questions: [
          {
            itemId: "database",
            rev: 2,
            state: "answered",
            answer: { ...answer, delivered: false },
            previous: {
              choice: ["PostgreSQL"],
              who: "Sara Conti",
              when,
              recorded: true,
              delivered: true,
            },
            thread: [
              {
                cursor: "k3x9.2",
                who: "Sara Conti",
                when,
                text: "Why SQLite?",
                replies: [{ text: "It is embedded.", when }],
              },
            ],
          },
        ],
      };
      fake.view = answered;
      fake.emit({ type: "state", askId: plainView.askId });
      const state = await tab.next();
      expect(state).toEqual({
        version,
        type: "state",
        state: {
          ask: "answered",
          questions: [
            {
              itemId: "database",
              rev: 2,
              state: "answered",
              answer: { choice: ["SQLite"], when, receipt: "sent" },
              previous: { choice: ["PostgreSQL"], when, receipt: "delivered", recorded: true },
              thread: [
                {
                  cursor: "k3x9.2",
                  who: "Sara Conti",
                  when,
                  text: "Why SQLite?",
                  replies: [{ text: "It is embedded.", when }],
                },
              ],
            },
          ],
        },
      });
      expect(validateBoardMessage("toPage", state).ok).toBe(true);
      // The revised answer's receipt follows once `received` passes it.
      fake.view = {
        ...answered,
        questions: answered.questions.map((question) => ({
          ...question,
          answer: { ...answer, delivered: true },
        })),
      };
      fake.emit({ type: "received", askId: plainView.askId, cursor: "k3x9.3" });
      expect(await tab.next()).toEqual({
        version,
        type: "receipt",
        itemId: "database",
        receipt: "delivered",
      });
    } finally {
      await host.close();
    }
  });
});

describe("a closed ask's board", () => {
  test("its link serves the page; its socket opens locked, refusing every act", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port, link } = await fixture.ask(undefined, lifecycleAsk);
      expect(await fixture.core.update({ askId, actions: [{ action: "close" }] })).toMatchObject({
        kind: "updated",
        state: "closed",
      });
      const page = await request(port, link.slice(link.indexOf("/b/")));
      expect(page.status).toBe(BOARD_RESPONSES.boardPage.status);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      expect(await tab.next()).toEqual({
        version,
        type: "board",
        document: lifecycleBoardDocument,
      });
      expect(await tab.next()).toMatchObject({ type: "state", state: { ask: "closed" } });
      expect(await tab.next()).toEqual({ version, type: "closed", reason: "agent" });
      tab.send(act([{ type: "postpone", itemId: "region", rev: 1 }]));
      expect(await tab.next()).toMatchObject({
        type: "refused",
        reason: "closed",
        actionId: ACTION,
      });
      expect(await tab.next()).toMatchObject({ type: "state", state: { ask: "closed" } });
      tab.send({
        version,
        type: "answer",
        itemId: "rollout",
        rev: 1,
        choice: ["Behind a flag"],
        when,
      });
      expect(await tab.next()).toMatchObject({
        type: "refused",
        reason: "answer",
        itemId: "rollout",
      });
      expect(await tab.next()).toMatchObject({ type: "state", state: { ask: "closed" } });
      const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      expect(read.kind === "events" && read.events).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("a draft held before the close is restored, before the closed message", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(undefined, lifecycleAsk);
      expect(fixture.core.holdDraft(askId, lifecycleDraftRecord as DraftRecord)).toBe(true);
      await fixture.core.update({ askId, actions: [{ action: "close" }] });
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      const types = [];
      for (let n = 0; n < 4; n += 1) types.push(((await tab.next()) as { type: string }).type);
      expect(types).toEqual(["board", "state", "draft", "closed"]);
    } finally {
      await fixture.host.close();
    }
  });
});
