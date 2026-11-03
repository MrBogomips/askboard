import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import {
  type AgentRecord,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  CLAUDE_CODE_CLIENT_NAME,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  type SessionFile,
} from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { UNKNOWN_VERSION_DIAGNOSTIC } from "@askboard/core";
import { openSocket, plainChoiceAsk, request } from "./board-host/helpers.ts";
import { post } from "./board-host/local-api/helpers.ts";
import { CLAUDE_CODE, composedSessions, KEY } from "./composed-session.ts";

// Push delivery in the composed session process (tasks 4.2 and 4.7; board-host spec, Local API on a
// Unix socket, Session file removed at exit; mcp-adapter spec, A session without hooks, Supported
// Claude Code versions): the local API started at the first request other than `server/discover`,
// records bound to the calls that carry their tool use ID, and the file and socket gone at exit.

const { project, recorder, start, remove } = composedSessions();
afterAll(remove);

const ASK_ID = "retry-policy-q3m8";
const SUBAGENT = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" } as const;
const OTHER = { agent_id: "b7c2e9f04d1a3e85", agent_type: "general-purpose" } as const;

type Run = Awaited<ReturnType<typeof start>>;

const sessionOf = async (run: Run): Promise<SessionFile> => {
  for (let tries = 0; tries < 300 && !existsSync(run.sessionFile); tries += 1) await Bun.sleep(10);
  const checked = validateSessionFile(JSON.parse(readFileSync(run.sessionFile, "utf8")));
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

// What a PreToolUse hook sends for a call.
const record = async (
  session: SessionFile,
  tool: "ask" | "collect",
  toolUseId: string,
  agent?: { agent_id: string; agent_type: string },
) => {
  const body: AgentRecord = {
    version: LOCAL_API_VERSION,
    ...agent,
    cwd: project,
    tool_use_id: toolUseId,
    tool_name: `mcp__plugin_askboard_askboard__${tool}`,
    askIds: [ASK_ID],
    timestamp: "2026-10-29T09:40:31Z",
  };
  const answered = await post(session.apiAddress, LOCAL_API_ROUTES.records.path, body, {
    token: session.sessionToken,
  });
  expect(answered.status).toBe(200);
};

const meta = (toolUseId: string) => ({ "claudecode/toolUseId": toolUseId });
const textOf = (result: { content?: unknown }) =>
  ((result.content as { text: string }[])[0]?.text ?? "") as string;

describe("the local API's start", () => {
  test("server/discover alone creates no folder, socket or session file", async () => {
    const run = await start({}, undefined, { ...CLAUDE_CODE, negotiation: "auto" });
    await run.client.discover();
    await run.client.close();
    expect(await run.session.ended).toBe(0);
    expect(existsSync(run.sessionFolder)).toBe(false);
  });

  test("the first request starts it: the socket 0600 in a 0700 folder, before any ask", async () => {
    const run = await start({}, undefined, { ...CLAUDE_CODE, negotiation: "auto" });
    await run.client.listTools();
    const session = await sessionOf(run);
    // The session project root: the real path of CLAUDE_PROJECT_DIR (AD-12).
    expect(session).toMatchObject({
      key: KEY,
      pid: process.pid,
      projectDir: realpathSync(project),
    });
    expect(statSync(session.apiAddress).isSocket()).toBe(true);
    expect(statSync(session.apiAddress).mode & 0o777).toBe(0o600);
    expect(statSync(run.sessionFolder).mode & 0o777).toBe(0o700);
    expect(run.stderr).toEqual([]);
    run.emit("SIGINT");
    await run.session.ended;
  });
});

describe("the session file at exit", () => {
  for (const how of ["stdin closed", "SIGINT", "SIGTERM", "SIGHUP"] as const) {
    test(`${how}: the file and the socket are gone after the discard`, async () => {
      const run = await start({});
      const session = await sessionOf(run);
      if (how === "stdin closed") await run.client.close();
      else run.emit(how);
      expect(await run.session.ended).toBe(0);
      expect(existsSync(run.sessionFile)).toBe(false);
      expect(existsSync(session.apiAddress)).toBe(false);
      expect(run.stderr).toEqual([`askboard: session ending (${how}): 0 open asks discarded`]);
    });
  }
});

describe("asks bound to their records", () => {
  test("carry neither the warning nor the mark, and only their owner's collect reads them", async () => {
    const { script } = recorder("bound");
    const run = await start({ BROWSER: script });
    const session = await sessionOf(run);

    await record(session, "ask", "toolu_ask", SUBAGENT);
    const asked = await run.call("ask", plainChoiceAsk(ASK_ID), meta("toolu_ask"));
    expect(asked).toMatchObject({ askId: ASK_ID, state: "waiting" });
    expect(asked).not.toHaveProperty("warnings");

    await record(session, "collect", "toolu_collect", SUBAGENT);
    const args = { asks: [{ askId: ASK_ID, after: asked.cursor }] };
    const collected = await run.call("collect", args, meta("toolu_collect"));
    expect(collected.asks).toEqual([
      { askId: ASK_ID, state: "waiting", cursor: asked.cursor, events: [] },
    ]);

    await record(session, "collect", "toolu_other", OTHER);
    const other = await run.callRaw("collect", args, meta("toolu_other"));
    expect(other.isError).toBe(true);
    expect(textOf(other)).toContain(`the ask "${ASK_ID}" belongs to another agent`);

    const unbound = await run.callRaw("collect", args);
    expect(unbound.isError).toBe(true);
    expect(textOf(unbound)).toContain("no agent record");

    // The session token opens no board.
    const link = new URL(asked.board);
    const page = await request(Number(link.port), `${link.pathname}?t=${session.sessionToken}`);
    expect(page.status).toBe(BOARD_RESPONSES.invalidLink.status);

    const stderr = run.stderr.join("\n");
    expect(stderr).not.toContain(session.sessionToken);
    expect(stderr).not.toContain(SUBAGENT.agent_id);
    run.emit("SIGTERM");
    await run.session.ended;
  });

  test("an ask with no record keeps the warning, and its collect the mark", async () => {
    const { script } = recorder("unbound");
    const run = await start({ BROWSER: script });
    await sessionOf(run);
    const asked = await run.call("ask", plainChoiceAsk(ASK_ID), meta("toolu_lost"));
    expect(asked.warnings).toEqual([{ code: "no-hooks", message: expect.any(String) }]);
    const collected = await run.call("collect", { asks: [{ askId: ASK_ID, after: asked.cursor }] });
    expect(collected.asks[0].unchecked).toBe(true);
    run.emit("SIGTERM");
    await run.session.ended;
  });
});

describe("the client version", () => {
  test("a Claude Code below the minimum is refused, naming both versions, creating nothing", async () => {
    const { script, record: opened } = recorder("old-claude-code");
    const run = await start({ BROWSER: script }, undefined, {
      name: CLAUDE_CODE_CLIENT_NAME,
      version: "2.1.308",
    });
    const asked = await run.callRaw("ask", plainChoiceAsk(ASK_ID));
    expect(asked.isError).toBe(true);
    expect(textOf(asked)).toContain("2.1.311");
    expect(textOf(asked)).toContain("2.1.308");
    await Bun.sleep(50);
    expect(existsSync(opened)).toBe(false);
    run.emit("SIGTERM");
    await run.session.ended;
  });

  test("an unknown version is allowed, with one diagnostic", async () => {
    const { script } = recorder("unknown-version");
    const run = await start({ BROWSER: script }, undefined, { name: "test", version: "0.0.0" });
    expect((await run.call("ask", plainChoiceAsk(ASK_ID))).askId).toBe(ASK_ID);
    expect((await run.call("ask", plainChoiceAsk("second-ask"))).askId).toBe("second-ask");
    expect(run.stderr).toEqual([`askboard: ${UNKNOWN_VERSION_DIAGNOSTIC}`]);
    run.emit("SIGTERM");
    await run.session.ended;
  });
});

describe("who asked, and the agent status (task 8.6, design decision 12)", () => {
  const version = BOARD_PROTOCOL_VERSION;
  const answer = {
    version,
    type: "answer",
    itemId: "database",
    rev: 1,
    choice: ["PostgreSQL"],
    when: "2026-10-31T09:41:27Z",
  };

  // The ask's board, connected and past its board document and state.
  const connected = async (board: string) => {
    const link = new URL(board);
    const socket = await openSocket(Number(link.port), ASK_ID);
    socket.send({ version, type: "connect", token: link.searchParams.get("t") });
    await socket.next();
    await socket.next();
    return socket;
  };

  const waitingCollect = (cursor: string) => ({
    asks: [{ askId: ASK_ID, after: cursor }],
    wait: { askId: ASK_ID, itemId: "database" },
  });

  test("a board gets who asked and where, then the status, which follows the owner's waiting collect", async () => {
    const { script } = recorder("who");
    const run = await start({ BROWSER: script });
    const session = await sessionOf(run);
    await record(session, "ask", "toolu_ask", SUBAGENT);
    const ask = {
      ...plainChoiceAsk(ASK_ID),
      agentName: "Retry review",
      expectedUser: "Marco Rossi",
    };
    const asked = await run.call("ask", ask, meta("toolu_ask"));
    const board = await connected(asked.board);
    // The throwaway project has no commit, so git names no branch or worktree.
    expect(await board.nextHeader()).toEqual({
      version,
      type: "origin",
      who: { label: "Subagent code-reviewer", name: "Retry review" },
      forUser: "Marco Rossi",
      project: "project",
      directory: ".",
    });
    expect(await board.nextHeader()).toEqual({ version, type: "agent", status: "working" });

    await record(session, "collect", "toolu_wait", SUBAGENT);
    const waiting = run.call("collect", waitingCollect(asked.cursor), meta("toolu_wait"));
    expect(await board.nextHeader()).toEqual({ version, type: "agent", status: "waiting" });
    board.send(answer);
    expect(await board.nextHeader()).toEqual({ version, type: "agent", status: "working" });
    expect((await waiting).asks[0]).toMatchObject({ state: "answered" });
    run.emit("SIGTERM");
    await run.session.ended;
  });

  test("without CLAUDE_PROJECT_DIR an owned ask has no root: the working folder's name, no directory", async () => {
    const { script } = recorder("no-project");
    const run = await start({ BROWSER: script, CLAUDE_PROJECT_DIR: "" });
    const session = await sessionOf(run);
    expect(session).not.toHaveProperty("projectDir");
    await record(session, "ask", "toolu_rootless", SUBAGENT);
    const asked = await run.call("ask", plainChoiceAsk(ASK_ID), meta("toolu_rootless"));
    const board = await connected(asked.board);
    expect(await board.nextHeader()).toEqual({
      version,
      type: "origin",
      who: { label: "Subagent code-reviewer" },
      project: basename(dirname(project)),
    });
    run.emit("SIGTERM");
    await run.session.ended;
  });

  test("a main-conversation wait counts only until CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS", async () => {
    const { script } = recorder("background");
    const run = await start({ BROWSER: script, CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: "200" });
    const session = await sessionOf(run);
    await record(session, "ask", "toolu_main_ask");
    const asked = await run.call("ask", plainChoiceAsk(ASK_ID), meta("toolu_main_ask"));
    const board = await connected(asked.board);
    expect(await board.nextHeader()).toMatchObject({ who: { label: "Main agent" } });
    expect(await board.nextHeader()).toMatchObject({ status: "working" });

    await record(session, "collect", "toolu_main_wait");
    const waiting = run.call("collect", waitingCollect(asked.cursor), meta("toolu_main_wait"));
    const started = Date.now();
    expect(await board.nextHeader()).toMatchObject({ status: "waiting" });
    expect(await board.nextHeader()).toMatchObject({ status: "working" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
    board.send(answer);
    await waiting;
    run.emit("SIGTERM");
    await run.session.ended;
  });

  test("the mod's turn report moves the status of its agent's asks", async () => {
    const { script } = recorder("turns");
    const run = await start({ BROWSER: script });
    const session = await sessionOf(run);
    await record(session, "ask", "toolu_turn_ask", SUBAGENT);
    const asked = await run.call("ask", plainChoiceAsk(ASK_ID), meta("toolu_turn_ask"));
    const board = await connected(asked.board);
    await board.nextHeader();
    await board.nextHeader();
    const turn = (running: boolean) =>
      post(
        session.apiAddress,
        LOCAL_API_ROUTES.modTurn.path,
        { version: LOCAL_API_VERSION, agent_id: SUBAGENT.agent_id, running },
        { token: session.sessionToken },
      );
    expect((await turn(false)).status).toBe(200);
    expect(await board.nextHeader()).toMatchObject({ status: "waiting" });
    await turn(true);
    expect(await board.nextHeader()).toMatchObject({ status: "working" });
    run.emit("SIGTERM");
    await run.session.ended;
  });
});
