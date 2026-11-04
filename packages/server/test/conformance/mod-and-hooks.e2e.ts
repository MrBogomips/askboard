import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join } from "node:path";
import {
  BOARD_PROTOCOL_VERSION,
  CLAUDE_CODE_MINIMUM,
  LOCAL_API_VERSION,
  type PollResponse,
  SCHEMA_IDS,
  SESSION_FILE_FORMAT,
} from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { callAs, stopAs } from "./hook-runs.ts";
import {
  BENEATH_ROW,
  createModHost,
  type HostedAgent,
  type HostRecord,
  type ModHost,
  PLUGIN_ROOT,
} from "./mod-host.ts";
import { removeShortFolders, shortFolder } from "./modes.ts";
import {
  afterPolls,
  answer,
  answeredPolls,
  askAndConnect,
  askOf,
  connectBoard,
  headerOf,
  nextOfType,
  pushedMessage,
  startClaudeSession,
  subagent,
} from "./push-steps.ts";
import { cleanUp } from "./session.ts";

// AD-1's "mod and hooks" configuration (push delivery, task 9.2; design decision 11): the built
// session process on Bun or Node 24, the built bundle's hooks run as processes of this suite with
// Claude Code's hook inputs, and the built mod in the stand-in mod host, all in one environment.
// The suite is Claude Code's stand-in: parent of the session process, of every hook and of the
// mod's process runs, so the PID key works as it does under Claude Code. Run it with run.ts.

const UID = process.getuid?.() ?? 0;
const ENV_READ = new Set(["XDG_RUNTIME_DIR", "TMPDIR"]);

// Whatever a test did, its mod did nothing the host cannot stand for, and read no other variable
// than the session folder's two (never `CLAUDE_CODE_SESSION_ID`, finding O5).
afterEach(async () => {
  for (const host of await cleanUp()) {
    expect(host.record.problems).toEqual([]);
    expect(host.record.envReads.filter((name) => !ENV_READ.has(name))).toEqual([]);
  }
});
afterEach(removeShortFolders);

const listed = (agent: { id: string; type: string }, status: HostedAgent["status"]) => ({
  id: agent.id,
  type: agent.type,
  description: `a ${agent.type}`,
  status,
});

const modOf = (session: { mod: ModHost | undefined }): ModHost => {
  if (session.mod === undefined) throw new Error("this session has no mod host");
  return session.mod;
};

const helloSaid = (mod: ModHost) =>
  mod.until(
    (record) =>
      record.exchanges.find((each) => each.path === "/v1/mod/hello" && each.status === 200),
    "the mod's hello",
  );

const turnReports = (record: HostRecord) =>
  record.exchanges.filter((each) => each.path === "/v1/mod/turn");

const hasMessage = (pending: readonly unknown[], type: string): boolean =>
  pending.some((message) => (message as { type?: string }).type === type);

const hasReceipt = (pending: readonly unknown[]): boolean => hasMessage(pending, "receipt");

/**
 * The band above the prompt as the engine draws it: now, then again after each of the mod's
 * `$.ui.invalidate` calls, until `accept` takes its rows (`undefined` when the mod passes). A list
 * the mod changes without asking for a redraw is never drawn, and the wait fails.
 */
const bandWhen = <T>(
  mod: ModHost,
  accept: (rows: string[] | undefined) => T | undefined,
  what: string,
): Promise<T> => {
  let drawnAt = -1;
  return mod.until(async (record) => {
    if (record.invalidations.length === drawnAt) return undefined;
    drawnAt = record.invalidations.length;
    return accept(await mod.drawBand());
  }, what);
};

const bandPassed = (rows: string[] | undefined): true | undefined =>
  rows === undefined ? true : undefined;

