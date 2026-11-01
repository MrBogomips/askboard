import { afterEach, describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  BOARD_TOKEN_HEADER,
  type HostMessage,
  type PageMessage,
} from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { agentWaitsTranscript } from "./asker.ts";
import type { BoardSession } from "./session.ts";
import { startTestServer } from "./test-server.ts";
import { type ReplayTranscript, replayTranscripts } from "./transcripts.ts";
import { fixtureViewBuild } from "./view-build.ts";

const view = fixtureViewBuild();
const connect: PageMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "connect",
  token: PLAIN_CHOICE.token,
};
const answer: PageMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-30T10:00:00Z",
};

const sessions: BoardSession[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const session of sessions.splice(0)) await session.close();
});

const start = async (transcript: ReplayTranscript) => {
  const session = await startTestServer({ transcript, view });
  sessions.push(session);
  return session;
};

// A board page stand-in: a WebSocket client that keeps what it receives and how it closed.
const page = (session: BoardSession, origin = new URL(session.link).origin) => {
  const url = new URL(session.link);
  url.protocol = "ws:";
  url.pathname = url.pathname.replace("/b/", "/ws/");
  url.search = "";
  const socket = new WebSocket(url.href, { headers: { Origin: origin } } as unknown as string[]);
  sockets.push(socket);
  const received: (HostMessage | { readonly type: "origin" | "agent" })[] = [];
  const waiters: (() => void)[] = [];
  socket.addEventListener("message", (event) => {
    received.push(JSON.parse(String(event.data)));
    for (const wake of waiters.splice(0)) wake();
  });
  const opened = new Promise<boolean>((resolve) => {
    socket.addEventListener("open", () => resolve(true));
    socket.addEventListener("error", () => resolve(false));
  });
  const closed = new Promise<number>((resolve) => {
    socket.addEventListener("close", (event) => resolve(event.code));
  });
  const types = () => received.map((message) => message.type);
  const until = async (count: number) => {
    while (received.length < count) await new Promise<void>((wake) => waiters.push(wake));
    return types();
  };
  const send = (message: PageMessage) => socket.send(JSON.stringify(message));
  return { opened, closed, received, types, until, send };
};

