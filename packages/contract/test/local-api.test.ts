import { describe, expect, test } from "bun:test";
import { LOCAL_API_MESSAGES, LOCAL_API_VERSION, type LocalApiMessageName } from "../src/index.ts";
import { type Checked, validateLocalApi } from "../src/validate.ts";

// The local API (owner board-host, design decision 2): what the hooks and the mod send the session
// process and what it answers. Only here do Claude Code's own field names appear (AD-7).
const version = LOCAL_API_VERSION;
const askId = "order-db-choice-x7k2";
const epoch = "k3x9";
const when = "2026-10-29T09:41:27Z";
const link = "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A";
const answer = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "database",
  rev: 1,
  who: "Paola Greco",
  when,
  choice: ["PostgreSQL"],
};
const pushMessage = {
  versions: { output: "1.0" },
  epoch,
  asks: [{ askId, state: "answered", cursor: "k3x9.1", events: [answer] }],
  openAsks: [{ askId, state: "answered", cursor: "k3x9.1" }],
};
const ack = { version };

// One valid message of each name.
const messages: Record<LocalApiMessageName, Record<string, unknown>> = {
  recordsRequest: {
    version,
    agent_id: "a3f9c1d27b8e4f60",
    agent_type: "code-reviewer",
    cwd: "/Users/paola/src/order-service",
    tool_use_id: "toolu_01HqVb7cXz9KpL3mN5rT8wYe",
    tool_name: "mcp__plugin_askboard_askboard__ask",
    askIds: [askId],
    timestamp: when,
  },
  recordsResponse: ack,
  stopRequest: {
    version,
    agent_id: "a3f9c1d27b8e4f60",
    agent_type: "code-reviewer",
    stop_hook_active: false,
  },
  stopResponse: { version, decision: "block", message: pushMessage },
  ruleResponse: { version, rule: "none", showable: true },
  noticeResponse: { version, title: "Which database should the order service use?", link },
  modHelloRequest: { version, client: { name: "claude-code", version: "2.1.311" } },
  modHelloResponse: ack,
  modTurnRequest: { version, agent_id: "a3f9c1d27b8e4f60", running: true },
  modTurnResponse: ack,
  pollResponse: {
    version,
    epoch,
    asks: [
      {
        askId,
        agent_id: "a3f9c1d27b8e4f60",
        state: "answered",
        cursor: "k3x9.1",
        events: [answer],
      },
    ],
    pending: [
      {
        askId: "retry-policy-q3m8",
        title: "How should the order service retry?",
        label: "Subagent code-reviewer",
        agentName: "Retry review",
        openQuestions: 2,
        link: "http://127.0.0.1:47213/b/retry-policy-q3m8?t=Q7wZr2LmT9xK4pV8nB3cYh",
        agent_id: "a3f9c1d27b8e4f60",
      },
    ],
  },
  deliveredRequest: { version, askId, cursor: "k3x9.1", via: "append" },
  deliveredResponse: ack,
};

const problemPaths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);
const without = (value: Record<string, unknown>, field: string) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));

describe("the local API's messages (owner board-host, version 1.0)", () => {
  test("are the requests and responses of the eight routes, each with its $id", () => {
    expect(LOCAL_API_VERSION).toBe("1.0");
    expect(Object.keys(LOCAL_API_MESSAGES).sort()).toEqual(Object.keys(messages).sort());
    for (const id of Object.values(LOCAL_API_MESSAGES)) {
      expect(id).toMatch(/^urn:askboard:local-api:[a-z-]+$/);
    }
  });

  test.each(Object.entries(messages))("the %s validates", (name, message) => {
    const result: Checked<unknown> = validateLocalApi(name as LocalApiMessageName, message);
    expect(result).toEqual({ ok: true, value: message });
  });

  test.each(Object.entries(messages))(
    "a %s with an unknown field fails, naming it",
    (name, message) => {
      const result = validateLocalApi(name as LocalApiMessageName, { ...message, extra: 1 });
      expect(result).toEqual({
        ok: false,
        reason: "schema",
        problems: [{ path: "/extra", message: 'unknown field "extra"' }],
      });
    },
  );

  test.each(Object.entries(messages))(
    "a %s of major 2 is refused, naming version 1",
    (name, message) => {
      const result = validateLocalApi(name as LocalApiMessageName, { ...message, version: "2.0" });
      expect(result).toMatchObject({ ok: false, reason: "version" });
      expect(problemPaths(result)).toEqual(["/version"]);
      if (!result.ok) expect(result.problems[0]?.message).toContain("supports version 1");
    },
  );

  test("a later minor of major 1 is accepted, and a message without a version is refused", () => {
    expect(validateLocalApi("recordsResponse", { version: "1.4" }).ok).toBe(true);
    expect(validateLocalApi("recordsResponse", {})).toMatchObject({ ok: false, reason: "version" });
    expect(validateLocalApi("recordsResponse", "1.0")).toMatchObject({
      ok: false,
      reason: "version",
    });
  });

  test("a name the local API does not define throws", () => {
    expect(() => validateLocalApi("constructor" as LocalApiMessageName, ack)).toThrow(
      "the local API has no message constructor",
    );
  });
});

