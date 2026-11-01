import { afterEach, describe, expect, test } from "bun:test";
import { POLL_INTERVAL_MS } from "@askboard/contract";
import { callAs, stopAs } from "./hook-runs.ts";
import { removeShortFolders, shortFolder } from "./modes.ts";
import {
  answer,
  askAndConnect,
  headerOf,
  nextOfType,
  pushedMessage,
  QUESTION,
  startClaudeSession,
  subagent,
} from "./push-steps.ts";
import { cleanUp } from "./session.ts";

// AD-1's "mod disabled" configuration (push delivery, task 9.3; design decision 11): the built
// session process on Bun or Node 24 and the built bundle's hooks, run as processes of this suite
// with Claude Code's hook inputs, and no mod. Records, ownership and the stop guard hold without
// push; an answer reaches its owner by `collect`, or by the guard's block; the agent status comes
// from waiting `collect` calls alone. run.ts runs this file beside E1's suite, whose cases with
// hooks (tasks 4.8 and 6.6) belong to this configuration too.

afterEach(cleanUp);
afterEach(removeShortFolders);

const hasReceipt = (pending: readonly unknown[]): boolean =>
  pending.some((message) => (message as { type?: string }).type === "receipt");

const noMod = { mod: false } as const;

describe("records and ownership, without push", () => {
  test("the owner's collect gets the answer and the receipt; another agent's and an unrecorded call are refused", async () => {
    const owner = subagent("a2b4c6d8e0f13579a", "code-reviewer");
    const other = subagent("a9f7e5d3c1b02468b", "test-runner");
    const { session } = await startClaudeSession(noMod);
    const askId = "owned-no-mod-k3f9";
    const { call, result, board } = await askAndConnect(session, owner, askId);
    expect(call.pre).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(call.outcome.json).not.toHaveProperty("warnings");
    answer(board, ["SQLite"]);
    expect(await nextOfType(board, "state")).toMatchObject({ state: { ask: "answered" } });
    // Nothing pushes: the answer waits above received, for longer than a mod's poll would take.
    await Bun.sleep(2 * POLL_INTERVAL_MS);
    expect(hasReceipt(board.pending)).toBe(false);

    const args = { asks: [{ askId, after: result.cursor }] };
    const theirs = await callAs(session, other, "collect", args);
    expect(theirs.outcome.isError).toBe(true);
    expect(theirs.outcome.text).toContain(`the ask "${askId}" belongs to another agent`);
    const unrecorded = await session.call("collect", args);
    expect(unrecorded.isError).toBe(true);
    expect(unrecorded.text).toContain("this call carried no agent record");
    expect(hasReceipt(board.pending)).toBe(false);

    const mine = await callAs(session, owner, "collect", args);
    expect(mine.outcome.json).toMatchObject({
      asks: [{ askId, state: "answered", events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    expect((mine.outcome.json as { asks: object[] }).asks[0]).not.toHaveProperty("unchecked");
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    expect(await session.end()).toBe(0);
  });
});

describe("the stop guard, without push", () => {
  test("blocks a stop once with the answer, which the board then shows delivered, and lets the next through", async () => {
    const agent = subagent("a5b8c2d9e1f304671", "code-reviewer");
    const { session } = await startClaudeSession(noMod);
    const askId = "guarded-no-mod-k3f9";
    const { board } = await askAndConnect(session, agent, askId);
    // Nothing to give yet: the stop goes through.
    const allowed = { code: 0, stdout: "", stderr: "" };
    expect(await stopAs(session, agent, false)).toEqual(allowed);
    answer(board, ["DynamoDB"]);
    await nextOfType(board, "state");

    const blocked = await stopAs(session, agent, false);
    expect(blocked).toMatchObject({ code: 0, stderr: "" });
    const output = JSON.parse(blocked.stdout) as { decision: string; reason: string };
    expect(output.decision).toBe("block");
    expect(pushedMessage(output.reason)).toMatchObject({
      asks: [{ askId, events: [{ type: "answer", choice: ["DynamoDB"] }] }],
      openAsks: [{ askId }],
    });
    expect(await nextOfType(board, "receipt")).toMatchObject({ receipt: "delivered" });
    expect(await stopAs(session, agent, true)).toEqual(allowed);
    expect(await stopAs(session, agent, false)).toEqual(allowed);
    expect(await session.end()).toBe(0);
  });
});

describe("the agent status from waiting collect calls alone", () => {
  const waitingCollect = (
    session: Parameters<typeof callAs>[0],
    agent: Parameters<typeof callAs>[1],
    askId: string,
    after: string,
  ) =>
    callAs(session, agent, "collect", {
      asks: [{ askId, after }],
      wait: { askId, itemId: QUESTION.id },
    });

  const status =
    (expected: string) =>
    (message: Record<string, unknown>): boolean =>
      message.status === expected;

  test("a subagent's waiting collect shows waiting until it returns", async () => {
    const agent = subagent("a6c4e2a0b8d61357c", "code-reviewer");
    const { session } = await startClaudeSession(noMod);
    const askId = "status-no-mod-k3f9";
    const { result, board } = await askAndConnect(session, agent, askId);
    expect(await headerOf(board, "agent")).toMatchObject({ status: "working" });
    const waiting = waitingCollect(session, agent, askId, result.cursor);
    await headerOf(board, "agent", status("waiting"));
    const seen = board.header.length;
    answer(board, ["SQLite"]);
    expect((await waiting).outcome.json).toMatchObject({
      asks: [{ askId, events: [{ type: "answer", choice: ["SQLite"] }] }],
    });
    await headerOf(board, "agent", status("working"), seen);
    expect(board.problems).toEqual([]);
    expect(await session.end()).toBe(0);
  });

  test("the main conversation's waiting collect counts until Claude Code's background threshold", async () => {
    const { session } = await startClaudeSession({
      ...noMod,
      env: { XDG_RUNTIME_DIR: shortFolder(), CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: "400" },
    });
    const askId = "status-main-no-mod-k3f9";
    const { result, board } = await askAndConnect(session, undefined, askId);
    expect(await headerOf(board, "agent")).toMatchObject({ status: "working" });
    const started = Date.now();
    const waiting = waitingCollect(session, undefined, askId, result.cursor);
    await headerOf(board, "agent", status("waiting"));
    const seen = board.header.length;
    await headerOf(board, "agent", status("working"), seen);
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
    answer(board, ["SQLite"]);
    expect((await waiting).outcome.isError).toBe(false);
    expect(board.problems).toEqual([]);
    expect(await session.end()).toBe(0);
  });
});
