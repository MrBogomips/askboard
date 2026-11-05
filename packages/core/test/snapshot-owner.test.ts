import { describe, expect, test } from "bun:test";
import { type SnapshotRequester, SnapshotWriteError } from "../src/index.ts";
import { areasAsk, command, LIFECYCLE_ID } from "./lifecycle-fakes.ts";
import { callOf } from "./push-fakes.ts";
import {
  fakeWriter,
  SHOP_ORIGIN,
  SHOP_OWNER,
  SNAPSHOT_FOLDER,
  snapshotCoreWith,
} from "./snapshot-fakes.ts";

// Core spec: Only the owner's agent takes a Snapshot, A Snapshot changes nothing (snapshot task 2.3,
// design decision 3): the agent's request passes `ownerRefusal(askId, caller)`, the check `fetch`
// applies, after the discard check; the board's carries no binding; and no Snapshot, taken or not,
// appends, publishes or moves anything.

const OTHER = "agent-91c2";
const BOARD = { takenBy: "user", unsentWork: false } as const;
const WHEN = "2026-10-31T14:05:12Z";

/** The lifecycle ask, owned by `SHOP_OWNER` unless `unchecked`, with one answer logged. */
const askWith = async (writer = fakeWriter(), unchecked = false) => {
  const fixture = snapshotCoreWith({ snapshots: { writer: writer.writer, projectDir: "/s" } });
  const { core, table } = fixture;
  table.add({ ownerKey: SHOP_OWNER, tool: "ask", askIds: [LIFECYCLE_ID], origin: SHOP_ORIGIN });
  const created = await core.ask(areasAsk(), unchecked ? undefined : callOf("ask", LIFECYCLE_ID));
  if (created.kind !== "created") throw new Error(`the ask was not created: ${created.kind}`);
  const answer = { type: "answer", itemId: "region", rev: 1, choice: ["EU"], when: WHEN } as const;
  core.act(LIFECYCLE_ID, command([answer]));
  /** The agent's request from a call of `ownerKey`'s record, bound as `mcp-tools` binds it. */
  const agentOf = async (ownerKey: string): Promise<SnapshotRequester> => {
    table.add({ ownerKey, tool: "snapshot", askIds: [LIFECYCLE_ID] });
    const caller = await core.bind(callOf("snapshot", LIFECYCLE_ID));
    return { takenBy: "agent", ...(caller === undefined ? {} : { caller }) };
  };
  return { ...fixture, ...writer, agentOf };
};

describe("only the owner's agent takes a Snapshot", () => {
  test("another agent's request is refused, and nothing is written", async () => {
    const { core, written, agentOf } = await askWith();
    const outcome = await core.snapshot(LIFECYCLE_ID, await agentOf(OTHER));
    expect(outcome).toEqual({ outcome: "refused", why: "other-owner" });
    expect(written).toEqual([]);
  });

  test("an unbound call on an owned ask is refused, and nothing is written", async () => {
    const { core, written } = await askWith();
    const outcome = await core.snapshot(LIFECYCLE_ID, { takenBy: "agent" });
    expect(outcome).toEqual({ outcome: "refused", why: "no-record" });
    expect(written).toEqual([]);
  });

  test("the owner's request is taken, and the ask is checked", async () => {
    const { core, written, agentOf } = await askWith();
    const outcome = await core.snapshot(LIFECYCLE_ID, await agentOf(SHOP_OWNER));
    expect(outcome).toMatchObject({ outcome: "saved", unchecked: false });
    expect(written).toHaveLength(1);
  });

  test("the board's request on an owned ask carries no binding and is taken", async () => {
    const { core, written } = await askWith();
    expect(await core.snapshot(LIFECYCLE_ID, BOARD)).toMatchObject({
      outcome: "saved",
      unchecked: false,
    });
    expect(written).toHaveLength(1);
  });

  test("an unchecked ask takes any agent's request, bound or not, and says it is unchecked", async () => {
    const { core, written, agentOf } = await askWith(fakeWriter(), true);
    for (const request of [await agentOf(OTHER), { takenBy: "agent" } as const]) {
      expect(await core.snapshot(LIFECYCLE_ID, request)).toMatchObject({
        outcome: "saved",
        unchecked: true,
      });
    }
    expect(written).toHaveLength(2);
  });

  test("the discard comes first: another agent's request for a discarded ask is `discarded`", async () => {
    const { core, written, agentOf } = await askWith();
    core.discardAll("session-exit");
    expect(await core.snapshot(LIFECYCLE_ID, await agentOf(OTHER))).toEqual({
      outcome: "discarded",
    });
    expect(written).toEqual([]);
  });
});

describe("a Snapshot changes nothing", () => {
  const writers = {
    saved: () => fakeWriter(),
    "no-project-root": () => fakeWriter({ fails: SnapshotWriteError.noProjectRoot() }),
    "write-failed": () =>
      fakeWriter({ fails: SnapshotWriteError.inFolder(SNAPSHOT_FOLDER, "EROFS") }),
  } as const;
  const cases = [
    ["the owner's, saved", "saved", SHOP_OWNER],
    ["the board's, saved", "saved", undefined],
    ["another agent's, refused", "refused", OTHER],
    ["the board's, without a project root", "no-project-root", undefined],
    ["the owner's, failing in its folder", "write-failed", SHOP_OWNER],
  ] as const;

  test.each(cases)(
    "%s: no event, no publication, `received` and every state as before",
    async (_, outcome, ownerKey) => {
      const writer = outcome === "refused" ? writers.saved() : writers[outcome]();
      const { core, heard, agentOf } = await askWith(writer);
      core.markRead(LIFECYCLE_ID, `${core.epoch}.1`);
      const request = ownerKey === undefined ? BOARD : await agentOf(ownerKey);
      const overview = core.overview();
      const board = core.lifecycleBoard(LIFECYCLE_ID);
      heard.length = 0;
      expect(await core.snapshot(LIFECYCLE_ID, request)).toMatchObject({ outcome });
      expect(heard).toEqual([]);
      expect(core.overview()).toEqual(overview);
      expect(core.lifecycleBoard(LIFECYCLE_ID)).toEqual(board);
      expect(core.markRead(LIFECYCLE_ID, `${core.epoch}.1`)).toBe(false);
    },
  );

  test("the agent then collects: no event for the Snapshot, its cursor and state as before", async () => {
    const { core, agentOf } = await askWith();
    await core.snapshot(LIFECYCLE_ID, BOARD);
    await core.snapshot(LIFECYCLE_ID, await agentOf(SHOP_OWNER));
    const read = core.read(LIFECYCLE_ID, `${core.epoch}.0`, { ownerKey: SHOP_OWNER });
    expect(read).toMatchObject({
      kind: "events",
      state: "partly-answered",
      cursor: `${core.epoch}.1`,
      events: [{ type: "answer", itemId: "region" }],
    });
  });
});
