import { afterEach, describe, expect, test } from "bun:test";
import { LOCAL_API_ROUTES } from "@askboard/contract";
import { validateLocalApi } from "@askboard/contract/validate";
import { type HookHandler, type HookHandlers, preToolUse, runHook } from "../src/index.ts";
import { chunks, type FakeApi, fakeLocalApi, removeRuntimeFolders, UID } from "./fake-local-api.ts";

// The PreToolUse hooks (task 6.3; hooks spec, "An agent record for every AskBoard call", "Matching
// AskBoard's tool names", "The asking-rule hook"; AD-5, AD-16): a record for every AskBoard call,
// under both tool-name forms, and AskUserQuestion denied only when the rule sends it to AskBoard
// and a board can be shown.

const apis: FakeApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

const started = async () => {
  const api = await fakeLocalApi();
  apis.push(api);
  return api;
};

const NOW = new Date("2026-10-31T10:15:42.318Z");
const PROJECT = "/Users/paola/src/order-service";
const unused: HookHandler = async () => {
  throw new Error("not this event");
};
const HANDLERS: HookHandlers = {
  PreToolUse: preToolUse,
  PostToolUse: unused,
  SubagentStop: unused,
};

// Claude Code's PreToolUse input, with the fields every hook input carries.
const inputOf = (fields: Record<string, unknown>) => ({
  session_id: "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a",
  transcript_path: "/Users/paola/.claude/projects/x/0f6b6a43.jsonl",
  cwd: PROJECT,
  permission_mode: "default",
  hook_event_name: "PreToolUse",
  tool_use_id: "toolu_01HJ6m9QxR2a7pLmWn3VbT4k",
  ...fields,
});

const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" };

