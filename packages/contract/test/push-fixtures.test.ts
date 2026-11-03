import { describe, expect, test } from "bun:test";
import {
  agentFinishedEvent,
  fixturePendingAsks,
  fixturePollResponse,
  fixtureSessionFile,
  mainAgentRecord,
  PLAIN_CHOICE,
  plainChoicePushMessage,
  subagentOrigin,
  subagentRecord,
  subagentStopBlock,
  teammateOrigin,
  teammateRecord,
  uncheckedOrigin,
  waitingAgentStatus,
  workingPresence,
} from "../src/fixtures/index.ts";
import { LOCAL_API_VERSION, socketPathFor, socketPathProblem } from "../src/index.ts";
import {
  type Checked,
  validateAgentStatus,
  validateClosedEvent,
  validateLocalApi,
  validateOrigin,
  validatePresence,
  validatePushMessage,
  validateSessionFile,
} from "../src/validate.ts";
import plainChoiceAnswers from "./fixtures/answers/plain-choice.json";

// The push delivery fixtures (contract spec, Push delivery fixtures): the interface the session
// process, the hooks, the mod and the board page test against instead of each other's code.
const fixtures: [string, unknown, (value: unknown) => Checked<unknown>][] = [
  [
    "the main conversation's agent record",
    mainAgentRecord,
    (v) => validateLocalApi("recordsRequest", v),
  ],
  ["a subagent's agent record", subagentRecord, (v) => validateLocalApi("recordsRequest", v)],
  [
    "an in-process teammate's agent record",
    teammateRecord,
    (v) => validateLocalApi("recordsRequest", v),
  ],
  ["the session file", fixtureSessionFile, validateSessionFile],
  ["the push message", plainChoicePushMessage, validatePushMessage],
  ["the stop block", subagentStopBlock, (v) => validateLocalApi("stopResponse", v)],
  [
    "the pending-asks list, in a poll",
    {
      version: LOCAL_API_VERSION,
      epoch: PLAIN_CHOICE.epoch,
      asks: [],
      pending: fixturePendingAsks,
    },
    (v) => validateLocalApi("pollResponse", v),
  ],
  ["the poll", fixturePollResponse, (v) => validateLocalApi("pollResponse", v)],
  ["the closed event", agentFinishedEvent, validateClosedEvent],
  ["the presence message", workingPresence, validatePresence],
  ["the subagent's origin message", subagentOrigin, validateOrigin],
  ["an unchecked ask's origin message", uncheckedOrigin, validateOrigin],
  ["the teammate's origin message", teammateOrigin, validateOrigin],
  ["the agent message", waitingAgentStatus, validateAgentStatus],
];

describe("every push delivery fixture validates against its schema", () => {
  test.each(fixtures)("%s", (_name, fixture, validate) => {
    expect(validate(fixture)).toEqual({ ok: true, value: fixture });
  });
});

describe("the fixtures tell one session's story", () => {
  test("the push message carries the plain-choice answer as collect returns it", () => {
    expect(plainChoicePushMessage.asks).toEqual(plainChoiceAnswers.asks as never);
    expect(plainChoicePushMessage.epoch).toBe(PLAIN_CHOICE.epoch);
    expect(plainChoicePushMessage.openAsks).toBeUndefined();
  });

  test("the main record has no agent; the subagent's names it, and the plain-choice ask is the main's", () => {
    expect(mainAgentRecord.agent_id).toBeUndefined();
    expect(mainAgentRecord.agent_type).toBeUndefined();
    expect(mainAgentRecord.askIds).toEqual([PLAIN_CHOICE.askId]);
    expect(subagentRecord.agent_id).toBeDefined();
    expect(subagentRecord.askIds).not.toContain(PLAIN_CHOICE.askId);
  });

  test("the session file's socket is the contract's path for its key, within both limits", () => {
    const { apiAddress, key, epoch } = fixtureSessionFile;
    const folder = apiAddress.slice(0, apiAddress.lastIndexOf("/"));
    expect(socketPathFor(folder, key)).toBe(apiAddress);
    expect(socketPathProblem(apiAddress, "darwin")).toBeUndefined();
    expect(epoch).toBe(PLAIN_CHOICE.epoch);
  });

  test("the stop block carries the subagent's answer and lists every open ask it owns", () => {
    if (subagentStopBlock.decision !== "block") throw new Error("the stop block allows");
    const { asks, openAsks = [] } = subagentStopBlock.message;
    const open = openAsks.map((ask) => ask.askId);
    expect(asks.map((ask) => ask.askId).every((askId) => open.includes(askId))).toBe(true);
    expect(open.length).toBeGreaterThan(asks.length);
    expect(subagentRecord.askIds.every((askId) => open.includes(askId))).toBe(true);
  });

  test("the poll pushes the subagent's answer to its owner and lists both pending asks", () => {
    const [polled] = fixturePollResponse.asks;
    expect(polled?.agent_id).toBe(subagentRecord.agent_id);
    expect(fixturePollResponse.pending).toEqual(fixturePendingAsks);
    expect(fixturePendingAsks.map(({ label }) => label)).toEqual([
      "Main agent",
      `Subagent ${subagentRecord.agent_type}`,
    ]);
    expect(fixturePendingAsks.map(({ agent_id }) => agent_id)).toEqual([
      undefined,
      subagentRecord.agent_id,
    ]);
  });

  test("the subagent's origin is its record's, and an unchecked one names no place but the project", () => {
    expect(subagentOrigin.who.label).toBe(`Subagent ${subagentRecord.agent_type}`);
    expect(subagentRecord.cwd.endsWith(`/${subagentOrigin.worktree}`)).toBe(true);
    expect(Object.keys(uncheckedOrigin).sort()).toEqual(["project", "type", "version", "who"]);
  });

  // Telling a teammate (task 17.1): its agent ID is its team address, which names it.
  test("the in-process teammate's origin names it by the part of its address before the @", () => {
    const address = teammateRecord.agent_id ?? "";
    const name = address.slice(0, address.lastIndexOf("@"));
    expect(address).toBe(`${name}@session-a1b2c3d4`);
    expect(teammateOrigin.who).toEqual({ label: `Teammate ${name}` });
    expect(teammateOrigin.who).not.toHaveProperty("ordinal");
  });
});
