import { describe, expect, test } from "bun:test";
import { BOARD_CLOSE_CODES, BOARD_PROTOCOL_VERSION, type PageMessage } from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { Replay, type ReplaySocket } from "./replay.ts";
import { OVERLOADED_CLOSE_CODE, type ReplayTranscript, replayTranscripts } from "./transcripts.ts";

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
  when: "2026-10-30T10:00:00.250Z",
};

// A socket that records what the replay does to it, as one line per act.
const fakeSocket = (log: string[], name: string): ReplaySocket => ({
  send: (text) => log.push(`${name} <- ${JSON.parse(text).type}`),
  close: (code) => log.push(`${name} closed ${code}`),
  terminate: () => log.push(`${name} terminated`),
});

const start = (transcript: ReplayTranscript, events: string[] = []) => {
  const log: string[] = [];
  const replay = new Replay(transcript.steps, {
    onExit: () => events.push("exit"),
    onRestart: () => events.push("restart"),
    onDrop: () => events.push("drop"),
  });
  const open = () => replay.attach(fakeSocket(log, `s${replay.sockets + 1}`));
  const send = (socket: number, message: unknown) =>
    replay.receive(socket, typeof message === "string" ? message : JSON.stringify(message));
  return { replay, log, open, send };
};

describe("Replay: the host's half of a transcript", () => {
  test("answers a connect with the board document and the state", () => {
    const { replay, log, open, send } = start(replayTranscripts.opening);
    expect(open()).toBe(1);
    expect(log).toEqual([]);
    send(1, connect);
    expect(log).toEqual(["s1 <- board", "s1 <- state"]);
    expect(replay.finished).toBe(true);
    expect(replay.problems()).toEqual([]);
  });

  test("plays the plain-choice session through its gates and closes with its codes", async () => {
    const events: string[] = [];
    const { replay, log, open, send } = start(replayTranscripts.plainChoice, events);
    open();
    send(1, connect);
    send(1, answer);
    expect(replay.position).toBe("the session step collected");
    await replay.trigger("collected");
    open();
    send(2, connect);
    await replay.trigger("exit");
    expect(log).toEqual([
      "s1 <- board",
      "s1 <- state",
      "s1 <- state",
      "s1 <- receipt",
      "s1 <- moved",
      `s1 closed ${BOARD_CLOSE_CODES.moved}`,
      "s2 <- board",
      "s2 <- state",
      "s2 <- discarded",
      `s2 closed ${BOARD_CLOSE_CODES.discarded}`,
    ]);
    expect(events).toEqual(["exit"]);
    expect(replay.finished).toBe(true);
    expect(replay.problems()).toEqual([]);
  });

  test("a gate triggered early waits until the replay reaches it", async () => {
    const { replay, log, open, send } = start(replayTranscripts.collected);
    open();
    send(1, connect);
    const collected = replay.trigger("collected");
    expect(log).toEqual(["s1 <- board", "s1 <- state"]);
    send(1, answer);
    await collected;
    expect(log.at(-1)).toBe("s1 <- receipt");
    expect(replay.problems()).toEqual([]);
  });

  test("a drop terminates the socket, and a restart every open one", async () => {
    const events: string[] = [];
    const drop = start(replayTranscripts.shortDrop, events);
    drop.open();
    drop.send(1, connect);
    await drop.replay.trigger("drop");
    expect(drop.log.at(-1)).toBe("s1 terminated");
    drop.replay.detach(1);
    drop.open();
    drop.send(2, connect);
    expect(drop.replay.finished).toBe(true);

    const restart = start(replayTranscripts.restartAfterOpen, events);
    restart.open();
    restart.send(1, connect);
    await restart.replay.trigger("restart");
    expect(restart.log.at(-1)).toBe("s1 terminated");
    restart.replay.detach(1);
    restart.open();
    restart.send(2, connect);
    expect(restart.log.slice(-2)).toEqual([
      "s2 <- refused",
      `s2 closed ${BOARD_CLOSE_CODES.refused}`,
    ]);
    expect(events).toEqual(["drop", "restart"]);
    expect(restart.replay.problems()).toEqual([]);
  });

  test("a network close ends the socket with its code and takes the network down", async () => {
    const events: string[] = [];
    const { replay, log, open, send } = start(replayTranscripts.overloaded, events);
    open();
    const dropped = replay.trigger("drop");
    send(1, connect);
    await dropped;
    expect(log).toEqual([`s1 closed ${OVERLOADED_CLOSE_CODE}`]);
    expect(events).toEqual(["drop"]);
    replay.detach(1);
    open();
    send(2, connect);
    expect(log.slice(1)).toEqual(["s2 <- board", "s2 <- state"]);
    expect(replay.finished).toBe(true);
    expect(replay.problems()).toEqual([]);
  });

  test("skips host steps for a socket the page has closed, as after a reload", async () => {
    const { replay, log, open, send } = start(replayTranscripts.reload);
    open();
    send(1, connect);
    send(1, answer);
    await replay.trigger("collected");
    replay.detach(1);
    open();
    send(2, connect);
    expect(log.slice(-2)).toEqual(["s2 <- board", "s2 <- state"]);
    expect(log).not.toContain("s1 <- moved");
    expect(replay.finished).toBe(true);
    expect(replay.problems()).toEqual([]);
  });
});

