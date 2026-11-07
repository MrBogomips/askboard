import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_API_ROUTES, pollPath } from "@askboard/contract";
import {
  localRequest,
  PROJECT,
  removeRuntimeFolders,
  type TestApi,
  testApi,
} from "./board-host/local-api/helpers.ts";

// The entry point's modes (task 6.6; packaging spec, "Hook mode", "Client mode"; AD-1, AD-19):
// `hook <event>` runs the hooks' runner and `client <path> [<body>]` the local API client, each as
// a process whose parent, this test, stands for Claude Code, so each finds the session file named
// by its parent's PID; anything else starts the session process, as the entry point's other tests
// show.

const MAIN = join(import.meta.dir, "..", "src", "main.ts");

const apis: TestApi[] = [];
afterEach(async () => {
  await Promise.all(apis.splice(0).map(({ api }) => api.close()));
  removeRuntimeFolders();
});

// The real local API of a session whose Claude Code process is this test.
const started = async () => {
  const session = testApi({ key: process.pid });
  apis.push(session);
  await session.api.start();
  return session;
};

type Ran = { readonly code: number; readonly stdout: string; readonly stderr: string };

const run = async (args: string[], env: Readonly<Record<string, string>>, stdin = "") => {
  const child = Bun.spawn(["bun", MAIN, ...args], {
    env: { PATH: process.env.PATH ?? "", ...env },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(stdin);
  child.stdin.end();
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr } satisfies Ran;
};

const TOOL_USE_ID = "toolu_01HJ6m9QxR2a7pLmWn3VbT4k";

describe("hook <event>", () => {
  test("PreToolUse sends the record to the local API of its parent's session", async () => {
    const session = await started();
    const input = {
      hook_event_name: "PreToolUse",
      cwd: PROJECT,
      tool_name: "mcp__plugin_askboard_askboard__ask",
      tool_input: { askId: "db-choice-k3f9" },
      tool_use_id: TOOL_USE_ID,
    };
    const ran = await run(["hook", "PreToolUse"], session.env, JSON.stringify(input));
    expect(ran).toEqual({ code: 0, stdout: "", stderr: "" });
    const binding = await session.records.bind({
      toolUseId: TOOL_USE_ID,
      tool: "ask",
      askIds: ["db-choice-k3f9"],
    });
    expect(binding?.ownerKey).toBeString();
    expect(binding?.origin).toMatchObject({ label: "Main agent", cwd: PROJECT });
  });

  test("with an event it does not know exits 0 with one stderr line and starts nothing", async () => {
    const session = await started();
    const ran = await run(["hook", "Stop"], session.env, "{}");
    expect(ran).toEqual({
      code: 0,
      stdout: "",
      stderr: "askboard hook: AskBoard has no hook for the event given\n",
    });
  });

  test("with no session to reach exits 0 with one stderr line", async () => {
    const ran = await run(
      ["hook", "SubagentStop"],
      { XDG_RUNTIME_DIR: "/nonexistent-askboard-test" },
      JSON.stringify({ agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" }),
    );
    expect(ran).toEqual({
      code: 0,
      stdout: "",
      stderr: "askboard hook SubagentStop: no session file for this Claude Code process\n",
    });
  });
});

describe("client <path> [<body>]", () => {
  test("prints the poll response the socket gives", async () => {
    const session = await started();
    const ran = await run(["client", pollPath()], session.env);
    const direct = await localRequest(session.socket, pollPath());
    expect(direct.status).toBe(200);
    expect(ran).toEqual({ code: 0, stdout: direct.text, stderr: "" });
  });

  test("posts a body and prints the answer", async () => {
    const session = await started();
    const report = { version: "1.0", running: true };
    const ran = await run(
      ["client", LOCAL_API_ROUTES.modTurn.path, JSON.stringify(report)],
      session.env,
    );
    expect(ran).toEqual({ code: 0, stdout: '{"version":"1.0"}', stderr: "" });
  });

  test("with no path exits 2 with the usage", async () => {
    const ran = await run(["client"], {});
    expect(ran.code).toBe(2);
    expect(ran.stdout).toBe("");
    expect(ran.stderr).toContain("usage: askboard client <path> [<JSON body>]");
  });
});

describe("the session process", () => {
  test("reports the product version, the plugin manifest's, as its server version", async () => {
    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "main-modes-test", version: "0" },
      },
    };
    const { code, stdout } = await run([], {}, `${JSON.stringify(initialize)}\n`);
    const manifest = JSON.parse(
      readFileSync(
        join(import.meta.dir, "..", "..", "..", ".claude-plugin", "plugin.json"),
        "utf8",
      ),
    );
    const reply = JSON.parse(stdout.split("\n")[0] ?? "");
    expect(reply.result.serverInfo).toEqual({ name: "askboard", version: manifest.version });
    expect(code).toBe(0);
  });
});
