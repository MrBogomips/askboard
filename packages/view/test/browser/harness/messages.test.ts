import { describe, expect, test } from "bun:test";
import { type AnswerCommand, BOARD_PROTOCOL_VERSION, type PageMessage } from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import {
  orderProblems,
  pageHalf,
  pageHalfProblems,
  pageMessagesOf,
  presenceMessagesOf,
  samePageMessage,
  summary,
} from "./messages.ts";
import { replayTranscripts } from "./transcripts.ts";

const connect: PageMessage = {
  version: BOARD_PROTOCOL_VERSION,
  type: "connect",
  token: PLAIN_CHOICE.token,
};
const answer: AnswerCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "answer",
  itemId: "database",
  rev: 1,
  choice: ["PostgreSQL"],
  when: "2026-10-29T09:41:27Z",
};
const at = (when: string) => ({ ...answer, when });
const clicked = {
  from: Date.parse("2026-10-30T10:00:00.400Z"),
  to: Date.parse("2026-10-30T10:00:01.200Z"),
};

describe("samePageMessage", () => {
  test("compares a connect exactly", () => {
    expect(samePageMessage({ ...connect }, connect)).toBe(true);
    expect(samePageMessage({ ...connect, token: "x".repeat(22) }, connect)).toBe(false);
    expect(samePageMessage({ ...connect, extra: 1 }, connect)).toBe(false);
  });

  test("compares an answer exactly but for when, which only has to be a UTC time", () => {
    expect(samePageMessage(at("2026-10-30T10:00:00.512Z"), answer)).toBe(true);
    expect(samePageMessage({ ...answer, choice: ["SQLite"] }, answer)).toBe(false);
    expect(samePageMessage({ ...answer, rev: 2 }, answer)).toBe(false);
    expect(samePageMessage(at("2026-10-30 10:00:00"), answer)).toBe(false);
    expect(samePageMessage(at("2026-10-30T10:00:00+01:00"), answer)).toBe(false);
  });

  test("with the click's window, when must fall in it, to the second it was stamped in", () => {
    expect(samePageMessage(at("2026-10-30T10:00:00.512Z"), answer, clicked)).toBe(true);
    // Stamped to the whole second the click started in.
    expect(samePageMessage(at("2026-10-30T10:00:00Z"), answer, clicked)).toBe(true);
    expect(samePageMessage(at("2026-10-30T09:59:59Z"), answer, clicked)).toBe(false);
    // Stamped when it was sent, seconds after the click.
    expect(samePageMessage(at("2026-10-30T10:00:03Z"), answer, clicked)).toBe(false);
  });

  test("never matches a value that is not a message", () => {
    expect(samePageMessage("connect", connect)).toBe(false);
    expect(samePageMessage(null, answer)).toBe(false);
  });
});

describe("pageHalf", () => {
  test("lists what the board page sends in the plain-choice session, by socket", () => {
    const half = pageHalf(replayTranscripts.plainChoice);
    expect(half.map(({ socket, message }) => `${socket} ${message.type}`)).toEqual([
      "1 connect",
      "1 answer",
      "2 connect",
    ]);
  });

  test("puts the session's own token in every connect", () => {
    const token = "A".repeat(22);
    const half = pageHalf(replayTranscripts.restart, token);
    expect(half).toEqual([{ socket: 1, message: { ...connect, token } }]);
  });
});

describe("pageHalfProblems", () => {
  const expected = [
    { socket: 1, message: connect },
    { socket: 1, message: answer },
    { socket: 2, message: connect },
  ];

  test("finds nothing when every socket sent what the transcript says", () => {
    const sent = [
      { socket: 1, message: connect },
      { socket: 1, message: at("2026-10-30T10:00:01Z") },
      { socket: 2, message: connect },
    ];
    expect(pageHalfProblems(sent, expected, clicked)).toEqual([]);
  });

  test("names a socket's wrong, missing and extra messages", () => {
    const sent = [
      { socket: 1, message: connect },
      { socket: 1, message: { ...answer, choice: ["SQLite"] } },
      { socket: 1, message: answer },
      { socket: 3, message: connect },
    ];
    expect(pageHalfProblems(sent, expected)).toEqual([
      "socket 1, message 2: sent answer database rev 1 [SQLite], expected answer database rev 1 [PostgreSQL]",
      "socket 1, message 3: sent answer database rev 1 [PostgreSQL], expected nothing",
      "socket 2, message 1: sent nothing, expected connect",
      "socket 3, message 1: sent connect, expected nothing",
    ]);
  });
});

