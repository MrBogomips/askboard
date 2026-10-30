import { afterAll, describe, expect, test } from "bun:test";
import { connect, type Socket } from "node:net";
import {
  BOARD_CLOSE_CODES,
  BOARD_HOST,
  BOARD_PROTOCOL_VERSION,
  REFUSAL_DETAIL_MAX_CHARS,
} from "@askboard/contract";
import {
  PLAIN_CHOICE,
  plainChoiceBoardDocument,
  type Transcript,
  type TranscriptStep,
  transcripts,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { AnswerCommandInput, AnswerOutcome, BoardView, CoreEvent } from "@askboard/core";
import { createBoardHost, type HostCore } from "../../src/board-host/index.ts";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  request,
  startHost,
  writeView,
} from "./helpers.ts";

// Board-host spec, Board protocol over a WebSocket, One live board per ask and Delivery receipt
// (task 6.4): the board page's half of each of Track 0's transcripts, replayed against board-host
// around the real ask-core, gets exactly the host's half; then the paths no transcript records.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = PLAIN_CHOICE;
const itemId = plainChoiceBoardDocument.items[0].id;
const when = "2026-10-29T09:41:27Z";
const answer = { version, type: "answer", itemId, rev: 1, choice: ["PostgreSQL"], when };

const REFUSING: AnswerOutcome = {
  ok: false,
  refusal: "answered",
  detail: "the question is already answered",
};

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

const replay = async (name: string, transcript: Transcript) => {
  // `restart` is a new session process: it holds another ask, never this one.
  const restarted = name === "restart";
  const fixture = startHost({
    ports: await freeRange(1),
    tokens: [restarted ? "nnnnnnnnnnnnnnnnnnnnnN" : transcript.token],
  });
  const { port } = await fixture.ask(restarted ? "another-ask" : transcript.askId);
  const sockets = new Map<number, BoardSocket>();
  const socketOf = async (step: TranscriptStep & { socket: number }) => {
    const known = sockets.get(step.socket);
    if (known !== undefined) return known;
    const opened = await openSocket(port, transcript.askId);
    sockets.set(step.socket, opened);
    return opened;
  };
  try {
    for (const step of transcript.steps) {
      if (step.from === "page") {
        (await socketOf(step)).send("message" in step ? step.message : step.invalid);
      } else if (step.from === "host") {
        const socket = await socketOf(step);
        if ("message" in step) expectMessage(await socket.next(), step.message);
        else expect(await socket.closed()).toBe(step.close);
      } else if (step.from === "network") {
        (await socketOf(step)).socket.terminate();
      } else if (step.from === "session" && step.event === "collected") {
        // What `collect` does: read the events after the first cursor, then mark them read.
        const read = fixture.core.read(transcript.askId, `${fixture.core.epoch}.0`);
        if (read.kind !== "events") throw new Error(`read ${read.kind}`);
        fixture.core.markRead(transcript.askId, read.cursor);
      } else if (step.from === "session") {
        fixture.core.discardAll("session-exit");
      }
    }
    // Nothing the transcript does not record arrives afterwards.
    await Bun.sleep(50);
    for (const socket of sockets.values()) expect(socket.pending).toEqual([]);
  } finally {
    for (const socket of sockets.values()) socket.socket.terminate();
    await fixture.host.close();
  }
  return fixture;
};

describe("Track 0's transcripts, replayed from the board page's side", () => {
  for (const [name, transcript] of Object.entries(transcripts)) {
    test(`${name}: board-host sends exactly the host's half`, async () => {
      const fixture = await replay(name, transcript);
      expect(fixture.reported).toEqual([]);
    });
  }

  test("plainChoice logs the answer once, with the board's time", async () => {
    const fixture = await replay("plainChoice", transcripts.plainChoice as Transcript);
    const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
    expect(read.kind === "events" && read.events.map((event) => event.type)).toEqual([
      "answer",
      "discarded",
    ]);
    expect(read.kind === "events" && read.events[0]).toMatchObject({
      choice: ["PostgreSQL"],
      when,
    });
  });

  test("duplicateAnswer and resendAfterDrop leave one answer in the log", async () => {
    for (const name of ["duplicateAnswer", "resendAfterDrop"]) {
      const fixture = await replay(name, transcripts[name] as Transcript);
      const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      expect(read.kind === "events" && read.events.length).toBe(1);
    }
  });
});

