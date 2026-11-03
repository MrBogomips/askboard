import { describe, expect, test } from "bun:test";
import { RESULT_VERSIONS, SCHEMA_IDS, type SnapshotData } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import { AskCore, type CorePorts } from "@askboard/core";
import { connect, depsWith, jsonOf, LINK, runtimeClock } from "./helpers.ts";

// MCP adapter spec: Taking a Snapshot with the tool, Snapshot of a discarded ask, Snapshot of an
// unchecked ask, The tool reads nothing to the agent (snapshot, task 5.2), over the real ask-core
// with a writer that keeps what it is handed.

const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: plainChoiceBoardDocument.askId,
  items: [{ type: question.type, id: question.id, props: question.props }],
};
const { askId } = plainChoice;
const PATH = `/home/sara/shop/.askboard/snapshots/${askId}-20261103T094127Z-k3x9a1.html`;

const session = async () => {
  const written: SnapshotData[] = [];
  const ports: CorePorts = {
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => "Paola Greco", loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
    snapshots: {
      writer: {
        write: async (data) => {
          written.push(data);
          return { path: PATH };
        },
      },
    },
  };
  const core = new AskCore(ports);
  const { client, close } = await connect(depsWith(core).deps);
  const callRaw = (name: string, args: unknown) =>
    client.callTool({ name, arguments: args as never });
  const call = async (name: string, args: unknown) =>
    jsonOf(await callRaw(name, args)) as Record<string, unknown>;
  return { core, call, callRaw, close, written };
};

const answered = (core: AskCore) =>
  core.act(askId, {
    actionId: `01${"a".repeat(20)}`,
    acts: [
      {
        type: "answer",
        itemId: question.id,
        rev: 1,
        choice: ["PostgreSQL"],
        when: "2026-11-03T09:41:27Z",
      },
    ],
  }).ok;

describe("the snapshot tool over ask-core", () => {
  test("an answer not yet collected: the Snapshot holds it, and collect after the last cursor still returns it", async () => {
    const { core, call, close, written } = await session();
    const asked = await call("ask", plainChoice);
    expect(answered(core)).toBe(true);
    const taken = await call("snapshot", { askId });
    expect(taken).toEqual({
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId,
      state: "answered",
      path: PATH,
      unchecked: true,
    });
    expect(validateAgainst(SCHEMA_IDS.snapshotResult, taken).ok).toBe(true);
    expect(written.map(({ snapshot }) => snapshot)).toEqual([
      { takenBy: "agent", takenAt: expect.any(String) },
    ]);
    // The Snapshot raised no `received`: the answer is still undelivered on the board.
    const view = core.lifecycleBoard(askId);
    expect(view?.state !== "discarded" && view?.questions[0]?.answer?.delivered).toBe(false);
    const collected = await call("collect", { asks: [{ askId, after: asked.cursor }] });
    expect(collected.asks).toEqual([
      expect.objectContaining({
        askId,
        events: [expect.objectContaining({ type: "answer", choice: ["PostgreSQL"] })],
      }),
    ]);
    await close();
  });

  test("an ask from before a restart is discarded, never unknown, and nothing reaches the writer", async () => {
    const { core, callRaw, close, written } = await session();
    const before = "sent-before-restart-k2m9";
    const result = await callRaw("snapshot", { askId: before });
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId: before,
      outcome: "discarded",
    });
    expect(validateAgainst(SCHEMA_IDS.snapshotOutcome, json).ok).toBe(true);
    expect(written).toEqual([]);
    await close();
  });

  test("a discarded ask is discarded, and nothing reaches the writer", async () => {
    const { core, call, close, written } = await session();
    await call("ask", plainChoice);
    core.discardAll("session-exit");
    expect(await call("snapshot", { askId })).toMatchObject({ askId, outcome: "discarded" });
    expect(written).toEqual([]);
    await close();
  });

  test("a closed ask's Snapshot is taken, with the state closed", async () => {
    const { call, close, written } = await session();
    await call("ask", plainChoice);
    await call("update", { askId, actions: [{ action: "close" }] });
    expect(await call("snapshot", { askId })).toMatchObject({ state: "closed", path: PATH });
    expect(written).toHaveLength(1);
    await close();
  });

  test("a path in the request is an error naming it, and nothing reaches the writer", async () => {
    const { callRaw, call, close, written } = await session();
    await call("ask", plainChoice);
    const result = await callRaw("snapshot", { askId, path: "/tmp/board.html" });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("path");
    expect(written).toEqual([]);
    await close();
  });
});
