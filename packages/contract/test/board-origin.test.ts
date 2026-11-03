import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, PUSH_HOST_MESSAGES, PUSH_SCHEMA_IDS } from "../src/index.ts";
import { pushBoardProtocolSchemas } from "../src/push/messages.ts";
import { type Checked, validateAgentStatus, validateOrigin } from "../src/validate.ts";

// board-host's origin and agent messages (contract spec, Board origin and agent messages; design
// decision 12): who asked and where, and the agent pill's status.
const version = BOARD_PROTOCOL_VERSION;
const problemPaths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

const origin = {
  version,
  type: "origin",
  who: { label: "Subagent code-reviewer", name: "Retry review", ordinal: 2 },
  forUser: "Marco Rossi",
  project: "order-service",
  directory: "services/orders",
  branch: "fix/retry",
  worktree: "order-service-fix-retry",
} as const;

describe("the origin message", () => {
  test("with every field validates", () => {
    expect(validateOrigin(origin)).toEqual({ ok: true, value: origin });
  });

  test("of an unchecked ask, with only a label and a project, validates", () => {
    const unchecked = {
      version,
      type: "origin",
      who: { label: "Agent" },
      project: "order-service",
    } as const;
    expect(validateOrigin(unchecked)).toEqual({ ok: true, value: unchecked });
  });

  test("of the main conversation at the root of a detached checkout validates", () => {
    const main = {
      version,
      type: "origin",
      who: { label: "Main agent" },
      project: "order-service",
      directory: ".",
      branch: "HEAD",
    };
    expect(validateOrigin(main).ok).toBe(true);
  });

  test("keeps bidirectional controls as data: the board shows them escaped", () => {
    expect(validateOrigin({ ...origin, branch: "fix/‮yrter" }).ok).toBe(true);
  });

  test.each([
    ["no who", { who: undefined }, "/who"],
    ["who without its label", { who: { name: "Retry review" } }, "/who/label"],
    [
      "an ordinal of 1, which the first subagent of a type never shows",
      { who: { label: "Subagent code-reviewer", ordinal: 1 } },
      "/who/ordinal",
    ],
    ["an empty branch", { branch: "" }, "/branch"],
    ["a project path, not its folder name", { project: "x".repeat(256) }, "/project"],
    [
      "an expected answerer over the input format's limit",
      { forUser: "x".repeat(257) },
      "/forUser",
    ],
    ["the agent's cwd", { cwd: "/Users/paola/src/order-service" }, "/cwd"],
    [
      "the agent's ID",
      { who: { label: "Main agent", agent_id: "a3f9c1d27b8e4f60" } },
      "/who/agent_id",
    ],
  ])("with %s fails, naming the field", (_case, change, path) => {
    const changed = JSON.parse(JSON.stringify({ ...origin, ...change }));
    expect(problemPaths(validateOrigin(changed))).toEqual([path]);
  });
});

describe("the agent message", () => {
  test.each(["working", "waiting"])("with status %s validates", (status) => {
    const message = { version, type: "agent", status };
    const result: Checked<unknown> = validateAgentStatus(message);
    expect(result).toEqual({ ok: true, value: message });
  });

  test.each(["answered", "idle", "Working"])("with status %s fails", (status) => {
    expect(problemPaths(validateAgentStatus({ version, type: "agent", status }))).toEqual([
      "/status",
    ]);
  });

  test("with an unknown field fails, and of major 2 is refused naming 1", () => {
    const message = { version, type: "agent", status: "working" };
    expect(problemPaths(validateAgentStatus({ ...message, askId: "x" }))).toEqual(["/askId"]);
    const later = validateAgentStatus({ ...message, version: "2.0" });
    expect(later).toMatchObject({ ok: false, reason: "version" });
    if (!later.ok) expect(later.problems[0]?.message).toContain("supports version 1");
    expect(validateOrigin({ ...origin, version: "2.1" })).toMatchObject({ reason: "version" });
  });
});

describe("the board protocol's new messages", () => {
  test("are presence, origin and agent, at the board protocol's version, in its namespace", () => {
    expect(pushBoardProtocolSchemas.version).toBe(BOARD_PROTOCOL_VERSION);
    expect(
      pushBoardProtocolSchemas.schemas.map((schema) => (schema as { $id: string }).$id),
    ).toEqual([PUSH_SCHEMA_IDS.presence, PUSH_SCHEMA_IDS.origin, PUSH_SCHEMA_IDS.agent]);
  });
});

describe("the host messages push delivery adds (task 8.4)", () => {
  test("name origin and agent by their type, with their $id, as E1's toPage messages are named", () => {
    expect(PUSH_HOST_MESSAGES).toEqual({
      origin: PUSH_SCHEMA_IDS.origin,
      agent: PUSH_SCHEMA_IDS.agent,
    });
  });
});