describe("Claude Code's fields keep Claude Code's names (AD-7, Consistency Conventions)", () => {
  test("the record and the stop carry agent_id, agent_type, tool_use_id and stop_hook_active", () => {
    const { recordsRequest, stopRequest } = messages;
    expect(Object.keys(recordsRequest)).toEqual(
      expect.arrayContaining(["agent_id", "agent_type", "tool_use_id", "tool_name"]),
    );
    expect(Object.keys(stopRequest)).toEqual(
      expect.arrayContaining(["agent_id", "agent_type", "stop_hook_active"]),
    );
  });

  test.each([
    ["recordsRequest", "agent_id", "agentId"],
    ["recordsRequest", "tool_use_id", "toolUseId"],
    ["stopRequest", "stop_hook_active", "stopHookActive"],
  ] as const)("a %s naming %s in camelCase fails", (name, field, camel) => {
    const message = messages[name];
    const renamed = { ...without(message, field), [camel]: message[field] };
    expect(problemPaths(validateLocalApi(name, renamed))).toContain(`/${camel}`);
  });
});

describe("the agent record", () => {
  const record = messages.recordsRequest;

  test("of the main conversation has no agent_id or agent_type, and may lack a tool_use_id", () => {
    const main = without(without(without(record, "agent_id"), "agent_type"), "tool_use_id");
    expect(validateLocalApi("recordsRequest", main).ok).toBe(true);
  });

  test("of a collect names every ask, up to collect's 40", () => {
    const ids = Array.from({ length: 40 }, (_, at) => `ask-${at}`);
    expect(validateLocalApi("recordsRequest", { ...record, askIds: ids }).ok).toBe(true);
    const over = { ...record, askIds: [...ids, "ask-40"] };
    expect(problemPaths(validateLocalApi("recordsRequest", over))).toEqual(["/askIds"]);
  });

  test("of a Claude Code side agent may carry an empty agent_type", () => {
    expect(validateLocalApi("recordsRequest", { ...record, agent_type: "" }).ok).toBe(true);
  });

  test.each([
    ["a relative cwd", { cwd: "src/order-service" }, "/cwd"],
    ["a time that is not UTC", { timestamp: "2026-10-29T11:41:27+02:00" }, "/timestamp"],
    ["a malformed ask ID", { askIds: ["order db"] }, "/askIds/0"],
    ["an empty agent_id", { agent_id: "" }, "/agent_id"],
    ["no tool_name", { tool_name: undefined }, "/tool_name"],
  ])("with %s fails, naming the field", (_case, change, path) => {
    const changed = JSON.parse(JSON.stringify({ ...record, ...change }));
    expect(problemPaths(validateLocalApi("recordsRequest", changed))).toContain(path);
  });
});

describe("the stop decision (design decisions 2 and 8)", () => {
  test("an allow carries no message, and a block carries the push message", () => {
    expect(validateLocalApi("stopResponse", { version, decision: "allow" }).ok).toBe(true);
    const allowWithMessage = { version, decision: "allow", message: pushMessage };
    expect(validateLocalApi("stopResponse", allowWithMessage)).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/message", message: "an allow decision carries no message" }],
    });
    expect(validateLocalApi("stopResponse", { version, decision: "block" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/message", message: "a block decision carries the push message" }],
    });
  });

  test("a block's message is the push message, checked as such", () => {
    const loose = { version, decision: "block", message: { ...pushMessage, verdict: "yes" } };
    expect(problemPaths(validateLocalApi("stopResponse", loose))).toEqual(["/message/verdict"]);
    expect(problemPaths(validateLocalApi("stopResponse", { version, decision: "deny" }))).toEqual([
      "/decision",
    ]);
  });

  test("the stop request needs the agent and stop_hook_active", () => {
    const stop = messages.stopRequest;
    expect(problemPaths(validateLocalApi("stopRequest", without(stop, "agent_id")))).toEqual([
      "/agent_id",
    ]);
    expect(
      problemPaths(validateLocalApi("stopRequest", { ...stop, stop_hook_active: "no" })),
    ).toEqual(["/stop_hook_active"]);
    expect(validateLocalApi("stopRequest", without(stop, "agent_type")).ok).toBe(true);
  });
});