// A board host around a fake core, with one plain-choice ask and the answers it was given.
const fakeHost = async (outcome: AnswerOutcome) => {
  const commands: [string, AnswerCommandInput][] = [];
  const listeners = new Set<(event: CoreEvent) => void>();
  const view: BoardView = {
    document: plainChoiceBoardDocument,
    state: "waiting",
    questions: [{ itemId, rev: 1 }],
  };
  const core: HostCore = {
    board: (id) => (id === askId ? view : undefined),
    answer: (id, command) => {
      commands.push([id, command]);
      return outcome;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const reported: unknown[] = [];
  const host = createBoardHost({
    core: () => core,
    view: writeView(),
    report: (error) => reported.push(error),
    ports: await freeRange(1),
    token: () => token,
  });
  const link = new URL(await host.address.link(askId));
  const socket = await openSocket(Number(link.port), askId);
  socket.send({ version, type: "connect", token });
  await socket.next();
  await socket.next();
  return { host, socket, commands, reported, port: Number(link.port) };
};

describe("answer commands", () => {
  test("reach the core as the board stamped them", async () => {
    const { host, socket, commands } = await fakeHost({ ok: false, refusal: "when", detail: "x" });
    try {
      socket.send({ ...answer, choice: ["SQLite"], when: "2026-10-30T08:00:00.250Z" });
      await socket.next();
      expect(commands).toEqual([
        [askId, { itemId, rev: 1, choice: ["SQLite"], when: "2026-10-30T08:00:00.250Z" }],
      ]);
    } finally {
      await host.close();
    }
  });

  test("a refused one names the item and the reason, then the state follows", async () => {
    const { host, socket } = await fakeHost({
      ok: false,
      refusal: "stale-rev",
      detail: "the question has a newer revision",
    });
    try {
      socket.send(answer);
      expect(await socket.next()).toEqual({
        version,
        type: "refused",
        reason: "answer",
        itemId,
        detail: "the question has a newer revision",
      });
      expect(await socket.next()).toEqual({
        version,
        type: "state",
        state: { ask: "waiting", questions: [{ itemId, rev: 1, state: "open" }] },
      });
    } finally {
      await host.close();
    }
  });
});

describe("refusals on an accepted socket leave it open and the ask unchanged", () => {
  const cases: [string, unknown, string][] = [
    ["a second connect", { version, type: "connect", token }, "message"],
    ["a message of another major", { ...answer, version: "2.0" }, "version"],
    ["a message without a version", { type: "answer" }, "version"],
    ["a message that is not an object", [answer], "message"],
    ["an unknown field", { ...answer, recommended: true }, "message"],
    ["a type only the host sends", { version, type: "state" }, "message"],
    ["an inherited name as the type", { version, type: "constructor" }, "message"],
  ];
  for (const [what, message, reason] of cases) {
    test(`${what} is refused with reason ${reason}`, async () => {
      const { host, socket, commands } = await fakeHost(REFUSING);
      try {
        socket.send(message);
        const refusal = await socket.next();
        expect(refusal).toMatchObject({ version, type: "refused", reason });
        expect(validateBoardMessage("toPage", refusal).ok).toBe(true);
        socket.send({ version, type: "connect", token });
        expect(await socket.next()).toMatchObject({ type: "refused", reason: "message" });
        expect(commands).toEqual([]);
      } finally {
        await host.close();
      }
    });
  }

  test("text that is not JSON, and a binary frame, are refused with reason message", async () => {
    const { host, socket } = await fakeHost(REFUSING);
    try {
      socket.socket.send("{not json");
      expect(await socket.next()).toMatchObject({ type: "refused", reason: "message" });
      socket.socket.send(Buffer.from(JSON.stringify(answer)), { binary: true });
      expect(await socket.next()).toMatchObject({ type: "refused", reason: "message" });
    } finally {
      await host.close();
    }
  });

  test("a refusal's detail is cut to the contract's limit", async () => {
    const { host, socket } = await fakeHost(REFUSING);
    try {
      socket.send({ version, type: "x".repeat(5_000) });
      const refusal = (await socket.next()) as { detail: string };
      expect(Array.from(refusal.detail).length).toBeLessThanOrEqual(REFUSAL_DETAIL_MAX_CHARS);
      expect(validateBoardMessage("toPage", refusal).ok).toBe(true);
    } finally {
      await host.close();
    }
  });

  test("a message over the payload limit closes the socket, appending nothing", async () => {
    const { host, socket, commands } = await fakeHost(REFUSING);
    try {
      socket.send({ ...answer, choice: ["x".repeat(200_000)] });
      expect(await socket.closed()).toBe(1009);
      expect(commands).toEqual([]);
    } finally {
      await host.close();
    }
  });
});

describe("before connect is accepted", () => {
  const firstMessages: [string, unknown, string][] = [
    ["text that is not JSON", "{", "token"],
    ["an answer", answer, "token"],
    ["a connect without a token", { version, type: "connect" }, "token"],
    ["a connect of major 2", { version: "2.0", type: "connect", token }, "version"],
  ];
  for (const [what, message, reason] of firstMessages) {
    test(`${what} is refused with reason ${reason} and closed with 4403`, async () => {
      const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
      try {
        const { port } = await fixture.ask(askId);
        const socket = await openSocket(port, askId);
        if (typeof message === "string") socket.socket.send(message);
        else socket.send(message);
        expect(await socket.next()).toMatchObject({ version, type: "refused", reason });
        expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
        expect(socket.pending).toEqual([]);
      } finally {
        await fixture.host.close();
      }
    });
  }

  test("a binary first frame is refused with reason token", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const socket = await openSocket(port, askId);
      socket.socket.send(Buffer.from(JSON.stringify({ version, type: "connect", token })), {
        binary: true,
      });
      expect(await socket.next()).toMatchObject({ type: "refused", reason: "token" });
      expect(await socket.closed()).toBe(BOARD_CLOSE_CODES.refused);
    } finally {
      await fixture.host.close();
    }
  });

  test("a socket that sends nothing receives nothing", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const socket = await openSocket(port, askId);
      fixture.core.answer(askId, { itemId, rev: 1, choice: ["SQLite"], when });
      await Bun.sleep(50);
      expect(socket.pending).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("one live board per ask", () => {
  test("the older tab is told the board moved and closed; its messages go nowhere", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const first = await openSocket(port, askId);
      first.send({ version, type: "connect", token });
      await first.next();
      await first.next();
      const second = await openSocket(port, askId);
      second.send({ version, type: "connect", token });
      expect(await first.next()).toEqual({ version, type: "moved" });
      expect(await first.closed()).toBe(BOARD_CLOSE_CODES.moved);
      expect(await second.next()).toMatchObject({ type: "board" });
      expect(await second.next()).toMatchObject({ type: "state" });
      // Closing the moved tab discards nothing, and the live tab still answers.
      second.send(answer);
      expect(await second.next()).toMatchObject({ type: "state", state: { ask: "answered" } });
      expect(fixture.core.board(askId)?.state).toBe("answered");
    } finally {
      await fixture.host.close();
    }
  });

  test("closing the live tab discards nothing", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      await tab.next();
      await tab.next();
      tab.socket.close();
      await tab.closed();
      expect(fixture.core.board(askId)?.state).toBe("waiting");
      // A reconnect gets the board back.
      const again = await openSocket(port, askId);
      again.send({ version, type: "connect", token });
      expect(await again.next()).toMatchObject({ type: "board" });
    } finally {
      await fixture.host.close();
    }
  });
});

