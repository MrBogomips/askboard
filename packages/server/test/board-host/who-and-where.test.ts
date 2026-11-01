import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { validateAgentStatus, validateOrigin } from "@askboard/contract/validate";
import type { AgentRecords, Origin } from "@askboard/core";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  plainChoiceAsk,
  removeViews,
  startHost,
} from "./helpers.ts";

// Board-host spec, Who asked and the agent status on the board (task 8.3, design decision 12): after
// the board document and the state on each connect, the board receives who asked and where, then
// the agent status, and the agent status again on each change; nothing of either before the
// board's token is accepted, and a board connecting later gets the current values only.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = PLAIN_CHOICE;
const PROJECT = "/Users/paola/src/order-service";

afterAll(removeViews);

const REVIEWER: Origin = {
  label: "Subagent code-reviewer",
  ordinal: 2,
  cwd: "/Users/paola/src/order-service-fix-retry/services/orders",
  root: "/Users/paola/src/order-service-fix-retry",
  directory: "services/orders",
  branch: "fix/retry",
  worktree: "order-service-fix-retry",
};

// A record table that binds every `ask` call to one owner with this origin.
const recordsWith = (origin: Origin): AgentRecords => ({
  bind: async (call) => (call.tool === "ask" ? { ownerKey: "owner-1", origin } : undefined),
});

const hostWith = async (
  options: { origin?: Origin; projectDir?: string | null; tokens?: readonly string[] } = {},
) =>
  startHost({
    ports: await freeRange(1),
    tokens: options.tokens ?? [token],
    ...(options.projectDir === null ? {} : { projectDir: options.projectDir ?? PROJECT }),
    push: {
      ...(options.origin === undefined ? {} : { records: recordsWith(options.origin) }),
      header: { backgroundThresholdMs: 120_000 },
    },
  });

const connect = async (port: number, boardToken = token): Promise<BoardSocket> => {
  const board = await openSocket(port, askId);
  board.send({ version, type: "connect", token: boardToken });
  expect(await board.next()).toMatchObject({ type: "board" });
  expect(await board.next()).toMatchObject({ type: "state" });
  return board;
};

const quiet = async (board: BoardSocket) => {
  await Bun.sleep(50);
  expect(board.pending).toEqual([]);
  expect(board.header).toEqual([]);
};

const call = { tool: "ask", askIds: [askId] };

describe("on connect", () => {
  test("an owned ask's board gets the board, the state, then who asked and where, then the agent status", async () => {
    const fixture = await hostWith({ origin: REVIEWER });
    try {
      const { port } = await fixture.ask(
        askId,
        { ...plainChoiceAsk(askId), agentName: "Retry review" },
        call,
      );
      const board = await connect(port);
      const origin = await board.nextHeader();
      expect(origin).toEqual({
        version,
        type: "origin",
        who: { label: "Subagent code-reviewer", name: "Retry review", ordinal: 2 },
        project: "order-service",
        directory: "services/orders",
        branch: "fix/retry",
        worktree: "order-service-fix-retry",
      });
      expect(validateOrigin(origin).ok).toBe(true);
      const agent = await board.nextHeader();
      expect(agent).toEqual({ version, type: "agent", status: "working" });
      expect(validateAgentStatus(agent).ok).toBe(true);
      expect(board.types).toEqual(["board", "state", "origin", "agent"]);
      await quiet(board);
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });

  test("an unchecked ask's board names the agent, or Agent, and the project only", async () => {
    const fixture = await hostWith();
    try {
      const { port } = await fixture.ask(askId);
      const board = await connect(port);
      expect(await board.nextHeader()).toEqual({
        version,
        type: "origin",
        who: { label: "Agent" },
        project: "order-service",
      });
      expect(await board.nextHeader()).toMatchObject({ type: "agent", status: "working" });
    } finally {
      await fixture.host.close();
    }
  });

  test("an expected answerer other than the git user is shown", async () => {
    const fixture = await hostWith();
    try {
      const { port } = await fixture.ask(askId, {
        ...plainChoiceAsk(askId),
        agentName: "Estimate review",
        expectedUser: "Marco Rossi",
      });
      const board = await connect(port);
      expect(await board.nextHeader()).toMatchObject({
        who: { label: "Agent", name: "Estimate review" },
        forUser: "Marco Rossi",
      });
    } finally {
      await fixture.host.close();
    }
  });

  test("a board connecting later gets the current status only", async () => {
    const fixture = await hostWith();
    try {
      const { port } = await fixture.ask(askId);
      fixture.core.waitStarted(askId, false)();
      const end = fixture.core.waitStarted(askId, false);
      const board = await connect(port);
      await board.nextHeader();
      expect(await board.nextHeader()).toMatchObject({ type: "agent", status: "waiting" });
      await quiet(board);
      end();
      expect(await board.nextHeader()).toMatchObject({ type: "agent", status: "working" });
    } finally {
      await fixture.host.close();
    }
  });
});

describe("on each change", () => {
  test("a live board gets each agent status change at once", async () => {
    const fixture = await hostWith();
    try {
      const { port } = await fixture.ask(askId);
      const board = await connect(port);
      await board.nextHeader();
      await board.nextHeader();
      const end = fixture.core.waitStarted(askId, false);
      expect(await board.nextHeader()).toEqual({ version, type: "agent", status: "waiting" });
      end();
      expect(await board.nextHeader()).toEqual({ version, type: "agent", status: "working" });
      await quiet(board);
    } finally {
      await fixture.host.close();
    }
  });

  test("nothing reaches a socket before its token is accepted", async () => {
    const fixture = await hostWith({ tokens: [token] });
    try {
      const { port } = await fixture.ask(askId);
      const waiting = await openSocket(port, askId);
      fixture.core.waitStarted(askId, false);
      await quiet(waiting);
      const refused = await openSocket(port, askId);
      refused.send({ version, type: "connect", token: "wrongwrongwrongwrongww" });
      expect(await refused.next()).toMatchObject({ type: "refused", reason: "token" });
      await quiet(refused);
    } finally {
      await fixture.host.close();
    }
  });
});

describe("without the session project, as in E1", () => {
  test("a board gets neither message, and an agent status change sends nothing", async () => {
    const fixture = await hostWith({ projectDir: null });
    try {
      const { port } = await fixture.ask(askId);
      const board = await connect(port);
      const end = fixture.core.waitStarted(askId, false);
      end();
      await quiet(board);
      expect(board.socket.readyState).toBe(board.socket.OPEN);
      expect(fixture.reported).toEqual([]);
    } finally {
      await fixture.host.close();
    }
  });
});
