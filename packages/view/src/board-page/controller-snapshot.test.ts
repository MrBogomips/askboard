// The board page's Snapshot requests through its controller (snapshot design decision 8; board
// protocol 1.2): the view's `snapshot` message and the Closed banner's action each send one request
// under a fresh ID, never queued and never sent again; the reply, a drop or the backstop bound ends
// it, and its feedback goes to the view's update or to the banner.

import { describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  type DraftRecord,
  type SnapshotCommand,
  type SnapshotReply,
} from "@askboard/contract";
import { ID, opened, stateOf, version, waiting } from "../../test/board-page/controller-harness.ts";
import { SNAPSHOT_REPLY_WAIT_MS } from "./snapshot-requests.ts";

const PATH = "/work/project/.askboard/snapshots/2026-11-04-1412-db-abc123.html";
const FOLDER = "/work/project/.askboard/snapshots";
const request = (n: number, unsentWork = false): SnapshotCommand => ({
  version,
  type: "snapshot",
  requestId: ID(n),
  ...(unsentWork ? { unsentWork: true } : {}),
});
const saved = (n: number): SnapshotReply => ({
  version,
  type: "snapshot-saved",
  requestId: ID(n),
  path: PATH,
});
const snapshots = (run: Awaited<ReturnType<typeof opened>>, n: number) =>
  run.socket(n).sent.filter((message) => message.type === "snapshot");
const noted: DraftRecord = {
  delivery: "immediate",
  questions: { database: { rev: 1, values: { database: ["SQLite"] }, note: "Use the replica." } },
};
const LOST = { outcome: "refused", detail: "the connection is lost" } as const;