const run = (api: FakeApi | undefined, input: unknown) =>
  runHook("PreToolUse", {
    stdin: chunks(JSON.stringify(input)),
    env: api?.env ?? { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
    uid: UID,
    ppid: api?.key ?? 48_213,
    now: () => NOW,
    handlers: HANDLERS,
  });

const recordOf = (api: FakeApi) => {
  expect(api.requests).toHaveLength(1);
  const [request] = api.requests;
  expect(request?.method).toBe("POST");
  expect(request?.url).toBe(LOCAL_API_ROUTES.records.path);
  const record = JSON.parse(request?.body ?? "");
  expect(validateLocalApi("recordsRequest", record)).toMatchObject({ ok: true });
  return record;
};

describe("the record of an AskBoard call", () => {
  test("of the main conversation's ask has no agent and names the ask", async () => {
    const api = await started();
    const outcome = await run(
      api,
      inputOf({
        tool_name: "mcp__plugin_askboard_askboard__ask",
        tool_input: { askId: "db-choice-k3f9", title: "Database", questions: [] },
      }),
    );
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    expect(recordOf(api)).toEqual({
      version: "1.0",
      cwd: PROJECT,
      tool_use_id: "toolu_01HJ6m9QxR2a7pLmWn3VbT4k",
      tool_name: "mcp__plugin_askboard_askboard__ask",
      askIds: ["db-choice-k3f9"],
      timestamp: NOW.toISOString(),
    });
  });

  test("of a subagent's ask carries its agent ID, type and working folder", async () => {
    const api = await started();
    const outcome = await run(
      api,
      inputOf({
        ...SUBAGENT,
        cwd: `${PROJECT}/.claude/worktrees/agent-a3f9c1d27b8e4f60`,
        tool_name: "mcp__plugin_askboard_askboard__ask",
        tool_input: { askId: "retry-policy-q3m8" },
      }),
    );
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    expect(recordOf(api)).toMatchObject({
      ...SUBAGENT,
      cwd: `${PROJECT}/.claude/worktrees/agent-a3f9c1d27b8e4f60`,
      askIds: ["retry-policy-q3m8"],
    });
  });

  test("of the main conversation's collect of two asks names both, in order", async () => {
    const api = await started();
    await run(
      api,
      inputOf({
        tool_name: "mcp__plugin_askboard_askboard__collect",
        tool_input: {
          asks: [
            { askId: "retry-policy-q3m8", after: "e7.0" },
            { askId: "db-choice-k3f9", after: "e7.2" },
          ],
          wait: { askId: "db-choice-k3f9" },
        },
      }),
    );
    const record = recordOf(api);
    expect(record.askIds).toEqual(["retry-policy-q3m8", "db-choice-k3f9"]);
    expect(record.agent_id).toBeUndefined();
    expect(record.tool_name).toBe("mcp__plugin_askboard_askboard__collect");
  });

  test.each([
    ["mcp__askboard__ask", { askId: "db-choice-k3f9" }, ["db-choice-k3f9"]],
    [
      "mcp__askboard__collect",
      { asks: [{ askId: "db-choice-k3f9", after: "e.0" }] },
      ["db-choice-k3f9"],
    ],
    [
      "mcp__plugin_askboard_askboard__update",
      { askId: "db-choice-k3f9", ops: [] },
      ["db-choice-k3f9"],
    ],
    ["mcp__askboard__update", { askId: "db-choice-k3f9" }, ["db-choice-k3f9"]],
    ["mcp__plugin_askboard_askboard__fetch", { askId: "db-choice-k3f9" }, ["db-choice-k3f9"]],
    ["mcp__askboard__fetch", { askId: "db-choice-k3f9" }, ["db-choice-k3f9"]],
    ["mcp__plugin_askboard_askboard__snapshot", { format: "html" }, []],
  ])("of %s is sent with the ask IDs it names", async (tool_name, tool_input, askIds) => {
    const api = await started();
    const outcome = await run(api, inputOf({ ...SUBAGENT, tool_name, tool_input }));
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    expect(recordOf(api)).toMatchObject({ tool_name, askIds, agent_id: SUBAGENT.agent_id });
  });

  test("keeps only the ask IDs given as strings, and no tool_use_id when there is none", async () => {
    const api = await started();
    const { tool_use_id: _none, ...withoutId } = inputOf({
      tool_name: "mcp__askboard__collect",
      tool_input: { asks: [{ askId: 7 }, "db-choice-k3f9", { askId: "db-choice-k3f9" }] },
    });
    await run(api, withoutId);
    const record = recordOf(api);
    expect(record.askIds).toEqual(["db-choice-k3f9"]);
    expect("tool_use_id" in record).toBe(false);
  });

  test("with no working folder in the input is not sent", async () => {
    const api = await started();
    const { cwd: _none, ...input } = inputOf({
      tool_name: "mcp__askboard__ask",
      tool_input: { askId: "db-choice-k3f9" },
    });
    const outcome = await run(api, input);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toBe("askboard hook PreToolUse: the hook input has no cwd\n");
    expect(api.requests).toHaveLength(0);
  });

  test("refused by the session process leaves the call to proceed, with one line", async () => {
    const api = await started();
    api.reply(() => ({ status: 400, text: "Bad Request\n- /askIds/0: must match pattern\n" }));
    const outcome = await run(
      api,
      inputOf({ tool_name: "mcp__askboard__ask", tool_input: { askId: "not an id" } }),
    );
    expect(outcome).toEqual({
      stdout: "",
      stderr: "askboard hook PreToolUse: the local API answered 400 to POST /v1/records\n",
    });
  });

  test("with no session file leaves the call to proceed unchecked, with one line", async () => {
    const outcome = await run(
      undefined,
      inputOf({ tool_name: "mcp__askboard__ask", tool_input: { askId: "db-choice-k3f9" } }),
    );
    expect(outcome).toEqual({
      stdout: "",
      stderr: "askboard hook PreToolUse: no session file for this Claude Code process\n",
    });
  });
});

describe("AskUserQuestion", () => {
  const QUESTION = inputOf({
    tool_name: "AskUserQuestion",
    tool_input: { questions: [{ question: "Which database?", header: "Database", options: [] }] },
  });
  const ruled = async (rule: string, showable: boolean) => {
    const api = await started();
    api.reply(() => ({ json: { version: "1.0", rule, showable } }));
    return api;
  };

  test("is denied, pointing to AskBoard's ask tool, when the rule is always and boards show", async () => {
    const api = await ruled("always", true);
    const outcome = await run(api, QUESTION);
    expect(outcome.stderr).toBe("");
    const output = JSON.parse(outcome.stdout);
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: expect.any(String),
      },
    });
    const reason: string = output.hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain("AskBoard");
    expect(reason).toContain("ask tool");
    expect(reason).toContain("AskUserQuestion");
    expect(api.requests.map(({ method, url }) => `${method} ${url}`)).toEqual(["GET /v1/rule"]);
  });

  test.each([
    ["the rule is none and boards show", "none", true],
    ["the rule is none and no board shows", "none", false],
    ["the rule is always and no board shows", "always", false],
  ])("proceeds when %s", async (_case, rule, showable) => {
    const api = await ruled(rule, showable);
    expect(await run(api, QUESTION)).toEqual({ stdout: "", stderr: "" });
    expect(api.requests).toHaveLength(1);
  });

  test("is denied under with-references when the question names a file (settings-languages, 6.1)", async () => {
    const api = await ruled("with-references", true);
    const named = inputOf({
      tool_name: "AskUserQuestion",
      tool_input: {
        questions: [{ question: "Keep src/retry.ts#L1-L5?", header: "Retry", options: [] }],
      },
    });
    const outcome = await run(api, named);
    expect(outcome.stderr).toBe("");
    const reason: string = JSON.parse(outcome.stdout).hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain("AskBoard");
  });

  test("proceeds under with-references when the question names no file or URL", async () => {
    const api = await ruled("with-references", true);
    expect(await run(api, QUESTION)).toEqual({ stdout: "", stderr: "" });
  });

  test("proceeds, with one line, when the session process cannot be reached", async () => {
    const outcome = await run(undefined, QUESTION);
    expect(outcome).toEqual({
      stdout: "",
      stderr: "askboard hook PreToolUse: no session file for this Claude Code process\n",
    });
  });

  test("proceeds, with one line, when the session process does not answer", async () => {
    const api = await started();
    api.reply(() => ({ status: 500, text: "Internal Server Error\n" }));
    const outcome = await run(api, QUESTION);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("answered 500");
  });
});

describe("another tool", () => {
  test.each([
    "Bash",
    "mcp__plugin_askboard_askboard__",
    "mcp__other__ask",
    "mcp__plugin_x_askboard__ask",
  ])("%s gets no request and one line", async (tool_name) => {
    const api = await started();
    const outcome = await run(api, inputOf({ tool_name, tool_input: { askId: "db-choice-k3f9" } }));
    expect(outcome).toEqual({
      stdout: "",
      stderr: "askboard hook PreToolUse: AskBoard has no PreToolUse hook for this tool\n",
    });
    expect(api.requests).toHaveLength(0);
  });
});
