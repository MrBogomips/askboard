import { afterEach, describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { type HookHandler, type HookHandlers, postToolUse, runHook } from "../src/index.ts";
import { chunks, type FakeApi, fakeLocalApi, removeRuntimeFolders, UID } from "./fake-local-api.ts";

// The PostToolUse link (task 6.4; hooks spec, "Terminal link for the main conversation's asks";
// Consistency Conventions, Board link and notice): the main conversation's `ask` result with a board
// link gets "AskBoard · <title> · <link>", with the title from `/v1/notice`, or the link alone when
// the local API cannot be reached; a subagent's ask, `unavailable` and an error get nothing, and
// cost no request.

const apis: FakeApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map((api) => api.close()));
  removeRuntimeFolders();
});

const TITLE = "Which database should the order service use?";
const { askId, epoch, link: LINK } = PLAIN_CHOICE;

const started = async (title: string = TITLE) => {
  const api = await fakeLocalApi();
  apis.push(api);
  api.reply(() => ({ json: { version: "1.0", title, link: LINK } }));
  return api;
};

const unused: HookHandler = async () => {
  throw new Error("not this event");
};
const HANDLERS: HookHandlers = {
  PreToolUse: unused,
  PostToolUse: postToolUse,
  SubagentStop: unused,
};

const ASK_RESULT = {
  versions: RESULT_VERSIONS,
  epoch,
  askId,
  state: "waiting",
  cursor: `${epoch}.0`,
  board: LINK,
};

const UNAVAILABLE = {
  versions: RESULT_VERSIONS,
  epoch,
  askId,
  outcome: "unavailable",
  reason: "container",
  message: "No board can be shown on this machine: ask in the conversation instead.",
};

// An MCP tool result as Claude Code gives it to PostToolUse: its content blocks.
const blocks = (value: unknown) => [{ type: "text", text: JSON.stringify(value) }];

const inputOf = (fields: Record<string, unknown>) => ({
  session_id: "0f6b6a43-6a6c-4c3e-9a55-3d1c1c0e2b7a",
  transcript_path: "/Users/paola/.claude/projects/x/0f6b6a43.jsonl",
  cwd: "/Users/paola/src/order-service",
  permission_mode: "default",
  hook_event_name: "PostToolUse",
  tool_name: "mcp__plugin_askboard_askboard__ask",
  tool_input: { askId },
  tool_use_id: "toolu_01HJ6m9QxR2a7pLmWn3VbT4k",
  tool_response: blocks(ASK_RESULT),
  ...fields,
});