describe("the view's Snapshot request", () => {
  test("goes at once under a fresh request ID; its saved reply reaches the view's updates", async () => {
    const run = await opened();
    expect(await run.view({ type: "snapshot" })).toEqual({ outcome: "sent", requestId: ID(1) });
    expect(snapshots(run, 1)).toEqual([request(1)]);
    run.socket(1).receive(saved(1));
    const feedback = { requestId: ID(1), outcome: "saved", path: PATH } as const;
    expect(run.updates.at(-1)?.snapshot).toEqual(feedback);
    run.socket(1).receive(stateOf(waiting));
    expect(run.updates.at(-1)?.snapshot).toEqual(feedback);
    expect(run.bannerSnapshots).toEqual([]);
  });

  test("says when the board holds unsent work, in the request and in the feedback", async () => {
    const run = await opened();
    await run.view({ type: "draft", record: noted });
    expect(await run.view({ type: "snapshot" })).toEqual({
      outcome: "sent",
      requestId: ID(1),
      unsentWork: true,
    });
    expect(snapshots(run, 1)).toEqual([request(1, true)]);
    run.socket(1).receive({
      version,
      type: "snapshot-failed",
      requestId: ID(1),
      reason: "write-failed",
      folder: FOLDER,
    });
    expect(run.updates.at(-1)?.snapshot).toEqual({
      requestId: ID(1),
      unsentWork: true,
      outcome: "failed",
      reason: "write-failed",
      folder: FOLDER,
    });
  });

  test("two requests are told apart by their IDs, whatever order their replies come in", async () => {
    const run = await opened();
    await run.view({ type: "snapshot" });
    await run.view({ type: "snapshot" });
    expect(snapshots(run, 1)).toEqual([request(1), request(2)]);
    run.socket(1).receive({
      version,
      type: "snapshot-failed",
      requestId: ID(2),
      reason: "no-project-root",
    });
    expect(run.updates.at(-1)?.snapshot).toMatchObject({ requestId: ID(2), outcome: "failed" });
    run.socket(1).receive(saved(1));
    expect(run.updates.at(-1)?.snapshot).toEqual({
      requestId: ID(1),
      outcome: "saved",
      path: PATH,
    });
  });

  test("is refused, and nothing leaves the page, while the connection is lost", async () => {
    const run = await opened();
    run.socket(1).close(1006);
    expect(await run.view({ type: "snapshot" })).toEqual(LOST);
    run.tick();
    expect(await run.view({ type: "snapshot" })).toEqual(LOST);
    run.socket(2).receive(stateOf(waiting));
    expect(snapshots(run, 1)).toEqual([]);
    expect(snapshots(run, 2)).toEqual([]);
  });

  test("a drop ends it at once as unconfirmed, and the new socket gets no second request", async () => {
    const run = await opened();
    await run.view({ type: "snapshot" });
    run.socket(1).close(1006);
    expect(run.updates.at(-1)?.snapshot).toEqual({
      requestId: ID(1),
      outcome: "failed",
      reason: "unconfirmed",
    });
    run.tick();
    run.socket(2).receive(stateOf(waiting));
    expect(snapshots(run, 2)).toEqual([]);
    run.socket(2).receive(saved(1));
    expect(run.updates.at(-1)?.snapshot).toMatchObject({ reason: "unconfirmed" });
  });

  test("with no reply after the bound it ends as unconfirmed; a later reply is logged and ignored", async () => {
    const run = await opened();
    await run.view({ type: "snapshot" });
    run.fire(SNAPSHOT_REPLY_WAIT_MS);
    expect(run.updates.at(-1)?.snapshot).toMatchObject({ requestId: ID(1), reason: "unconfirmed" });
    const updates = run.updates.length;
    run.socket(1).receive(saved(1));
    expect(run.updates).toHaveLength(updates);
    expect(run.logs.at(-1)).toContain(ID(1));
  });

  test("a reply that lands after the board moved still ends the request", async () => {
    const run = await opened();
    await run.view({ type: "snapshot" });
    run.socket(1).receive({ version, type: "moved" });
    run.socket(1).receive(saved(1));
    expect(run.updates.at(-1)?.snapshot).toMatchObject({ requestId: ID(1), outcome: "saved" });
  });

  test("is refused once the board moved or the ask is discarded", async () => {
    const moved = await opened();
    moved.socket(1).receive({ version, type: "moved" });
    expect(await moved.view({ type: "snapshot" })).toEqual({
      outcome: "refused",
      detail: "the board moved to another tab",
    });
    const discarded = await opened();
    discarded.socket(1).receive({ version, type: "discarded", reason: "session-exit" });
    expect(await discarded.view({ type: "snapshot" })).toEqual({
      outcome: "refused",
      detail: "the ask was discarded",
    });
    expect(snapshots(moved, 1)).toEqual([]);
    expect(snapshots(discarded, 1)).toEqual([]);
  });

  test("a request the discard ends hears discarded, before the board locks", async () => {
    const run = await opened();
    await run.view({ type: "snapshot" });
    run
      .socket(1)
      .receive(
        { version, type: "snapshot-failed", requestId: ID(1), reason: "discarded" },
        { version, type: "discarded", reason: "session-exit" },
      );
    run.socket(1).close(BOARD_CLOSE_CODES.discarded);
    const last = run.updates.at(-1);
    expect(last?.lock).toBe("discarded");
    expect(last?.snapshot).toEqual({ requestId: ID(1), outcome: "failed", reason: "discarded" });
  });
});

describe("the Closed banner's Snapshot", () => {
  test("a closed ask takes it on its open socket; the feedback goes to the banner", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    expect(run.page.takeSnapshot()).toEqual({ outcome: "sent", requestId: ID(1) });
    expect(snapshots(run, 1)).toEqual([request(1)]);
    run.socket(1).receive(saved(1));
    expect(run.bannerSnapshots).toEqual([{ requestId: ID(1), outcome: "saved", path: PATH }]);
    expect(run.updates.at(-1)?.snapshot).toBeUndefined();
  });

  test("a closed board waiting to reconnect sends nothing and says why", async () => {
    const run = await opened();
    run.socket(1).receive({ version, type: "closed", reason: "agent" });
    run.socket(1).close(1006);
    expect(run.page.takeSnapshot()).toEqual({
      outcome: "refused",
      detail: "the connection is lost",
    });
    expect(snapshots(run, 1)).toEqual([]);
    expect(run.logs.at(-1)).toContain("the connection is lost");
  });
});