describe("one session folder", () => {
  for (const [what, env, folderOf] of [
    [
      "XDG_RUNTIME_DIR",
      () => ({ XDG_RUNTIME_DIR: shortFolder() }),
      (env: Record<string, string>) => join(env.XDG_RUNTIME_DIR ?? "", "askboard"),
    ],
    [
      "TMPDIR alone",
      () => ({ TMPDIR: shortFolder() }),
      (env: Record<string, string>) => join(env.TMPDIR ?? "", `askboard-${UID}`),
    ],
  ] as const) {
    test(`with ${what}, the session process, the hooks and the mod find one session file`, async () => {
      const given = env();
      const { session, path, file } = await startClaudeSession({ env: given, mod: {} });
      const mod = modOf(session);
      // The session process names its file by its parent's PID: this suite's.
      expect(path).toBe(join(folderOf(given), `${process.pid}.json`));
      expect(file).toMatchObject({ key: process.pid, pid: session.pid });
      // The mod learned the same PID from a process it ran, whose parent is the suite too.
      expect(mod.record.runs[0]?.result?.stdout).toBe(`${process.pid} ${UID}`);
      // The hooks found the file: the record binds the ask, which carries no no-hooks warning.
      const askId = `one-folder-${what === "TMPDIR alone" ? "tmp" : "xdg"}-k3f9`;
      const { call } = await askAndConnect(session, undefined, askId);
      expect(call.pre).toEqual({ code: 0, stdout: "", stderr: "" });
      expect(call.outcome.json).not.toHaveProperty("warnings");
      // The mod found it: it reads that file alone, and its poll lists the ask as pending.
      await mod.until(
        (record) =>
          answeredPolls(record).find((poll) =>
            (poll.response as PollResponse).pending.some((ask) => ask.askId === askId),
          ),
        "a poll listing the ask",
      );
      expect([...new Set(mod.record.reads)]).toEqual([path]);
      expect(await session.end()).toBe(0);
    });
  }
});

