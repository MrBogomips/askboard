// The Snapshot between the view and the board page (snapshot design decision 8): the view's request
// as a tool call, and the feedback an update carries, which the view reads only in a shape it shows.

import { describe, expect, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import { isSnapshotFeedback, type SnapshotFeedback } from "./snapshot-feedback.ts";
import {
  readViewMessage,
  readViewUpdate,
  toolCallOf,
  UPDATE_FIELDS,
  viewUpdateResult,
} from "./view-protocol.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const requestId = "aB3cD5eF7gH9jK1lM3nP5q";
const PATH = "/work/project/.askboard/snapshots/2026-11-04-1412-db-abc123.html";
const FOLDER = "/work/project/.askboard/snapshots";

describe("the view's snapshot request", () => {
  test("goes as the tool call askboard.view.snapshot, with no arguments", () => {
    const call = toolCallOf({ type: "snapshot" });
    expect(call).toEqual({ name: "askboard.view.snapshot", arguments: {} });
    expect(readViewMessage(call)).toEqual({ ok: true, value: { type: "snapshot" } });
  });

  test("an argument, such as a path the view chose, is refused, naming it", () => {
    const checked = readViewMessage({ name: "askboard.view.snapshot", arguments: { path: "/x" } });
    expect(checked.ok).toBe(false);
    expect(checked.ok ? [] : checked.problems.map((problem) => problem.path)).toEqual([
      "/arguments/path",
    ]);
  });
});

describe("a Snapshot request's end, in an update", () => {
  const ends: SnapshotFeedback[] = [
    { requestId, outcome: "saved", path: PATH },
    { requestId, unsentWork: true, outcome: "saved", path: PATH },
    { requestId, outcome: "failed", reason: "write-failed", folder: FOLDER },
    { requestId, outcome: "failed", reason: "no-project-root" },
    { requestId, outcome: "failed", reason: "internal-error" },
    { requestId, outcome: "failed", reason: "discarded" },
    { requestId, unsentWork: true, outcome: "failed", reason: "unconfirmed" },
  ];

  test.each(ends.map((end) => [`${end.outcome} ${"reason" in end ? end.reason : ""}`, end]))(
    "%s reaches the view as it was sent",
    (_, snapshot) => {
      const update = { type: "state" as const, state: waiting, snapshot };
      expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
    },
  );

  test("is no field the boot data carries: it says how a request of this page ended", () => {
    expect(UPDATE_FIELDS.snapshot).not.toHaveProperty("atBoot");
  });

  test.each([
    ["a request ID that is no action ID", { requestId: "r1", outcome: "saved", path: PATH }],
    ["a saved end without its path", { requestId, outcome: "saved" }],
    ["a saved end naming a folder", { requestId, outcome: "saved", path: PATH, folder: FOLDER }],
    ["write-failed without the folder", { requestId, outcome: "failed", reason: "write-failed" }],
    [
      "another failure naming a folder",
      { requestId, outcome: "failed", reason: "internal-error", folder: FOLDER },
    ],
    [
      "a failure naming a path",
      { requestId, outcome: "failed", reason: "unconfirmed", path: PATH },
    ],
    ["a reason no one gives", { requestId, outcome: "failed", reason: "outside-project" }],
    ["unsent work said as false", { requestId, unsentWork: false, outcome: "saved", path: PATH }],
    ["an outcome no one gives", { requestId, outcome: "pending" }],
    ["a list", [{ requestId, outcome: "saved", path: PATH }]],
  ])("%s is not one the view shows", (_, value) => {
    expect(isSnapshotFeedback(value)).toBe(false);
    expect(readViewUpdate({ type: "state", state: waiting, snapshot: value })).toBeUndefined();
  });
});
