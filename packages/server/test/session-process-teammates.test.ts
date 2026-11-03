import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  type AgentRecord,
  BOARD_PROTOCOL_VERSION,
  LOCAL_API_ROUTES,
  LOCAL_API_VERSION,
  type PollResponse,
  type SessionFile,
} from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import type { ParentArgv } from "../src/board-host/index.ts";
import { openSocket, plainChoiceAsk } from "./board-host/helpers.ts";
import { localRequest, post } from "./board-host/local-api/helpers.ts";
import { composedSessions } from "./composed-session.ts";

// Telling a teammate in the composed session process (board-host spec; view-and-widgets spec, Who
// asked, and where; task 17.1): with the parent's argument vector given in place of the system's,
// a pane teammate's main conversation is "Teammate <name>" on its board, in its notification and in
// the band's pending asks; in the lead's session, an in-process teammate's record names it; and a
// parent that cannot be read leaves "Main agent", with one note naming no argument.

const { project, recorder, start, remove } = composedSessions();
afterAll(remove);

const version = BOARD_PROTOCOL_VERSION;
const SETTINGS = '{"env":{"API_KEY":"sk-not-a-real-key"}}';
const PANE_ARGV = [
  "2.1.317",
  "--agent-id",
  "ask-log-level@session-ffc1850b",
  "--agent-name",
  "ask-log-level",
  "--team-name",
  "session-ffc1850b",
  "--settings",
  SETTINGS,
];
const IN_PROCESS = { agent_id: "researcher@session-a1b2c3d4", agent_type: "researcher" } as const;
const PANE_PARENT: ParentArgv = async () => PANE_ARGV;
const LEAD_PARENT: ParentArgv = async () => ["2.1.317", "--settings", SETTINGS];

type Run = Awaited<ReturnType<typeof start>>;

const sessionOf = async (run: Run): Promise<SessionFile> => {
  for (let tries = 0; tries < 300 && !existsSync(run.sessionFile); tries += 1) await Bun.sleep(10);
  const checked = validateSessionFile(JSON.parse(readFileSync(run.sessionFile, "utf8")));
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

// What a PreToolUse hook sends for an `ask`.
const record = async (
  session: SessionFile,
  askId: string,
  toolUseId: string,
  agent?: { agent_id: string; agent_type: string },
) => {
  const body: AgentRecord = {
    version: LOCAL_API_VERSION,
    ...agent,
    cwd: project,
    tool_use_id: toolUseId,
    tool_name: "mcp__plugin_askboard_askboard__ask",
    askIds: [askId],
    timestamp: "2026-11-03T09:40:31Z",
  };
  const answered = await post(session.apiAddress, LOCAL_API_ROUTES.records.path, body, {
    token: session.sessionToken,
  });
  expect(answered.status).toBe(200);
};

// An ask bound to its record, and the first row of its board's header.
const askAs = async (
  run: Run,
  session: SessionFile,
  askId: string,
  agent?: { agent_id: string; agent_type: string },
) => {
  const toolUseId = `toolu_${askId}`;
  await record(session, askId, toolUseId, agent);
  const asked = await run.call("ask", plainChoiceAsk(askId), {
    "claudecode/toolUseId": toolUseId,
  });
  const link = new URL(asked.board);
  const board = await openSocket(Number(link.port), askId);
  board.send({ version, type: "connect", token: link.searchParams.get("t") });
  await board.next();
  await board.next();
  const origin = (await board.nextHeader()) as { who: unknown };
  return origin.who;
};

const pendingLabels = async (session: SessionFile) => {
  const answered = await localRequest(session.apiAddress, LOCAL_API_ROUTES.poll.path, {
    token: session.sessionToken,
  });
  expect(answered.status).toBe(200);
  return (answered.json() as PollResponse).pending.map(({ askId, label }) => [askId, label]);
};

const waitForNotices = async (run: Run, count: number) => {
  for (let tries = 0; tries < 300 && run.notified().length < count; tries += 1) await Bun.sleep(10);
  return run.notified().map((shown) => shown.at(-1));
};

const ended = async (run: Run) => {
  run.emit("SIGTERM");
  expect(await run.session.ended).toBe(0);
  return run.stderr.filter((line) => !line.startsWith("askboard: session ending"));
};

describe("a pane teammate's own session", () => {
  test("labels its main conversation's asks Teammate <name> on the board, the notice and the band", async () => {
    const { script } = recorder("pane-teammate");
    const run = await start({ BROWSER: script }, undefined, undefined, undefined, PANE_PARENT);
    const session = await sessionOf(run);
    expect(await askAs(run, session, "pane-ask")).toEqual({ label: "Teammate ask-log-level" });
    expect(
      await askAs(run, session, "pane-subagent-ask", { agent_id: "a3f9", agent_type: "Explore" }),
    ).toEqual({
      label: "Subagent Explore",
    });
    expect(await waitForNotices(run, 2)).toContain("Teammate ask-log-level · project · 1 question");
    expect(await pendingLabels(session)).toEqual([
      ["pane-ask", "Teammate ask-log-level"],
      ["pane-subagent-ask", "Subagent Explore"],
    ]);
    const stderr = await ended(run);
    expect(stderr).toEqual([]);
  });
});

describe("the lead's session", () => {
  test("labels an in-process teammate by its address, with no ordinal, and its own asks Main agent", async () => {
    const { script } = recorder("lead");
    const run = await start({ BROWSER: script }, undefined, undefined, undefined, LEAD_PARENT);
    const session = await sessionOf(run);
    expect(await askAs(run, session, "lead-ask")).toEqual({ label: "Main agent" });
    expect(await askAs(run, session, "teammate-ask", IN_PROCESS)).toEqual({
      label: "Teammate researcher",
    });
    const second = { agent_id: "scout-2@session-a1b2c3d4", agent_type: "researcher" };
    expect(await askAs(run, session, "teammate-2-ask", second)).toEqual({
      label: "Teammate scout-2",
    });
    expect(await pendingLabels(session)).toEqual([
      ["lead-ask", "Main agent"],
      ["teammate-ask", "Teammate researcher"],
      ["teammate-2-ask", "Teammate scout-2"],
    ]);
    expect(await ended(run)).toEqual([]);
  });
});

describe("a parent that cannot be read, or whose flags disagree", () => {
  const unreadable: ParentArgv = async () => undefined;
  const mismatched: ParentArgv = async () =>
    PANE_ARGV.map((arg) => (arg === "session-ffc1850b" ? "session-other" : arg));

  for (const [name, parentArgv] of [
    ["unreadable", unreadable],
    ["mismatched", mismatched],
  ] as const) {
    test(`${name}: the main conversation is Main agent, with one note that names no argument`, async () => {
      const { script } = recorder(`parent-${name}`);
      const run = await start({ BROWSER: script }, undefined, undefined, undefined, parentArgv);
      const session = await sessionOf(run);
      expect(await askAs(run, session, `${name}-ask`)).toEqual({ label: "Main agent" });
      const stderr = await ended(run);
      expect(stderr).toHaveLength(1);
      expect(stderr[0]).toContain("could not tell whether this session is a teammate");
      for (const arg of PANE_ARGV) expect(stderr[0]).not.toContain(arg);
      expect(stderr[0]).not.toContain("session-other");
    });
  }
});
