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

// Telling a teammate in the composed session process (board-host spec, Telling a teammate and A
// teammate's stop is idle; view-and-widgets spec, Who asked, and where; tasks 17.1 and 18.2): with
// the parent's argument vector given in place of the system's, a pane teammate's main conversation
// is "Teammate <name>" on its board, in its notification and in the band's pending asks; in the
// lead's session, the mod's turn report names an in-process teammate, whose opaque agent ID does
// not, before its ask or after it, when its open board gets the new origin; its idle stop leaves its
// ask open, also when the mod could not name it and its ID has the probe's form; and a parent that
// cannot be read leaves "Main agent", with one note naming no argument.

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
// The ids of the PO's probe (task 17.6).
const IN_PROCESS = { agent_id: "aresearcher-096d99adc3d94b0a", agent_type: "researcher" } as const;
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
  return { who: origin.who, board };
};

// What the mod sends at a turn's start: a subagent's report, naming it a teammate when it is one.
const turnStarted = async (session: SessionFile, agentId: string, teammate?: string) => {
  const body = { version: LOCAL_API_VERSION, agent_id: agentId, running: true };
  const answered = await post(
    session.apiAddress,
    LOCAL_API_ROUTES.modTurn.path,
    teammate === undefined ? body : { ...body, teammate },
    { token: session.sessionToken },
  );
  expect(answered.status).toBe(200);
};

// The SubagentStop hook's question, with nothing above `received`.
const stopped = async (session: SessionFile, agent: { agent_id: string; agent_type: string }) => {
  const answered = await post(
    session.apiAddress,
    LOCAL_API_ROUTES.stop.path,
    { version: LOCAL_API_VERSION, ...agent, stop_hook_active: false },
    { token: session.sessionToken },
  );
  expect(answered.status).toBe(200);
  return (answered.json() as { decision: string }).decision;
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
    expect((await askAs(run, session, "pane-ask")).who).toEqual({
      label: "Teammate ask-log-level",
    });
    const subagent = { agent_id: "a3f9", agent_type: "Explore" };
    expect((await askAs(run, session, "pane-subagent-ask", subagent)).who).toEqual({
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
  test("labels an in-process teammate the mod reported, with no ordinal, and its own asks Main agent", async () => {
    const { script } = recorder("lead");
    const run = await start({ BROWSER: script }, undefined, undefined, undefined, LEAD_PARENT);
    const session = await sessionOf(run);
    expect((await askAs(run, session, "lead-ask")).who).toEqual({ label: "Main agent" });
    await turnStarted(session, IN_PROCESS.agent_id, "researcher");
    expect((await askAs(run, session, "teammate-ask", IN_PROCESS)).who).toEqual({
      label: "Teammate researcher",
    });
    const reviewer = { agent_id: "a3f9c1d27b8e4f60", agent_type: "researcher" };
    await turnStarted(session, reviewer.agent_id);
    expect((await askAs(run, session, "reviewer-ask", reviewer)).who).toEqual({
      label: "Subagent researcher",
    });
    expect(await waitForNotices(run, 3)).toContain("Teammate researcher · project · 1 question");
    expect(await pendingLabels(session)).toEqual([
      ["lead-ask", "Main agent"],
      ["teammate-ask", "Teammate researcher"],
      ["reviewer-ask", "Subagent researcher"],
    ]);
    expect(await ended(run)).toEqual([]);
  });

  test("a report after the ask relabels it, and its open board gets the new origin", async () => {
    const { script } = recorder("late-report");
    const run = await start({ BROWSER: script }, undefined, undefined, undefined, LEAD_PARENT);
    const session = await sessionOf(run);
    const { who, board } = await askAs(run, session, "late-ask", IN_PROCESS);
    expect(who).toEqual({ label: "Subagent researcher" });
    await turnStarted(session, IN_PROCESS.agent_id, "researcher");
    let header = (await board.nextHeader()) as { type: string; who?: unknown };
    while (header.type !== "origin") header = (await board.nextHeader()) as typeof header;
    expect(header.who).toEqual({ label: "Teammate researcher" });
    expect(await pendingLabels(session)).toEqual([["late-ask", "Teammate researcher"]]);
    expect(await ended(run)).toEqual([]);
  });

  test("the teammate's idle stop leaves its ask open, reported or, unlisted or mods off, by its ID's form", async () => {
    const { script } = recorder("idle-stop");
    const run = await start({ BROWSER: script }, undefined, undefined, undefined, LEAD_PARENT);
    const session = await sessionOf(run);
    // Unlisted: the mod's report names no teammate, which records nothing.
    await turnStarted(session, IN_PROCESS.agent_id);
    await askAs(run, session, "idle-ask", IN_PROCESS);
    const reported = { agent_id: "ascout-2-5e0a17", agent_type: "scout-2" };
    await turnStarted(session, reported.agent_id, "scout-2");
    await askAs(run, session, "reported-ask", reported);
    const finished = { agent_id: "a3f9c1d27b8e4f60", agent_type: "code-reviewer" };
    await turnStarted(session, finished.agent_id);
    await askAs(run, session, "finished-ask", finished);
    expect(await stopped(session, IN_PROCESS)).toBe("allow");
    expect(await stopped(session, reported)).toBe("allow");
    expect(await stopped(session, finished)).toBe("allow");
    expect(await pendingLabels(session)).toEqual([
      ["idle-ask", "Subagent researcher"],
      ["reported-ask", "Teammate scout-2"],
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
      expect((await askAs(run, session, `${name}-ask`)).who).toEqual({ label: "Main agent" });
      const stderr = await ended(run);
      expect(stderr).toHaveLength(1);
      expect(stderr[0]).toContain("could not tell whether this session is a teammate");
      for (const arg of PANE_ARGV) expect(stderr[0]).not.toContain(arg);
      expect(stderr[0]).not.toContain("session-other");
    });
  }
});