const run = (api: FakeApi | undefined, input: unknown) =>
  runHook("PostToolUse", {
    stdin: chunks(JSON.stringify(input)),
    env: api?.env ?? { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
    uid: UID,
    ppid: api?.key ?? 48_213,
    handlers: HANDLERS,
  });

const message = (text: string) => `${JSON.stringify({ systemMessage: text })}\n`;

test("the ask result these tests use is the contract's", () => {
  expect(validateAgainst(SCHEMA_IDS.askResult, ASK_RESULT)).toMatchObject({ ok: true });
  expect(validateAgainst(SCHEMA_IDS.askUnavailable, UNAVAILABLE)).toMatchObject({ ok: true });
});

describe("the main conversation's ask", () => {
  test.each([
    ["the content blocks", blocks(ASK_RESULT)],
    ["a result with content", { content: blocks(ASK_RESULT) }],
    [
      "a result with content and structured content",
      { content: blocks(ASK_RESULT), structuredContent: ASK_RESULT },
    ],
    ["the text alone", JSON.stringify(ASK_RESULT)],
  ])("given as %s shows the title and the link", async (_case, toolResponse) => {
    const api = await started();
    const outcome = await run(api, inputOf({ tool_response: toolResponse }));
    expect(outcome).toEqual({ stdout: message(`AskBoard · ${TITLE} · ${LINK}`), stderr: "" });
    expect(api.requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `GET /v1/notice?askId=${askId}`,
    ]);
  });

  test("under the MCP configuration's tool name shows the same", async () => {
    const api = await started();
    const outcome = await run(api, inputOf({ tool_name: "mcp__askboard__ask" }));
    expect(outcome.stdout).toBe(message(`AskBoard · ${TITLE} · ${LINK}`));
  });

  test("shows the link alone, with one line, when no session file is found", async () => {
    const outcome = await run(undefined, inputOf({}));
    expect(outcome).toEqual({
      stdout: message(`AskBoard · ${LINK}`),
      stderr: "askboard hook PostToolUse: no session file for this Claude Code process\n",
    });
  });

  test.each([
    ["refuses the notice", () => ({ status: 404, text: "Not Found\n" }), "answered 404"],
    [
      "answers with another major",
      () => ({ json: { version: "2.0", title: TITLE, link: LINK } }),
      "version 2.0",
    ],
    ["answers outside the contract", () => ({ json: { version: "1.0" } }), "not the contract's"],
  ] as const)(
    "shows the link alone, with one line, when the session process %s",
    async (_case, reply, why) => {
      const api = await started();
      api.reply(reply);
      const outcome = await run(api, inputOf({}));
      expect(outcome.stdout).toBe(message(`AskBoard · ${LINK}`));
      expect(outcome.stderr).toStartWith("askboard hook PostToolUse: ");
      expect(outcome.stderr).toContain(why);
    },
  );

  test("shows a title's controls as visible escapes, cut to 120 characters", async () => {
    const title = `Pick one\u001b[2J‮evil\n${"x".repeat(200)}`;
    const api = await started(title);
    const outcome = await run(api, inputOf({}));
    const shown = `Pick one\\u001B[2J\\u202Eevil\\u000A${"x".repeat(120 - 33 - 1)}…`;
    expect(Array.from(shown)).toHaveLength(120);
    expect(outcome.stdout).toBe(message(`AskBoard · ${shown} · ${LINK}`));
  });

  test("of a resend shows its link again", async () => {
    const api = await started();
    const resent = { ...ASK_RESULT, state: "answered", cursor: `${epoch}.1` };
    const outcome = await run(api, inputOf({ tool_response: blocks(resent) }));
    expect(outcome.stdout).toBe(message(`AskBoard · ${TITLE} · ${LINK}`));
  });
});

describe("nothing is shown, and no request made, for", () => {
  test.each([
    ["a subagent's ask", { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" }],
    ["an unavailable result", { tool_response: blocks(UNAVAILABLE) }],
    [
      "an error result",
      {
        tool_response: {
          content: [{ type: "text", text: `ask ${askId}: the request is invalid` }],
          isError: true,
        },
      },
    ],
    ["an error result's text alone", { tool_response: [{ type: "text", text: "invalid" }] }],
    [
      "an error result flagged with JSON text",
      { tool_response: { content: blocks(ASK_RESULT), isError: true } },
    ],
    [
      "a result whose link is not a board link",
      { tool_response: blocks({ ...ASK_RESULT, board: "javascript:alert(1)" }) },
    ],
    ["a result outside the contract", { tool_response: blocks({ ...ASK_RESULT, extra: 1 }) }],
    ["no result", { tool_response: undefined }],
    [
      "a result of another kind",
      { tool_response: [{ type: "image", data: "", mimeType: "image/png" }] },
    ],
  ])("%s", async (_case, fields) => {
    const api = await started();
    const outcome = await run(api, inputOf(fields));
    expect(outcome).toEqual({ stdout: "", stderr: "" });
    expect(api.requests).toHaveLength(0);
  });
});

test("a PostToolUse run for another tool makes no request and writes one line", async () => {
  const api = await started();
  const outcome = await run(api, inputOf({ tool_name: "mcp__plugin_askboard_askboard__collect" }));
  expect(outcome).toEqual({
    stdout: "",
    stderr: "askboard hook PostToolUse: AskBoard has no PostToolUse hook for this tool\n",
  });
  expect(api.requests).toHaveLength(0);
});
