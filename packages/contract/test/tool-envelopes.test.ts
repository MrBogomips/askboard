import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  OUTPUT_FORMAT_VERSION,
  RESULT_VERSIONS,
  SCHEMA_IDS,
  SERVER_INSTRUCTIONS,
  TOOL_DEFINITIONS,
  TOOL_ENVELOPES_VERSION,
} from "../src/index.ts";
import { validateAgainst } from "../src/validate.ts";

// The tool envelopes (owner `mcp-tools`): the requests as the approved tool definitions describe
// them, and the results, which name both their versions (finding F12).
const fixture = async (path: string) => Bun.file(join(import.meta.dir, "fixtures", path));
const approved = (await (await fixture("tools.json")).json()) as { tools: { name: string }[] };

const versions = { result: "1.0", output: "1.0" };
const askResult = {
  versions,
  epoch: "k3x9",
  askId: "order-db-choice-x7k2",
  state: "waiting",
  cursor: "k3x9.0",
  board: "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A",
  warnings: [{ code: "no-hooks", message: "Collect this ask before you finish." }],
};
const unavailable = {
  versions,
  epoch: "k3x9",
  askId: "order-db-choice-x7k2",
  outcome: "unavailable",
  reason: "remote-host",
  message: "No board can be shown on a remote host: ask through AskUserQuestion.",
};
const answerEvent = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when: "2026-10-29T09:41:27Z",
  choice: ["PostgreSQL"],
};
const collectResult = {
  versions,
  epoch: "k3x9",
  asks: [
    {
      askId: "order-db-choice-x7k2",
      state: "answered",
      cursor: "k3x9.1",
      events: [answerEvent],
      unchecked: true,
    },
    {
      askId: "order-db-choice-a1b2",
      state: "discarded",
      cursor: "q8w2.3",
      events: [],
      unchecked: true,
    },
  ],
  more: true,
  outcome: "open",
};
const pathsOf = (id: string, value: unknown) => {
  const checked = validateAgainst(id, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};

describe("the tool definitions", () => {
  test("are the approved ask, update, collect and fetch, in that order and unchanged", () => {
    const byName = (name: string) => approved.tools.find((tool) => tool.name === name);
    expect(TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "ask",
      "update",
      "collect",
      "fetch",
    ]);
    expect(TOOL_DEFINITIONS).toEqual([
      byName("ask"),
      byName("update"),
      byName("collect"),
      byName("fetch"),
    ] as never);
  });

  test("the request envelopes are the definitions' input schemas, and name no version", async () => {
    const ask = (await (await fixture("asks/plain-choice.json")).json()) as object;
    expect(validateAgainst(SCHEMA_IDS.askRequest, ask).ok).toBe(true);
    expect(pathsOf(SCHEMA_IDS.askRequest, { ...ask, versions })).toEqual(["/versions"]);
    const collect = { asks: [{ askId: "order-db-choice-x7k2", after: "k3x9.0" }] };
    expect(validateAgainst(SCHEMA_IDS.collectRequest, collect).ok).toBe(true);
    expect(pathsOf(SCHEMA_IDS.collectRequest, { ...collect, versions })).toEqual(["/versions"]);
    const update = { askId: "order-db-choice-x7k2", actions: [{ action: "close" }] };
    expect(validateAgainst(SCHEMA_IDS.updateRequest, update).ok).toBe(true);
    expect(pathsOf(SCHEMA_IDS.updateRequest, { ...update, versions })).toEqual(["/versions"]);
    const fetch = { askId: "order-db-choice-x7k2", itemId: "database" };
    expect(validateAgainst(SCHEMA_IDS.fetchRequest, fetch).ok).toBe(true);
    expect(pathsOf(SCHEMA_IDS.fetchRequest, { ...fetch, versions })).toEqual(["/versions"]);
  });
});

describe("the ask result", () => {
  test("validates with its no-hooks warning", () => {
    expect(validateAgainst(SCHEMA_IDS.askResult, askResult).ok).toBe(true);
  });

  test("names both versions (F12)", () => {
    expect(RESULT_VERSIONS).toEqual({
      result: TOOL_ENVELOPES_VERSION,
      output: OUTPUT_FORMAT_VERSION,
    });
    const { versions: _, ...bare } = askResult;
    expect(pathsOf(SCHEMA_IDS.askResult, bare)).toEqual(["/versions"]);
    const half = { ...askResult, versions: { result: "1.0" } };
    expect(pathsOf(SCHEMA_IDS.askResult, half)).toEqual(["/versions/output"]);
    const major = { ...askResult, versions: { result: "2.0", output: "1.0" } };
    expect(pathsOf(SCHEMA_IDS.askResult, major)).toEqual(["/versions/result"]);
  });

  test("its board is a loopback link with the ask's token", () => {
    const remote = { ...askResult, board: "http://example.com/b/order-db-choice-x7k2?t=x" };
    expect(pathsOf(SCHEMA_IDS.askResult, remote)).toEqual(["/board"]);
  });

  test("the unavailable outcome validates, and carries no board", () => {
    expect(validateAgainst(SCHEMA_IDS.askUnavailable, unavailable).ok).toBe(true);
    const withBoard = { ...unavailable, board: askResult.board };
    expect(pathsOf(SCHEMA_IDS.askUnavailable, withBoard)).toEqual(["/board"]);
  });
});

describe("the collect result", () => {
  test("validates with unchecked entries, more and the outcome open", () => {
    expect(validateAgainst(SCHEMA_IDS.collectResult, collectResult).ok).toBe(true);
  });

  test("an entry may carry the discarded event", () => {
    const discarded = { cursor: "k3x9.2", type: "discarded", reason: "session-exit" };
    const [entry] = collectResult.asks;
    const value = {
      ...collectResult,
      asks: [{ ...entry, state: "discarded", events: [discarded] }],
    };
    expect(validateAgainst(SCHEMA_IDS.collectResult, value).ok).toBe(true);
  });

  test.each([
    ["an event of a type the output format does not define", { cursor: "k3x9.2", type: "closed" }],
    ["a postponed event without its item", { cursor: "k3x9.2", type: "postponed" }],
    ["an answer with an unknown field", { ...answerEvent, gate: true }],
  ])("%s is refused", (_, event) => {
    const [entry] = collectResult.asks;
    const value = { ...collectResult, asks: [{ ...entry, events: [event] }] };
    expect(pathsOf(SCHEMA_IDS.collectResult, value)).not.toEqual([]);
  });

  test("more and unchecked are only ever true", () => {
    expect(pathsOf(SCHEMA_IDS.collectResult, { ...collectResult, more: false })).toEqual(["/more"]);
  });
});

describe("the server instructions", () => {
  test("are the approved text, whole", async () => {
    const text = await (await fixture("server-instructions.md")).text();
    expect(SERVER_INSTRUCTIONS).toBe(text.trimEnd());
  });

  test("name the four tools listed and no other AskBoard tool", () => {
    for (const tool of ["ask", "update", "collect", "fetch"]) {
      expect(SERVER_INSTRUCTIONS).toContain(`\`${tool}\``);
    }
    expect(SERVER_INSTRUCTIONS).not.toMatch(/\bsnapshot\b/);
  });
});