describe("Replay: what it reports", () => {
  test("a message other than the transcript's, naming both", () => {
    const { replay, open, send } = start(replayTranscripts.answered);
    open();
    send(1, connect);
    send(1, { ...answer, choice: ["SQLite"] });
    expect(replay.problems()).toEqual([
      "socket 1 sent answer database rev 1 [SQLite] where the transcript has answer database rev 1 [PostgreSQL]",
    ]);
  });

  test("a message the board protocol refuses, and text that is not JSON", () => {
    const { replay, open, send } = start(replayTranscripts.answered);
    open();
    send(1, { ...connect, token: "short" });
    send(1, "not json");
    expect(replay.problems()).toEqual([
      "socket 1 sent connect where the transcript has connect (they differ in token)",
      'socket 1 sent connect, which the board protocol refuses: /token: must match pattern "^[A-Za-z0-9_-]{22,}$"',
      'socket 1 sent "not json" where the transcript has answer database rev 1 [PostgreSQL]',
      'socket 1 sent "not json", which the board protocol refuses: /: not JSON text',
    ]);
  });

  test("messages the transcript does not expect, on its sockets or another", () => {
    const { replay, open, send } = start(replayTranscripts.opening);
    open();
    send(1, connect);
    send(1, answer);
    open();
    send(2, connect);
    expect(replay.problems()).toEqual([
      "socket 1 sent answer database rev 1 [PostgreSQL], which the transcript does not expect",
      "socket 2 sent connect, which the transcript does not expect",
    ]);
  });

  test("a presence message is no transcript step; one with more than its flag is a problem", () => {
    const { replay, log, open, send } = start(replayTranscripts.answered);
    open();
    send(1, connect);
    send(1, { version: "1.0", type: "presence", working: false });
    send(1, answer);
    expect(log).toContain("s1 <- state");
    expect(replay.problems()).toEqual([]);
    send(1, { version: "1.0", type: "presence", working: true, itemId: "database" });
    expect(replay.problems()).toEqual([
      'socket 1 sent a presence message the contract refuses: /itemId: unknown field "itemId"',
    ]);
  });

  test("a trigger the rest of the transcript has no gate for fails at once", async () => {
    const { replay } = start(replayTranscripts.opening);
    await expect(replay.trigger("exit")).rejects.toThrow(
      "the transcript has no exit step after the one it waits at",
    );
  });

  test("a trigger the replay does not reach in time fails, saying where it waits", async () => {
    const { replay, open } = start(replayTranscripts.collected);
    open();
    await expect(replay.trigger("collected", 50)).rejects.toThrow(
      "the replay did not reach collected within 0.05 s: it waits for socket 1 to send connect",
    );
    expect(replay.position).toBe("socket 1 to send connect");
  });
});

describe("Replay: protocol 1.1's board page against E1's transcripts (ask-lifecycle)", () => {
  const act = {
    version: BOARD_PROTOCOL_VERSION,
    type: "act",
    actionId: "AAAAAAAAAAAAAAAAAAAAAA",
    acts: [
      {
        type: "answer",
        itemId: "database",
        rev: 1,
        choice: ["PostgreSQL"],
        when: "2026-10-30T10:00:00.250Z",
      },
    ],
  };

  test("an act command for the transcript's answer is acknowledged with done before the host's steps", () => {
    const { replay, log, open, send } = start(replayTranscripts.answered);
    open();
    send(1, connect);
    send(1, act);
    expect(log).toEqual(["s1 <- board", "s1 <- state", "s1 <- done", "s1 <- state"]);
    expect(replay.problems()).toEqual([]);
  });

  test("draft records go nowhere and are never out of turn", () => {
    const { replay, log, open, send } = start(replayTranscripts.opening);
    open();
    send(1, {
      version: BOARD_PROTOCOL_VERSION,
      type: "draft",
      record: { delivery: "immediate", questions: {} },
    });
    send(1, connect);
    expect(log).toEqual(["s1 <- board", "s1 <- state"]);
    expect(replay.problems()).toEqual([]);
  });
});