describe("the mod's poll (design decision 2)", () => {
  const poll = messages.pollResponse;

  test("lists every kind of event collect returns, with its cursor: an answer, the lifecycle's, a discard and a close", () => {
    const events = [
      answer,
      { cursor: "k3x9.2", type: "postponed", itemId: "database", rev: 1 },
      { cursor: "k3x9.3", type: "discarded", reason: "session-exit" },
      { cursor: "k3x9.4", type: "closed", reason: "agent-finished" },
    ];
    const asks = [{ askId, state: "discarded", cursor: "k3x9.4", events }];
    expect(validateLocalApi("pollResponse", { ...poll, asks }).ok).toBe(true);
    const unknown = [{ ...asks[0], events: [{ cursor: "k3x9.5", type: "telemetry" }] }];
    expect(validateLocalApi("pollResponse", { ...poll, asks: unknown }).ok).toBe(false);
  });

  test("an ask of the main conversation has no agent_id, and an entry holds at least one event", () => {
    const [entry] = poll.asks as Record<string, unknown>[];
    const main = without(entry ?? {}, "agent_id");
    expect(validateLocalApi("pollResponse", { ...poll, asks: [main] }).ok).toBe(true);
    const empty = [{ ...main, events: [] }];
    expect(problemPaths(validateLocalApi("pollResponse", { ...poll, asks: empty }))).toEqual([
      "/asks/0/events",
    ]);
  });

  test("an empty poll validates", () => {
    expect(validateLocalApi("pollResponse", { version, epoch, asks: [], pending: [] }).ok).toBe(
      true,
    );
  });

  test("a paged poll says more follow and gives its continuation, never one without the other", () => {
    const continuation = { askId, seq: 14 };
    expect(validateLocalApi("pollResponse", { ...poll, more: true, continuation }).ok).toBe(true);
    expect(problemPaths(validateLocalApi("pollResponse", { ...poll, more: true }))).toEqual([
      "/continuation",
    ]);
    expect(problemPaths(validateLocalApi("pollResponse", { ...poll, continuation }))).toEqual([
      "/more",
    ]);
    const negative = { ...poll, more: true, continuation: { askId, seq: -1 } };
    expect(problemPaths(validateLocalApi("pollResponse", negative))).toEqual(["/continuation/seq"]);
  });

  test.each([
    ["no open question", { openQuestions: 0 }, "/pending/0/openQuestions"],
    ["a link that is not a board link", { link: "https://example.com/b/x" }, "/pending/0/link"],
    ["an empty title", { title: "" }, "/pending/0/title"],
    ["no label", { label: undefined }, "/pending/0/label"],
  ])("a pending ask with %s fails", (_case, change, path) => {
    const pending = JSON.parse(JSON.stringify([{ ...(poll.pending as object[])[0], ...change }]));
    expect(problemPaths(validateLocalApi("pollResponse", { ...poll, pending }))).toContain(path);
  });
});

describe("the other messages", () => {
  test("a delivery report names how the event was pushed: append or submit", () => {
    const report = messages.deliveredRequest;
    expect(validateLocalApi("deliveredRequest", { ...report, via: "submit" }).ok).toBe(true);
    expect(problemPaths(validateLocalApi("deliveredRequest", { ...report, via: "send" }))).toEqual([
      "/via",
    ]);
    expect(problemPaths(validateLocalApi("deliveredRequest", { ...report, cursor: "1" }))).toEqual([
      "/cursor",
    ]);
  });

  test("the rule is one of the asking rules, with whether a board can be shown", () => {
    for (const rule of ["none", "always", "with-references"]) {
      expect(validateLocalApi("ruleResponse", { ...messages.ruleResponse, rule }).ok).toBe(true);
    }
    const sometimes = { ...messages.ruleResponse, rule: "sometimes" };
    expect(problemPaths(validateLocalApi("ruleResponse", sometimes))).toEqual(["/rule"]);
    const noFlag = without(messages.ruleResponse, "showable");
    expect(problemPaths(validateLocalApi("ruleResponse", noFlag))).toEqual(["/showable"]);
  });

  test("the notice holds the ask's title and its board link", () => {
    const notice = messages.noticeResponse;
    expect(problemPaths(validateLocalApi("noticeResponse", { ...notice, title: "" }))).toEqual([
      "/title",
    ]);
    const long = { ...notice, title: "x".repeat(257) };
    expect(problemPaths(validateLocalApi("noticeResponse", long))).toEqual(["/title"]);
    const remote = { ...notice, link: link.replace("127.0.0.1", "example.com") };
    expect(problemPaths(validateLocalApi("noticeResponse", remote))).toEqual(["/link"]);
  });

  test("the hello names the client, and a turn report whether a turn runs", () => {
    const hello = messages.modHelloRequest;
    expect(problemPaths(validateLocalApi("modHelloRequest", { ...hello, client: {} }))).toEqual([
      "/client/name",
      "/client/version",
    ]);
    const main = { version, running: false };
    expect(validateLocalApi("modTurnRequest", main).ok).toBe(true);
    expect(problemPaths(validateLocalApi("modTurnRequest", { version }))).toEqual(["/running"]);
  });

  // Plan B (task 18.1; mod spec, Turn reports): a subagent's report may name it a teammate.
  test("a subagent's turn report may name it a teammate, by a name of 1 to 256 characters", () => {
    const teammate = { version, agent_id: "aresearcher-096d99adc3d94b0a", running: true };
    expect(validateLocalApi("modTurnRequest", { ...teammate, teammate: "researcher" }).ok).toBe(
      true,
    );
    expect(validateLocalApi("modTurnRequest", { ...teammate, teammate: "é".repeat(256) }).ok).toBe(
      true,
    );
    for (const name of ["", "x".repeat(257), 7]) {
      expect(
        problemPaths(validateLocalApi("modTurnRequest", { ...teammate, teammate: name })),
      ).toEqual(["/teammate"]);
    }
  });
});
