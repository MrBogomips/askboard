// The board page's Snapshot requests (snapshot design decision 8): each tracked by its ID until its
// reply, a drop or the backstop bound ends it, once, with the feedback for where it came from.

import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type SnapshotReply } from "@askboard/contract";
import type { SnapshotFeedback } from "../view-protocol.ts";
import {
  createSnapshotRequests,
  SNAPSHOT_REPLY_WAIT_MS,
  type SnapshotSource,
} from "./snapshot-requests.ts";

const version = BOARD_PROTOCOL_VERSION;
const FIRST = "aB3cD5eF7gH9jK1lM3nP5q";
const SECOND = "zY8xW6vU4tS2rQ0pO8nM6l";
const PATH = "/work/project/.askboard/snapshots/2026-11-04-1412-db-abc123.html";
const FOLDER = "/work/project/.askboard/snapshots";

type Timer = { readonly ms: number; readonly run: () => void; cancelled: boolean };

const setUp = () => {
  const timers: Timer[] = [];
  const ended: [SnapshotSource, SnapshotFeedback][] = [];
  const requests = createSnapshotRequests({
    schedule: (ms, run) => {
      const timer: Timer = { ms, run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    end: (source, feedback) => ended.push([source, feedback]),
  });
  const live = () => timers.filter((timer) => !timer.cancelled);
  return { requests, timers, ended, live };
};

const saved = (requestId: string): SnapshotReply => ({
  version,
  type: "snapshot-saved",
  requestId,
  path: PATH,
});

describe("a Snapshot request's reply", () => {
  test("snapshot-saved ends the request with the path, where it came from, and cancels its bound", () => {
    const run = setUp();
    run.requests.track(FIRST, "view", false);
    expect(run.live().map((timer) => timer.ms)).toEqual([SNAPSHOT_REPLY_WAIT_MS]);
    expect(run.requests.reply(saved(FIRST))).toBe(true);
    expect(run.ended).toEqual([["view", { requestId: FIRST, outcome: "saved", path: PATH }]]);
    expect(run.live()).toEqual([]);
  });

  test("the unsent-work flag of the request goes with its feedback", () => {
    const run = setUp();
    run.requests.track(FIRST, "banner", true);
    run.requests.reply(saved(FIRST));
    expect(run.ended).toEqual([
      ["banner", { requestId: FIRST, unsentWork: true, outcome: "saved", path: PATH }],
    ]);
  });

  test("snapshot-failed keeps its reason, and the folder only for write-failed", () => {
    const run = setUp();
    run.requests.track(FIRST, "view", false);
    run.requests.track(SECOND, "view", false);
    run.requests.reply({
      version,
      type: "snapshot-failed",
      requestId: SECOND,
      reason: "write-failed",
      folder: FOLDER,
    });
    run.requests.reply({
      version,
      type: "snapshot-failed",
      requestId: FIRST,
      reason: "internal-error",
    });
    expect(run.ended).toEqual([
      ["view", { requestId: SECOND, outcome: "failed", reason: "write-failed", folder: FOLDER }],
      ["view", { requestId: FIRST, outcome: "failed", reason: "internal-error" }],
    ]);
  });

  test("a reply for a request the page does not track changes nothing", () => {
    const run = setUp();
    run.requests.track(FIRST, "view", false);
    expect(run.requests.reply(saved(SECOND))).toBe(false);
    expect(run.requests.reply(saved(FIRST))).toBe(true);
    expect(run.requests.reply(saved(FIRST))).toBe(false);
    expect(run.ended).toHaveLength(1);
  });
});

describe("a Snapshot request with no reply", () => {
  test("a drop ends every tracked request unconfirmed, once, naming no folder", () => {
    const run = setUp();
    run.requests.track(FIRST, "view", true);
    run.requests.track(SECOND, "banner", false);
    run.requests.drop();
    run.requests.drop();
    expect(run.ended).toEqual([
      ["view", { requestId: FIRST, unsentWork: true, outcome: "failed", reason: "unconfirmed" }],
      ["banner", { requestId: SECOND, outcome: "failed", reason: "unconfirmed" }],
    ]);
    expect(run.live()).toEqual([]);
    expect(run.requests.reply(saved(FIRST))).toBe(false);
  });

  test("the bound ends the request unconfirmed; a reply after it changes nothing", () => {
    const run = setUp();
    run.requests.track(FIRST, "view", false);
    run.timers[0]?.run();
    expect(run.ended).toEqual([
      ["view", { requestId: FIRST, outcome: "failed", reason: "unconfirmed" }],
    ]);
    expect(run.requests.reply(saved(FIRST))).toBe(false);
    run.requests.drop();
    expect(run.ended).toHaveLength(1);
  });

  test("the bound is the backstop for a lost reply, longer than a Snapshot takes", () => {
    expect(SNAPSHOT_REPLY_WAIT_MS).toBe(60_000);
  });
});