describe("delivery receipts", () => {
  test("are sent once per answer, when received passes it", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      await tab.next();
      await tab.next();
      tab.send(answer);
      await tab.next();
      const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      if (read.kind !== "events") throw new Error(read.kind);
      fixture.core.markRead(askId, read.cursor);
      expect(await tab.next()).toEqual({ version, type: "receipt", itemId, receipt: "delivered" });
      // The discard raises nothing more that is an answer.
      fixture.core.discardAll("session-exit");
      expect(await tab.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
      expect(await tab.closed()).toBe(BOARD_CLOSE_CODES.discarded);
      expect(tab.pending).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("closing the host", () => {
  test("closes every socket, accepted or not, and refuses new ones", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    const { port } = await fixture.ask(askId);
    const live = await openSocket(port, askId);
    live.send({ version, type: "connect", token });
    await live.next();
    await live.next();
    const waiting = await openSocket(port, askId);
    await fixture.host.close();
    expect(await live.closed()).toBe(1001);
    expect(await waiting.closed()).toBe(1001);
    await expect(openSocket(port, askId)).rejects.toThrow();
  });

  test("ends sockets that do not answer the close within its bound", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    const { port } = await fixture.ask(askId);
    const silent = await silentSocket(port, askId);
    const started = Date.now();
    await fixture.host.close();
    expect(Date.now() - started).toBeLessThan(1_000);
    silent.destroy();
  });
});

// A WebSocket client that completes the opening handshake and then never answers a close frame.
const silentSocket = (port: number, path: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = connect({ host: BOARD_HOST, port }, () => {
      socket.write(
        [
          `GET /ws/${path} HTTP/1.1`,
          `Host: ${BOARD_HOST}:${port}`,
          `Origin: http://${BOARD_HOST}:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.once("data", (data) => {
      if (String(data).startsWith("HTTP/1.1 101")) resolve(socket);
      else reject(new Error(String(data).split("\r\n")[0]));
    });
    socket.once("error", reject);
  });

describe("a failure inside board-host", () => {
  test("is reported, answered with 500 over HTTP, and sends nothing over a socket", async () => {
    const failure = new Error("the core failed");
    const core: HostCore = {
      board: () => {
        throw failure;
      },
      answer: () => REFUSING,
      subscribe: () => () => undefined,
    };
    const reported: unknown[] = [];
    const host = createBoardHost({
      core: () => core,
      view: writeView(),
      report: (error) => reported.push(error),
      ports: await freeRange(1),
      token: () => token,
    });
    try {
      const link = new URL(await host.address.link(askId));
      const port = Number(link.port);
      const page = await request(port, `${link.pathname}${link.search}`);
      expect(page.status).toBe(500);
      expect(page.body).not.toContain("the core failed");
      const socket = await openSocket(port, askId);
      socket.send({ version, type: "connect", token });
      await Bun.sleep(50);
      expect(socket.pending).toEqual([]);
      expect(reported).toEqual([failure, failure]);
    } finally {
      await host.close();
    }
  });
});

describe("a peer that sends without reading", () => {
  // A masked text frame, as a client sends it; payloads under 126 bytes only.
  const frame = (text: string) => {
    const payload = Buffer.from(text);
    const mask = Buffer.from([1, 2, 3, 4]);
    const masked = payload.map((byte, at) => byte ^ (mask[at % 4] ?? 0));
    return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
  };

  test("is ended once its socket holds too much unsent, and the host keeps serving", async () => {
    const fixture = startHost({ ports: await freeRange(1), tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const peer = await silentSocket(port, askId);
      let ended = false;
      peer.on("close", () => {
        ended = true;
      });
      peer.on("error", () => undefined);
      peer.pause();
      peer.write(frame(JSON.stringify({ version, type: "connect", token })));
      const refused = frame("x");
      for (let sent = 0; sent < 40_000 && !ended; sent += 1) {
        if (!peer.write(refused)) await Bun.sleep(1);
      }
      // Reading again drains what reached the peer: an ended socket then closes, an open one stays.
      await Bun.sleep(100);
      peer.resume();
      for (let tries = 0; tries < 200 && !ended; tries += 1) await Bun.sleep(10);
      expect(ended).toBe(true);
      const tab = await openSocket(port, askId);
      tab.send({ version, type: "connect", token });
      expect(await tab.next()).toMatchObject({ type: "board" });
    } finally {
      await fixture.host.close();
    }
  });
});