describe("a session folder open to others (AD-5, AD-10)", () => {
  // Another user's folder, as on Linux without XDG_RUNTIME_DIR, stands here as a folder of this user
  // with mode 0755: the built mod's find refuses both alike. Its session file names a socket this
  // suite listens on, as a forger would.
  test("the built mod polls nothing through its session file, and does once it is 0700", async () => {
    const env = { XDG_RUNTIME_DIR: shortFolder() };
    const folder = join(env.XDG_RUNTIME_DIR, "askboard");
    mkdirSync(folder, { mode: 0o755 });
    chmodSync(folder, 0o755);
    const forged: string[] = [];
    const socket = join(folder, `${process.pid}.sock`);
    const server = createServer((request, response) => {
      forged.push(`${request.method} ${request.url}`);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ version: LOCAL_API_VERSION }));
    });
    await new Promise<void>((resolve) => server.listen(socket, resolve));
    const file = join(folder, `${process.pid}.json`);
    writeFileSync(
      file,
      JSON.stringify({
        format: SESSION_FILE_FORMAT,
        key: process.pid,
        pid: process.pid,
        epoch: "f0rg",
        apiAddress: socket,
        sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
        projectDir: folder,
        startedAt: "2026-11-01T09:40:02.117Z",
      }),
      { mode: 0o600 },
    );
    chmodSync(file, 0o600);
    const mod = await createModHost({ env: { PATH: process.env.PATH ?? "", ...env }, cwd: folder });
    try {
      await mod.sessionStart();
      const finds = (record: HostRecord) => record.runs.filter((run) => run.argv[0] === "find");
      await mod.until((record) => (finds(record).length >= 2 ? true : undefined), "two checks");
      expect(forged).toEqual([]);
      expect(mod.record.exchanges).toEqual([]);
      expect(mod.record.logs).toEqual([
        "AskBoard: the session folder or file is not private to this user; push waits for one that is",
      ]);
      chmodSync(folder, 0o700);
      await mod.until((record) => record.exchanges[0], "a request once the folder is 0700");
      expect(forged[0]).toBe("POST /v1/mod/hello");
      expect(mod.record.problems).toEqual([]);
    } finally {
      await mod.stop();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("push to the main conversation", () => {
  test("idle: one submit, the receipt by push, the terminal link and the band above the prompt", async () => {
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const askId = "main-idle-k3f9";
    const { call, result, board } = await askAndConnect(session, undefined, askId, "Orders DB");
    // The terminal link: the PostToolUse system message with the title the session process holds.
    expect(call.post?.code).toBe(0);
    expect(JSON.parse(call.post?.stdout ?? "")).toEqual({
      systemMessage: `AskBoard · Orders DB · ${result.board}`,
    });
    // The band above the prompt lists the pending ask, above what the plugins beneath draw; the
    // main conversation's ask gets no toast.
    const rows = await bandWhen(
      mod,
      (drawn) => (drawn?.some((row) => row.includes(result.board)) ? drawn : undefined),
      "the ask in the band",
    );
    expect(rows).toEqual([
      "🙋 AskBoard · 1 pending",
      `🙋 AskBoard › [Orders DB](${result.board})`,
      BENEATH_ROW,
    ]);

    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "a push");
    expect(push).toMatchObject({ via: "submit" });
    expect(pushedMessage(push.text)).toMatchObject({
      epoch: result.epoch,
      asks: [{ askId, state: "answered", events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    const [event] = pushedMessage(push.text).asks[0]?.events ?? [];
    // The exchange is recorded once the mod has its answer, which may follow the board's receipt.
    const reports = await mod.until((record) => {
      const found = record.exchanges.filter((each) => each.path === "/v1/mod/delivered");
      return found.length > 0 ? found : undefined;
    }, "the delivery report");
    expect(reports).toEqual([
      {
        via: "fetch",
        method: "POST",
        path: "/v1/mod/delivered",
        request: { version: LOCAL_API_VERSION, askId, cursor: event?.cursor, via: "submit" },
        status: 200,
        response: { version: LOCAL_API_VERSION },
      },
    ]);
    // Received: the ask leaves the band, which passes to the plugins beneath, and the answer is
    // pushed once. With the terminal alone, which draws the band, the status entry stays unset.
    await bandWhen(mod, bandPassed, "the band passing");
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(1);
    expect(mod.record.toasts).toEqual([]);
    expect(mod.record.statuses).toEqual([]);
    expect(await session.end()).toBe(0);
  });

  test("mid-turn: an append, read at the turn's next request, and no catch-up", async () => {
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const askId = "main-turn-k3f9";
    const { board } = await askAndConnect(session, undefined, askId);
    await mod.turnStart();
    await mod.turnStep();
    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "a push");
    expect(push.via).toBe("append");
    expect(push).not.toHaveProperty("agentId");
    expect(pushedMessage(push.text).asks).toMatchObject([
      { askId, events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    await mod.turnStep();
    await mod.turnComplete();
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });

  test("the catch-up: an answer appended after the turn's last request goes again, once, when the turn completes", async () => {
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const askId = "main-catch-up-k3f9";
    const { board } = await askAndConnect(session, undefined, askId);
    await mod.turnStart();
    await mod.turnStep();
    answer(board, ["DynamoDB"]);
    const appended = await mod.until((record) => record.pushes[0], "the append");
    expect(appended.via).toBe("append");
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    await mod.turnComplete();
    const caughtUp = await mod.until((record) => record.pushes[1], "the catch-up");
    expect(caughtUp.via).toBe("submit");
    expect(pushedMessage(caughtUp.text).asks).toEqual(pushedMessage(appended.text).asks);
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(2);
    expect(await session.end()).toBe(0);
  });
});

describe("push to subagents", () => {
  test("a running one gets an append with its agent ID; a finished one gets none, and collects", async () => {
    const running = subagent("a19c05fdf24e1b9a2", "code-reviewer");
    const finished = subagent("a7d3e9b1c4f602581", "test-runner");
    const { session } = await startClaudeSession({
      mod: { agents: [listed(running, "running"), listed(finished, "completed")] },
    });
    const mod = modOf(session);
    const first = await askAndConnect(session, running, "sub-running-k3f9", "Log level");
    const second = await askAndConnect(session, finished, "sub-finished-k3f9", "Retry policy");
    // A subagent's ask shows no terminal link, which would land in its own transcript: a toast.
    expect(first.call.post).toEqual({ code: 0, stdout: "", stderr: "" });
    const toasts = await mod.until(
      (record) => (record.toasts.length >= 2 ? record.toasts : undefined),
      "two toasts",
    );
    expect(toasts).toEqual([
      `AskBoard · Log level · ${first.result.board}`,
      `AskBoard · Retry policy · ${second.result.board}`,
    ]);
    // Both asks in the band above the prompt, a row each, under the count.
    const rows = await bandWhen(
      mod,
      (drawn) => (drawn?.length === 4 ? drawn : undefined),
      "both asks in the band",
    );
    expect(rows).toEqual([
      "🙋 AskBoard · 2 pending",
      `🙋 AskBoard › [Log level](${first.result.board})`,
      `🙋 AskBoard › [Retry policy](${second.result.board})`,
      BENEATH_ROW,
    ]);

    // The running subagent is mid-turn: its first request is under way when the user answers.
    await mod.turnStart(running.id);
    await mod.turnStep(running.id);
    answer(first.board, ["SQLite"]);
    answer(second.board, ["DynamoDB"]);
    const push = await mod.until((record) => record.pushes[0], "a push");
    expect(push).toMatchObject({ via: "append", agentId: running.id });
    expect(pushedMessage(push.text).asks).toMatchObject([
      { askId: "sub-running-k3f9", events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    // Its delivery is reported once the subagent's next request carries the row (task 13.1).
    await mod.turnStep(running.id);
    expect(await nextOfType(first.board, "receipt")).toMatchObject({ receipt: "delivered" });
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(1);
    expect(mod.record.refusedAppends).toEqual([]);
    expect(hasReceipt(second.board.pending)).toBe(false);

    // The finished subagent's answer waits for its collect, through its hooks.
    const collected = await callAs(session, finished, "collect", {
      asks: [{ askId: second.result.askId, after: second.result.cursor }],
    });
    expect(collected.outcome.json).toMatchObject({
      asks: [{ askId: second.result.askId, events: [{ type: "answer", choice: ["DynamoDB"] }] }],
    });
    expect(await nextOfType(second.board, "receipt")).toMatchObject({ receipt: "delivered" });
    // Both received: the band passes, and with the terminal alone the status entry stays unset.
    await bandWhen(mod, bandPassed, "the band passing");
    expect(mod.record.statuses).toEqual([]);
    expect(mod.record.toasts).toHaveLength(2);
    expect(await session.end()).toBe(0);
  });
});

describe("the stop guard", () => {
  test("blocks a stop once with what the subagent has not received, then lets it through", async () => {
    const agent = subagent("a5b8c2d9e1f304671", "code-reviewer");
    // The subagent is not listed, so the mod pushes it nothing.
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const askId = "guarded-k3f9";
    const { board } = await askAndConnect(session, agent, askId);
    answer(board, ["SQLite"]);
    expect(await nextOfType(board, "state")).toMatchObject({ state: { ask: "answered" } });
    await afterPolls(mod, 1);
    expect(mod.record.pushes).toEqual([]);

    const blocked = await stopAs(session, agent, false);
    expect(blocked).toMatchObject({ code: 0, stderr: "" });
    const output = JSON.parse(blocked.stdout) as { decision: string; reason: string };
    expect(output.decision).toBe("block");
    expect(pushedMessage(output.reason)).toMatchObject({
      asks: [{ askId, events: [{ type: "answer", choice: ["SQLite"] }] }],
      openAsks: [{ askId }],
    });
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });

    // The second stop goes through, and so does one with nothing above received.
    const allowed = { code: 0, stdout: "", stderr: "" };
    expect(await stopAs(session, agent, true)).toEqual(allowed);
    // The allow closed the subagent's ask (task 3.6): its board shows it closed.
    expect(await nextOfType(board, "closed")).toMatchObject({ reason: "agent-finished" });
    expect(await stopAs(session, agent, false)).toEqual(allowed);
    // A side agent of Claude Code's, which the session process has no record of.
    expect(await stopAs(session, subagent("a0e1d2c3b4a596870", ""), false)).toEqual(allowed);
    // What the block carried was received: a resumed subagent is pushed the closed event alone,
    // and its collect after the answer returns that event.
    mod.setAgents([listed(agent, "running")]);
    const push = await mod.until((record) => record.pushes[0], "the closed event's push");
    const closed = { type: "closed", reason: "agent-finished" };
    expect(pushedMessage(push.text)).toMatchObject({
      asks: [{ askId, state: "closed", events: [closed] }],
    });
    const after = pushedMessage(output.reason).asks[0]?.cursor ?? "";
    const collected = await callAs(session, agent, "collect", { asks: [{ askId, after }] });
    expect(validateAgainst(SCHEMA_IDS.collectResult, collected.outcome.json).ok).toBe(true);
    expect(collected.outcome.json).toMatchObject({
      asks: [{ askId, state: "closed", events: [closed] }],
    });
    expect(mod.record.pushes).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });
});

describe("an answer appended during a subagent's final reply", () => {
  // The review's case (task 13.1; mod spec, "Delivery reports"): the append lands after the
  // subagent's last request, and its turn completes with no request that reads the row.
  test("is not reported, so received stays and the stop guard blocks the stop with it", async () => {
    const agent = subagent("a3c7e1f9b5d204683", "code-reviewer");
    const { session } = await startClaudeSession({
      mod: { agents: [listed(agent, "running")] },
    });
    const mod = modOf(session);
    const askId = "final-reply-k3f9";
    const { board } = await askAndConnect(session, agent, askId);
    await mod.turnStart(agent.id);
    await mod.turnStep(agent.id);
    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "the append");
    expect(push).toMatchObject({ via: "append", agentId: agent.id });
    await mod.turnComplete(agent.id);
    mod.setAgents([listed(agent, "completed")]);
    await afterPolls(mod);
    expect(mod.record.exchanges.filter((each) => each.path === "/v1/mod/delivered")).toEqual([]);
    // Received did not move: the poll still lists the answer, and the board has no receipt.
    const last = answeredPolls(mod.record).at(-1)?.response as PollResponse;
    expect(last.asks).toMatchObject([
      { askId, agent_id: agent.id, events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    expect(hasReceipt(board.pending)).toBe(false);

    const blocked = await stopAs(session, agent, false);
    expect(blocked).toMatchObject({ code: 0, stderr: "" });
    const output = JSON.parse(blocked.stdout) as { decision: string; reason: string };
    expect(output.decision).toBe("block");
    expect(pushedMessage(output.reason)).toMatchObject({
      asks: [{ askId, events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    expect(mod.record.pushes).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });
});

describe("an in-process teammate", () => {
  // The PO's probe (task 17.6): the teammate's hooks give an opaque `agent_id` and its agent type,
  // and `$.agent.list()` lists it under that ID with its team address and name. The mod's turn
  // report, at the teammate's `turn.start`, names it a teammate (design decision 4, Origin, plan B).
  const TEAMMATE_ID = "aresearcher-096d99adc3d94b0a";
  const teammate = subagent(TEAMMATE_ID, "researcher");
  const listed: HostedAgent = {
    id: TEAMMATE_ID,
    teammateId: "researcher@session-653b7577",
    name: "researcher",
    type: "researcher",
    description: "a teammate",
    status: "idle",
  };
  const allowed = { code: 0, stdout: "", stderr: "" };

  /** Waits for the mod's turn report naming the teammate, answered. */
  const reportedTeammate = (mod: ModHost) =>
    mod.until(
      (record) =>
        turnReports(record).find(
          (each) =>
            each.status === 200 &&
            (each.request as { teammate?: string } | undefined)?.teammate === "researcher",
        ),
      "the turn report naming the teammate",
    );

  /** The pending entry of `askId` once a poll lists it with `label`. */
  const pendingAs = (mod: ModHost, askId: string, label: string) =>
    mod.until(
      (record) =>
        answeredPolls(record)
          .flatMap((poll) => (poll.response as PollResponse).pending)
          .find((ask) => ask.askId === askId && ask.label === label),
      `${askId} pending as ${label}`,
    );

  test("reported at its turn's start, is Teammate researcher; its stop leaves its ask open (G1), and one message wakes it (G2)", async () => {
    const reviewer = subagent("a8b6d4f2e0c13579d", "code-reviewer");
    const { session } = await startClaudeSession({ mod: { agents: [listed] } });
    const mod = modOf(session);
    await mod.turnStart(TEAMMATE_ID);
    expect((await reportedTeammate(mod)).request).toEqual({
      version: LOCAL_API_VERSION,
      agent_id: TEAMMATE_ID,
      running: true,
      teammate: "researcher",
    });
    const askId = "teammate-idle-k3f9";
    const { result, board } = await askAndConnect(session, teammate, askId, "Cache TTL");
    const other = await askAndConnect(session, reviewer, "teammate-sub-k3f9", "Log level");
    // Who asked, on its board and in the poll the band is drawn from; a subagent keeps its label.
    expect(await headerOf(board, "origin")).toMatchObject({
      who: { label: "Teammate researcher" },
    });
    expect(await headerOf(other.board, "origin")).toMatchObject({
      who: { label: "Subagent code-reviewer" },
    });
    expect(await pendingAs(mod, askId, "Teammate researcher")).toMatchObject({
      agent_id: TEAMMATE_ID,
    });

    // G1: each turn ends with nothing to give. The teammate's stop goes through and leaves its ask
    // open, so the band keeps it; the subagent's, a hexadecimal ID of another type, closes its ask.
    expect(await stopAs(session, teammate, false)).toEqual(allowed);
    await mod.turnComplete(TEAMMATE_ID);
    expect(await stopAs(session, reviewer, false)).toEqual(allowed);
    expect(await nextOfType(other.board, "closed")).toMatchObject({ reason: "agent-finished" });
    expect(hasMessage(board.pending, "closed")).toBe(false);
    const rows = await bandWhen(
      mod,
      (drawn) => (drawn?.length === 3 ? drawn : undefined),
      "the teammate's ask alone in the band",
    );
    expect(rows).toEqual([
      "🙋 AskBoard · 1 pending",
      `🙋 AskBoard › [Cache TTL](${result.board})`,
      BENEATH_ROW,
    ]);

    // G2: listed idle, the teammate is woken by one message carrying the answer, and no append.
    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "the message");
    expect(push).toMatchObject({ via: "send", agentId: TEAMMATE_ID });
    expect(pushedMessage(push.text).asks).toMatchObject([
      { askId, events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    const reports = await mod.until((record) => {
      const found = record.exchanges.filter((each) => each.path === "/v1/mod/delivered");
      return found.length > 0 ? found : undefined;
    }, "the delivery report");
    expect(reports.map((each) => each.request)).toMatchObject([{ askId, via: "submit" }]);
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(1);
    expect(mod.record.refusedSends).toEqual([]);
    expect(await session.end()).toBe(0);
  });

  test("reported after its ask was bound, relabels it on its open board; a refused message falls back to the append", async () => {
    const { session } = await startClaudeSession({
      mod: {
        agents: [listed],
        send: async () => ({ isDelivered: false, reason: "refused in auto mode" }),
      },
    });
    const mod = modOf(session);
    const askId = "teammate-late-k3f9";
    const { board } = await askAndConnect(session, teammate, askId, "Cache TTL");
    // Not reported yet: the label is a subagent's, from its agent type.
    expect(await headerOf(board, "origin")).toMatchObject({
      who: { label: "Subagent researcher" },
    });
    const seen = board.header.length;
    await mod.turnStart(TEAMMATE_ID);
    await reportedTeammate(mod);
    const relabelled = (message: Record<string, unknown>) =>
      (message.who as { label?: string } | undefined)?.label === "Teammate researcher";
    expect(await headerOf(board, "origin", relabelled, seen)).toMatchObject({
      who: { label: "Teammate researcher" },
    });
    await pendingAs(mod, askId, "Teammate researcher");
    await mod.turnComplete(TEAMMATE_ID);

    // Idle, the teammate is sent the answer; auto mode refuses a mod's message (D13), so the answer
    // is appended to its conversation, and reported once its next turn's first request reads it.
    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "the append");
    expect(push).toMatchObject({ via: "append", agentId: TEAMMATE_ID });
    expect(pushedMessage(push.text).asks).toMatchObject([
      { askId, events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    expect(mod.record.refusedSends).toEqual([TEAMMATE_ID]);
    await afterPolls(mod, 1);
    expect(hasReceipt(board.pending)).toBe(false);
    await mod.turnStart(TEAMMATE_ID);
    await mod.turnStep(TEAMMATE_ID);
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    await afterPolls(mod);
    expect(mod.record.pushes).toHaveLength(1);
    expect(await session.end()).toBe(0);
  });
});

describe("ownership", () => {
  test("another subagent's collect and resend, and a call with no record, are refused; received does not move", async () => {
    const owner = subagent("a2b4c6d8e0f13579a", "code-reviewer");
    const other = subagent("a9f7e5d3c1b02468b", "code-reviewer");
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const askId = "owned-k3f9";
    const { result, board } = await askAndConnect(session, owner, askId);
    answer(board, ["SQLite"]);
    await nextOfType(board, "state");
    const args = { asks: [{ askId, after: result.cursor }] };

    const theirs = await callAs(session, other, "collect", args);
    expect(theirs.outcome.isError).toBe(true);
    expect(theirs.outcome.text).toContain(`the ask "${askId}" belongs to another agent`);
    const unrecorded = await session.call("collect", args);
    expect(unrecorded.isError).toBe(true);
    expect(unrecorded.text).toContain("this call carried no agent record");
    const resent = await callAs(session, other, "ask", askOf(askId));
    expect(resent.outcome.isError).toBe(true);
    expect(resent.outcome.text).toContain("is in use");
    expect(resent.outcome.text).toContain("choose a new ID");

    // Received did not move: the next poll still lists the answer, for its owner.
    await afterPolls(mod, 1);
    const last = answeredPolls(mod.record).at(-1)?.response as PollResponse;
    expect(last.asks).toMatchObject([
      { askId, agent_id: owner.id, events: [{ type: "answer", choice: ["SQLite"] }] },
    ]);
    expect(hasReceipt(board.pending)).toBe(false);

    const mine = await callAs(session, owner, "collect", args);
    expect(mine.outcome.json).toMatchObject({
      asks: [{ askId, events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    expect(await session.end()).toBe(0);
  });
});

describe("when $.http.fetch is refused", () => {
  test("the mod reaches the local API through the AskBoard client, pushes and reports", async () => {
    const { session } = await startClaudeSession({ mod: { refuseFetch: true } });
    const mod = modOf(session);
    const askId = "fetch-refused-k3f9";
    const { board } = await askAndConnect(session, undefined, askId);
    answer(board, ["SQLite"]);
    const push = await mod.until((record) => record.pushes[0], "a push");
    expect(push.via).toBe("submit");
    expect(pushedMessage(push.text).asks).toMatchObject([{ askId }]);
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    // The client's exchange is recorded once its process exits, which may follow the receipt.
    await mod.until(
      (record) =>
        record.exchanges.find((each) => each.path === "/v1/mod/delivered" && each.via === "client"),
      "the delivery report's exchange",
    );

    const { exchanges, runs } = mod.record;
    // Three requests in a row refused by fetch while the client reached the session pin the client.
    const fetched = exchanges.filter((each) => each.via === "fetch");
    expect(fetched).toHaveLength(3);
    expect(fetched.every((each) => each.refused)).toBe(true);
    const viaClient = exchanges
      .filter((each) => each.via === "client")
      .map((each) => `${each.method} ${each.path} ${each.status}`);
    for (const route of ["POST /v1/mod/hello", "GET /v1/mod/poll", "POST /v1/mod/delivered"]) {
      expect(viaClient).toContain(`${route} 200`);
    }
    const clientRuns = runs.filter((run) => run.argv.includes("client"));
    for (const run of clientRuns) {
      expect(run.argv.slice(0, 3)).toEqual([
        "bun",
        join(PLUGIN_ROOT, "dist", "askboard.mjs"),
        "client",
      ]);
    }
    expect(await session.end()).toBe(0);
  });
});

describe("the version gate", () => {
  test("a Claude Code below the minimum in the client information is refused, whatever the mod reports", async () => {
    const { session } = await startClaudeSession({
      client: { name: "claude-code", version: "2.1.308" },
      mod: { version: "2.1.314" },
    });
    await helloSaid(modOf(session));
    const asked = await callAs(session, undefined, "ask", askOf("old-claude-code-k3f9"));
    expect(asked.outcome.isError).toBe(true);
    expect(asked.outcome.text).toContain(CLAUDE_CODE_MINIMUM);
    expect(asked.outcome.text).toContain("2.1.308");
    expect(asked.post).toEqual({ code: 0, stdout: "", stderr: "" });
    await Bun.sleep(200);
    expect(session.opened()).toEqual([]);
    expect(session.notified()).toEqual([]);
    expect(await session.end()).toBe(0);
  });

  for (const [reported, refused] of [
    ["2.1.308", true],
    ["2.1.312", false],
  ] as const) {
    test(`with a client it does not know, the mod's ${reported} ${refused ? "refuses" : "allows"} the ask`, async () => {
      const { session } = await startClaudeSession({
        client: { name: "another-client", version: "9.9.9" },
        mod: { version: reported },
      });
      await helloSaid(modOf(session));
      const asked = await callAs(
        session,
        undefined,
        "ask",
        askOf(`gate-${reported.replaceAll(".", "-")}`),
      );
      expect(asked.outcome.isError).toBe(refused);
      if (refused) {
        expect(asked.outcome.text).toContain(CLAUDE_CODE_MINIMUM);
        expect(asked.outcome.text).toContain(reported);
        expect(session.opened()).toEqual([]);
      } else {
        expect(await session.nextOpened()).toHaveLength(1);
      }
      expect(await session.end()).toBe(0);
    });
  }
});

describe("the agent status and who asked", () => {
  test("turn reports move the status, and a board gets who asked and the status on connect", async () => {
    const reviewer = subagent("a6c4e2a0b8d61357c", "code-reviewer");
    const { session } = await startClaudeSession({ mod: {} });
    const mod = modOf(session);
    const sub = await askAndConnect(session, reviewer, "status-sub-k3f9");
    const main = await askAndConnect(session, undefined, "status-main-k3f9");
    const project = basename(session.project);
    expect(await headerOf(sub.board, "origin")).toMatchObject({
      who: { label: "Subagent code-reviewer" },
      project,
      directory: ".",
    });
    expect(await headerOf(main.board, "origin")).toMatchObject({
      who: { label: "Main agent" },
      project,
      directory: ".",
    });
    expect(await headerOf(sub.board, "agent")).toMatchObject({ status: "working" });
    expect(await headerOf(main.board, "agent")).toMatchObject({ status: "working" });

    const waiting = (message: Record<string, unknown>) => message.status === "waiting";
    const working = (message: Record<string, unknown>) => message.status === "working";
    // A turn of some length: its start is reported before it completes, as each transition is.
    await mod.turnStart(reviewer.id);
    await mod.until((record) => turnReports(record)[0], "the turn start's report");
    await mod.turnComplete(reviewer.id);
    await headerOf(sub.board, "agent", waiting);
    await mod.turnComplete();
    await headerOf(main.board, "agent", waiting);
    const seen = sub.board.header.length;
    await mod.turnStart(reviewer.id);
    await headerOf(sub.board, "agent", working, seen);
    const reports = await mod.until(
      (record) => (turnReports(record).length >= 4 ? turnReports(record) : undefined),
      "four turn reports",
    );
    expect(reports.map((each) => [each.request, each.status])).toEqual([
      [{ version: LOCAL_API_VERSION, agent_id: reviewer.id, running: true }, 200],
      [{ version: LOCAL_API_VERSION, agent_id: reviewer.id, running: false }, 200],
      [{ version: LOCAL_API_VERSION, running: false }, 200],
      [{ version: LOCAL_API_VERSION, agent_id: reviewer.id, running: true }, 200],
    ]);

    // A board that connects later gets the current values only.
    const later = await connectBoard(sub.result.board);
    await headerOf(later, "origin");
    await Bun.sleep(100);
    expect(
      later.header.filter((message) => (message as { type: string }).type === "agent"),
    ).toEqual([{ version: BOARD_PROTOCOL_VERSION, type: "agent", status: "working" }]);
    expect([...sub.board.problems, ...main.board.problems, ...later.problems]).toEqual([]);
    expect(await session.end()).toBe(0);
  });
});