describe("orderProblems", () => {
  const transcript = replayTranscripts.resendAfterDrop;
  const frame = (dir: "sent" | "received", message: unknown) => ({
    dir,
    text: JSON.stringify(message),
  });
  const board = { version: BOARD_PROTOCOL_VERSION, type: "board" };
  const state = { version: BOARD_PROTOCOL_VERSION, type: "state" };
  const first = {
    url: "ws://x/ws/a",
    frames: [frame("sent", connect), frame("received", board), frame("received", state)],
  };

  test("finds nothing when each page message follows the host's messages before it", () => {
    const second = { ...first, frames: [...first.frames, frame("sent", answer)] };
    expect(orderProblems([first, second], transcript)).toEqual([]);
  });

  test("names a page message sent before the host's messages it must follow on its socket", () => {
    const second = {
      ...first,
      frames: [
        frame("sent", connect),
        frame("received", board),
        frame("sent", answer),
        frame("received", state),
      ],
    };
    expect(orderProblems([first, second], transcript)).toEqual([
      "socket 2 sent answer database rev 1 [PostgreSQL] after 1 of the 2 host messages before it (board, state)",
    ]);
  });

  test("counts only sockets that sent something, as the transcript numbers them", () => {
    const refused = { url: "ws://x/ws/a", frames: [] };
    const second = { ...first, frames: [...first.frames, frame("sent", answer)] };
    expect(orderProblems([first, refused, second], transcript)).toEqual([]);
    expect(pageMessagesOf([first, refused, second]).map(({ socket }) => socket)).toEqual([1, 2, 2]);
  });

  test("keeps text that is not JSON as it was sent", () => {
    const odd = { url: "ws://x/ws/a", frames: [{ dir: "sent" as const, text: "hello" }] };
    expect(pageMessagesOf([odd])).toEqual([{ socket: 1, message: "hello" }]);
  });
});

describe("presence messages", () => {
  // Push delivery's presence is no transcript's: the comparisons leave it out, and it is listed
  // on its own (task 5.3).
  const frame = (dir: "sent" | "received", message: unknown) => ({
    dir,
    text: JSON.stringify(message),
  });
  const idle = { version: "1.0", type: "presence", working: false };
  const working = { ...idle, working: true };
  const board = { version: "1.0", type: "board" };
  const state = { version: "1.0", type: "state" };
  const first = {
    url: "ws://x/ws/a",
    frames: [
      frame("sent", connect),
      frame("received", board),
      frame("sent", idle),
      frame("received", state),
      frame("sent", working),
    ],
  };
  const second = {
    url: "ws://x/ws/a",
    frames: [
      frame("sent", connect),
      frame("received", board),
      frame("sent", working),
      frame("received", state),
      frame("sent", answer),
    ],
  };

  test("are left out of what the page sent for the transcript, and of its order", () => {
    expect(pageMessagesOf([first, second])).toEqual([
      { socket: 1, message: connect },
      { socket: 2, message: connect },
      { socket: 2, message: answer },
    ]);
    expect(orderProblems([first, second], replayTranscripts.resendAfterDrop)).toEqual([]);
  });

  test("are listed on their own, by socket", () => {
    expect(presenceMessagesOf([first, second])).toEqual([
      { socket: 1, message: idle },
      { socket: 1, message: working },
      { socket: 2, message: working },
    ]);
  });
});

describe("summary", () => {
  test("names a message by its type and, for an answer, what it answers", () => {
    expect(summary(connect)).toBe("connect");
    expect(summary(answer)).toBe("answer database rev 1 [PostgreSQL]");
    expect(summary({ type: "draft" })).toBe("draft");
    expect(summary("not json")).toBe('"not json"');
    expect(summary(undefined)).toBe("nothing");
  });
});

describe("protocol 1.1 against E1's transcripts (ask-lifecycle, design decision 6)", () => {
  const act = (when: string, extra: Record<string, unknown> = {}) => ({
    version: BOARD_PROTOCOL_VERSION,
    type: "act",
    actionId: "AAAAAAAAAAAAAAAAAAAAAA",
    acts: [{ type: "answer", itemId: "database", rev: 1, choice: ["PostgreSQL"], when, ...extra }],
  });

  test("an act command of one answer is the transcript's answer, its when checked as a time", () => {
    expect(samePageMessage(act("2026-10-30T10:00:00.512Z"), answer, clicked)).toBe(true);
    expect(samePageMessage(act("2026-10-30T09:59:59Z"), answer, clicked)).toBe(false);
    expect(samePageMessage(act("2026-10-30T10:00:00.512Z", { note: "x" }), answer)).toBe(false);
    expect(samePageMessage(act("2026-10-30T10:00:00.512Z", { choice: ["SQLite"] }), answer)).toBe(
      false,
    );
    expect(samePageMessage({ ...act("2026-10-30T10:00:00Z"), actionId: "short" }, answer)).toBe(
      false,
    );
    const two = act("2026-10-30T10:00:00Z");
    expect(samePageMessage({ ...two, acts: [...two.acts, ...two.acts] }, answer)).toBe(false);
  });

  test("draft records are the board's own, never in a transcript: they are left out", () => {
    const draft = { version: BOARD_PROTOCOL_VERSION, type: "draft", record: {} };
    const socket = {
      url: "ws://x/ws/a",
      frames: [
        { dir: "sent" as const, text: JSON.stringify(connect) },
        { dir: "sent" as const, text: JSON.stringify(draft) },
      ],
    };
    expect(pageMessagesOf([socket])).toEqual([{ socket: 1, message: connect }]);
    expect(summary(act("2026-10-30T10:00:00Z"))).toBe("act [answer database rev 1 [PostgreSQL]]");
  });
});