describe("the test server: HTTP", () => {
  test("serves the routes as answerHttp says and keeps each request without its query", async () => {
    const session = await start(replayTranscripts.opening);
    const board = await fetch(session.link);
    expect(board.status).toBe(BOARD_RESPONSES.boardPage.status);
    expect(board.headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
    const manifest = await fetch(new URL("/m", session.link), {
      headers: { [BOARD_TOKEN_HEADER]: PLAIN_CHOICE.token },
    });
    expect(await manifest.text()).toBe(view.manifestText);
    expect(session.requests()).toEqual([`GET /b/${PLAIN_CHOICE.askId}`, "GET /m"]);
    expect(session.link).toMatch(
      new RegExp(`^http://127\\.0\\.0\\.1:\\d+/b/${PLAIN_CHOICE.askId}\\?t=${PLAIN_CHOICE.token}$`),
    );
  });

  test("refuses an upgrade from another origin, which then counts as no socket", async () => {
    const session = await start(replayTranscripts.opening);
    const foreign = page(session, "http://attacker.example");
    expect(await foreign.opened).toBe(false);
    const board = page(session);
    expect(await board.opened).toBe(true);
    board.send(connect);
    expect(await board.until(2)).toEqual(["board", "state"]);
    expect(session.problems()).toEqual([]);
  });

  test("closes every socket and stops listening, once or twice", async () => {
    const session = await start(replayTranscripts.opening);
    const board = page(session);
    await board.opened;
    await session.close();
    await session.close();
    expect(await board.closed).toBeGreaterThan(0);
    await expect(fetch(session.link)).rejects.toThrow();
  });
});

describe("the test server: replaying the host's half", () => {
  test("the plain-choice session, its takeover and its discard", async () => {
    const session = await start(replayTranscripts.plainChoice);
    const first = page(session);
    await first.opened;
    first.send(connect);
    expect(await first.until(2)).toEqual(["board", "state"]);
    first.send(answer);
    expect(await first.until(3)).toEqual(["board", "state", "state"]);
    await session.collected();
    expect(await first.until(4)).toEqual(["board", "state", "state", "receipt"]);
    const second = page(session);
    await second.opened;
    second.send(connect);
    expect(await first.until(5)).toEqual(["board", "state", "state", "receipt", "moved"]);
    expect(await first.closed).toBe(BOARD_CLOSE_CODES.moved);
    expect(await second.until(2)).toEqual(["board", "state"]);
    await session.exit();
    expect(await second.until(3)).toEqual(["board", "state", "discarded"]);
    expect(await second.closed).toBe(BOARD_CLOSE_CODES.discarded);
    expect(session.problems()).toEqual([]);
    // The session has exited: its link is a discarded ask's, and no board reconnects.
    expect((await fetch(session.link)).status).toBe(BOARD_RESPONSES.discardedLink.status);
    expect(await page(session).opened).toBe(false);
  });

  test("an answer queued across a drop, with the network down until restored", async () => {
    const session = await start(replayTranscripts.resendAfterDrop);
    const first = page(session);
    await first.opened;
    first.send(connect);
    await first.until(2);
    await session.drop();
    expect(await first.closed).toBe(1006);
    expect(await page(session).opened).toBe(false);
    await session.restore();
    const second = page(session);
    expect(await second.opened).toBe(true);
    second.send(connect);
    expect(await second.until(2)).toEqual(["board", "state"]);
    second.send(answer);
    expect(await second.until(3)).toEqual(["board", "state", "state"]);
    expect(second.received[2]).toMatchObject({ state: { ask: "answered" } });
    expect(session.problems()).toEqual([]);
  });

  test("a restart: the old token opens nothing, and its connect is refused and closed", async () => {
    const session = await start(replayTranscripts.restartAfterOpen);
    const first = page(session);
    await first.opened;
    first.send(connect);
    await first.until(2);
    await session.restart();
    expect(await first.closed).toBe(1006);
    const manifest = await fetch(new URL("/m", session.link), {
      headers: { [BOARD_TOKEN_HEADER]: PLAIN_CHOICE.token },
    });
    expect(manifest.status).toBe(BOARD_RESPONSES.tokenRefused.status);
    const second = page(session);
    await second.opened;
    second.send(connect);
    expect(await second.until(1)).toEqual(["refused"]);
    expect(await second.closed).toBe(BOARD_CLOSE_CODES.refused);
    expect(session.problems()).toEqual([]);
  });

  test("the header's messages, and the agent's wait at its gate (task 8.5)", async () => {
    const session = await start(
      agentWaitsTranscript({ project: "order-service", gitUser: "Paola Greco" }),
    );
    const board = page(session);
    await board.opened;
    board.send(connect);
    expect(await board.until(4)).toEqual(["board", "state", "origin", "agent"]);
    await session.agentWaits();
    expect(await board.until(5)).toEqual(["board", "state", "origin", "agent", "agent"]);
    expect(board.received[4]).toMatchObject({ status: "waiting" });
    board.send(answer);
    expect((await board.until(7)).slice(5)).toEqual(["state", "agent"]);
    expect(board.received[6]).toMatchObject({ status: "working" });
    expect(session.problems()).toEqual([]);
  });

  test("reports page messages off the transcript", async () => {
    const session = await start(replayTranscripts.opening);
    const board = page(session);
    await board.opened;
    board.send(connect);
    await board.until(2);
    board.send(answer);
    await Bun.sleep(50);
    expect(session.problems()).toEqual([
      "socket 1 sent answer database rev 1 [PostgreSQL], which the transcript does not expect",
    ]);
  });
});
