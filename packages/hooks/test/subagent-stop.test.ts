import { afterEach, describe, expect, test } from "bun:test";
import { LOCAL_API_ROUTES, PUSH_MESSAGE_PREFACE, pushMessageText } from "@askboard/contract";
import { subagentStopBlock } from "@askboard/contract/fixtures";
import { validateLocalApi, validatePushMessage } from "@askboard/contract/validate";
import { type HookHandler, type HookHandlers, runHook, subagentStop } from "../src/index.ts";
import { chunks, type FakeApi, fakeLocalApi, removeRuntimeFolders, UID } from "./fake-local-api.ts";

// The SubagentStop hook (task 6.5; hooks spec, "The stop guard blocks once with what the subagent
// has not received", "The stop guard lets every other stop through"; AD-10): it posts the stop,
// which the session process decides and acts on in one call; a block becomes Claude Code's block
// output with the push message, its preface and the open asks as the reason; an allow is no
// output. Whenever it cannot decide, the stop goes through.

const apis: FakeApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

const ALLOW = { version: "1.0", decision: "allow" };
const started = async (reply: unknown = ALLOW) => {
  const api = await fakeLocalApi();
  apis.push(api);
  api.reply(() => ({ json: reply }));
  return api;
};

const unused: HookHandler = async () => {
  throw new Error("not this event");
};
const HANDLERS: HookHandlers = {
  PreToolUse: unused,
  PostToolUse: unused,
  SubagentStop: subagentStop,
};

const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" };

const inputOf = (fields: Record<string, unknown>) => ({
  session_id: "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a",
  transcript_path: "/Users/paola/.claude/projects/x/0f6b6a43.jsonl",
  cwd: "/Users/paola/src/order-service",
  permission_mode: "default",
  hook_event_name: "SubagentStop",
  stop_hook_active: false,
  agent_transcript_path: "/Users/paola/.claude/projects/x/subagents/agent-a3f9c1d27b8e4f60.jsonl",
  last_assistant_message: "Done: the retry policy is in place.",
  ...SUBAGENT,
  ...fields,
});

const run = (api: FakeApi | undefined, input: unknown) =>
  runHook("SubagentStop", {
    stdin: chunks(JSON.stringify(input)),
    env: api?.env ?? { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
    uid: UID,
    ppid: api?.key ?? 48_213,
    handlers: HANDLERS,
  });

const stopOf = (api: FakeApi) => {
  expect(api.requests).toHaveLength(1);
  const [request] = api.requests;
  expect(`${request?.method} ${request?.url}`).toBe(
    `${LOCAL_API_ROUTES.stop.method} ${LOCAL_API_ROUTES.stop.path}`,
  );
  const body = JSON.parse(request?.body ?? "");
  expect(validateLocalApi("stopRequest", body)).toMatchObject({ ok: true });
  return body;
};

describe("a subagent's stop", () => {
  test("blocked carries the preface, the push message and the open asks", async () => {
    const api = await started(subagentStopBlock);
    const outcome = await run(api, inputOf({}));
    expect(outcome.stderr).toBe("");
    const output = JSON.parse(outcome.stdout);
    if (subagentStopBlock.decision !== "block") throw new Error("the fixture blocks");
    expect(output).toEqual({
      decision: "block",
      reason: pushMessageText(subagentStopBlock.message),
    });
    const [preface, json, ...rest] = (output.reason as string).split("\n");
    expect(preface).toBe(PUSH_MESSAGE_PREFACE);
    expect(rest).toEqual([]);
    const message = JSON.parse(json ?? "");
    expect(validatePushMessage(message)).toMatchObject({ ok: true });
    expect(message.openAsks).toHaveLength(2);
    expect(stopOf(api)).toEqual({ version: "1.0", ...SUBAGENT, stop_hook_active: false });
  });

  test("allowed gives no output", async () => {
    const api = await started();
    expect(await run(api, inputOf({}))).toEqual({ stdout: "", stderr: "" });
    expect(stopOf(api)).toEqual({ version: "1.0", ...SUBAGENT, stop_hook_active: false });
  });

  test("after a block passes stop_hook_active on, and the allow gives no output", async () => {
    const api = await started();
    expect(await run(api, inputOf({ stop_hook_active: true }))).toEqual({
      stdout: "",
      stderr: "",
    });
    expect(stopOf(api).stop_hook_active).toBe(true);
  });

  test("of a side agent with an empty agent_type is allowed with no error", async () => {
    const api = await started();
    const outcome = await run(api, inputOf({ agent_type: "" }));
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    expect(stopOf(api)).toEqual({
      version: "1.0",
      agent_id: SUBAGENT.agent_id,
      agent_type: "",
      stop_hook_active: false,
    });
  });

  test("with no stop_hook_active in the input counts it as false", async () => {
    const api = await started();
    const { stop_hook_active: _none, ...input } = inputOf({});
    await run(api, input);
    expect(stopOf(api).stop_hook_active).toBe(false);
  });
});

describe("the stop goes through, with one line and no output, when", () => {
  test("no session file is found", async () => {
    expect(await run(undefined, inputOf({}))).toEqual({
      stdout: "",
      stderr: "askboard hook SubagentStop: no session file for this Claude Code process\n",
    });
  });

  test("the session process refuses the stop", async () => {
    const api = await fakeLocalApi();
    apis.push(api);
    api.reply(() => ({ status: 400, text: "Bad Request\n" }));
    expect(await run(api, inputOf({}))).toEqual({
      stdout: "",
      stderr: "askboard hook SubagentStop: the local API answered 400 to POST /v1/stop\n",
    });
  });

  test.each([
    ["a block with no message", { version: "1.0", decision: "block" }],
    ["an allow with a message", { ...subagentStopBlock, decision: "allow" }],
    [
      "a block whose message holds no ask",
      {
        ...subagentStopBlock,
        message: { ...(subagentStopBlock as { message: object }).message, asks: [] },
      },
    ],
    [
      "a block of another output major",
      {
        ...subagentStopBlock,
        message: {
          ...(subagentStopBlock as { message: object }).message,
          versions: { output: "2.0" },
        },
      },
    ],
  ])("the session process answers %s", async (_case, reply) => {
    const api = await started(reply);
    const outcome = await run(api, inputOf({}));
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toStartWith("askboard hook SubagentStop: ");
    expect(outcome.stderr).toContain("not the contract's");
  });

  test.each([
    ["no agent_id", { agent_id: undefined }],
    ["an empty agent_id", { agent_id: "" }],
  ])("the input has %s, with no request", async (_case, fields) => {
    const api = await started();
    const outcome = await run(api, inputOf(fields));
    expect(outcome).toEqual({
      stdout: "",
      stderr: "askboard hook SubagentStop: the hook input names no agent\n",
    });
    expect(api.requests).toHaveLength(0);
  });
});
