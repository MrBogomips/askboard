import { describe, expect, test } from "bun:test";
import {
  BOARD_PROTOCOL_VERSION,
  OUTPUT_FORMAT_VERSION,
  PUSH_MESSAGE_PREFACE,
  type PushMessage,
  pushMessageText,
  SCHEMA_IDS,
} from "../src/index.ts";
import {
  type Checked,
  validateAgainst,
  validateClosedEvent,
  validatePresence,
  validatePushMessage,
} from "../src/validate.ts";
import plainChoiceAnswers from "./fixtures/answers/plain-choice.json";

// The push message (output format, design decision 8), the closed event and the board's presence
// message (contract spec, Push message schema, Closed event, Board presence message).
const problemPaths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

const [entry] = plainChoiceAnswers.asks;
const message = {
  versions: { output: OUTPUT_FORMAT_VERSION },
  epoch: plainChoiceAnswers.epoch,
  asks: plainChoiceAnswers.asks,
};

describe("the push message", () => {
  test("holding the plain-choice answer validates", () => {
    const result: Checked<unknown> = validatePushMessage(message);
    expect(result).toEqual({ ok: true, value: message });
  });

  // What collect would return for these entries, and what a push of them would carry.
  const asCollect = (ask: unknown) =>
    validateAgainst(SCHEMA_IDS.collectResult, { ...plainChoiceAnswers, asks: [ask] }).ok;
  const asPush = (ask: unknown) => validatePushMessage({ ...message, asks: [ask] }).ok;

  test.each([
    ["the approved example's", entry],
    ["a waiting ask with no event", { ...entry, state: "waiting", cursor: "k3x9.0", events: [] }],
    [
      "a discarded ask",
      {
        ...entry,
        state: "discarded",
        events: [{ cursor: "k3x9.2", type: "discarded", reason: "session-exit" }],
      },
    ],
    ["an unchecked ask", { ...entry, unchecked: true }],
    ["an entry without its cursor", { ...entry, cursor: undefined }],
    ["an entry with an unknown field", { ...entry, owner: "main" }],
    ["an entry with a state of a later minor", { ...entry, state: "closed" }],
    ["an event of another type", { ...entry, events: [{ cursor: "k3x9.2", type: "postponed" }] }],
    [
      "an answer event without who",
      { ...entry, events: [{ ...entry?.events[0], who: undefined }] },
    ],
  ])("takes %s ask entry exactly when collect's result does", (_case, ask) => {
    const json = JSON.parse(JSON.stringify(ask));
    expect(asPush(json)).toBe(asCollect(json));
  });

  test("a stop block's message lists the open asks, each with its ID, state and cursor", () => {
    const openAsks = [
      { askId: "order-db-choice-x7k2", state: "answered", cursor: "k3x9.1" },
      { askId: "retry-policy-q3m8", state: "waiting", cursor: "k3x9.0" },
    ];
    expect(validatePushMessage({ ...message, openAsks }).ok).toBe(true);
    expect(validatePushMessage({ ...message, openAsks: [] }).ok).toBe(true);
    const withEvents = [{ ...openAsks[0], events: [] }];
    expect(problemPaths(validatePushMessage({ ...message, openAsks: withEvents }))).toEqual([
      "/openAsks/0/events",
    ]);
  });

  test.each([
    ["no ask", { asks: [] }, "/asks"],
    [
      "a result version, which belongs to tool results",
      { versions: { result: "1.0", output: "1.0" } },
      "/versions/result",
    ],
    ["a malformed epoch", { epoch: "K3X9" }, "/epoch"],
    ["an unknown field", { warnings: [] }, "/warnings"],
  ])("with %s fails, naming the field", (_case, change, path) => {
    expect(problemPaths(validatePushMessage({ ...message, ...change }))).toEqual([path]);
  });

  test("of output major 2, or naming no output version, is refused before its schema, naming 1", () => {
    const later = validatePushMessage({ ...message, versions: { output: "2.0" }, extra: 1 });
    expect(later).toMatchObject({ ok: false, reason: "version" });
    expect(problemPaths(later)).toEqual(["/versions/output"]);
    if (!later.ok) expect(later.problems[0]?.message).toContain("supports version 1");
    expect(validatePushMessage({ ...message, versions: {} })).toMatchObject({ reason: "version" });
    expect(validatePushMessage([])).toMatchObject({ reason: "version" });
    expect(validatePushMessage({ ...message, versions: { output: "1.2" } }).ok).toBe(true);
  });

  test("is carried as one preface line, then the JSON", () => {
    expect(PUSH_MESSAGE_PREFACE).toBe(
      "AskBoard: the user acted on your ask. Skip any event whose seq you have seen.",
    );
    const text = pushMessageText(message as PushMessage);
    const [preface, json, ...rest] = text.split("\n");
    expect(preface).toBe(PUSH_MESSAGE_PREFACE);
    expect(rest).toEqual([]);
    expect(JSON.parse(json ?? "")).toEqual(message);
  });
});

describe("the closed event", () => {
  const closed = { cursor: "k3x9.2", type: "closed", reason: "agent-finished" } as const;

  test("of a finished subagent's ask validates", () => {
    expect(validateClosedEvent(closed)).toEqual({ ok: true, value: closed });
  });

  test.each([
    ["the agent's own close", { reason: "agent" }, "/reason"],
    ["another type", { type: "discarded" }, "/type"],
    ["a cursor without its epoch", { cursor: "2" }, "/cursor"],
    ["an unknown field", { itemId: "database" }, "/itemId"],
  ])("with %s fails", (_case, change, path) => {
    expect(problemPaths(validateClosedEvent({ ...closed, ...change }))).toEqual([path]);
  });
});

describe("the board's presence message", () => {
  const presence = { version: BOARD_PROTOCOL_VERSION, type: "presence", working: true } as const;

  test("says whether the board is working, and nothing else", () => {
    expect(validatePresence(presence)).toEqual({ ok: true, value: presence });
    expect(validatePresence({ ...presence, working: false }).ok).toBe(true);
  });

  test.each([
    ["the focused item", { itemId: "database" }],
    ["the time of the last input", { lastInput: "2026-10-29T09:41:27Z" }],
    ["the board token", { token: "pV3xK9qLmT2wR7nB4cYh8A" }],
  ])("with %s fails, naming it", (_case, change) => {
    const [field] = Object.keys(change);
    expect(problemPaths(validatePresence({ ...presence, ...change }))).toEqual([`/${field}`]);
  });

  test("without its flag, with another type or of major 2, fails", () => {
    expect(problemPaths(validatePresence({ ...presence, working: undefined }))).toEqual([
      "/working",
    ]);
    expect(problemPaths(validatePresence({ ...presence, working: "yes" }))).toEqual(["/working"]);
    expect(problemPaths(validatePresence({ ...presence, type: "connect" }))).toEqual(["/type"]);
    expect(validatePresence({ ...presence, version: "2.0" })).toMatchObject({
      ok: false,
      reason: "version",
    });
  });
});
