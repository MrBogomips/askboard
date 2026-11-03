// The view's activity message (design decision 10): input inside the sandboxed view does not reach
// the board page, so the view tells it, at most once every interval while the user acts in it, as
// a view message the board page's `AppBridge` answers itself.

import { describe, expect, test } from "bun:test";
import {
  readViewMessage,
  toolCallOf,
  VIEW_ACTIVITY_INTERVAL_MS,
  VIEW_TOOL_PREFIX,
} from "../view-protocol.ts";
import { createActivityReporter } from "./activity.ts";

describe("the activity message", () => {
  test("goes as askboard.view.activity with no arguments, and reads back", () => {
    const call = toolCallOf({ type: "activity" });
    expect(call).toEqual({ name: `${VIEW_TOOL_PREFIX}activity`, arguments: {} });
    expect(readViewMessage(call)).toEqual({ ok: true, value: { type: "activity" } });
  });

  test("carries nothing: any field is refused, naming it", () => {
    const checked = readViewMessage({
      name: `${VIEW_TOOL_PREFIX}activity`,
      arguments: { key: "a" },
    });
    expect(checked).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/arguments/key", message: 'unknown field "key"' }],
    });
  });
});

describe("the activity reporter", () => {
  test("sends at the first input, then at most once every interval", () => {
    let now = 1_000;
    const sent: number[] = [];
    const input = createActivityReporter(
      () => sent.push(now),
      () => now,
    );
    input();
    now += VIEW_ACTIVITY_INTERVAL_MS - 1;
    input();
    now += 1;
    input();
    input();
    now += VIEW_ACTIVITY_INTERVAL_MS * 3;
    input();
    expect(sent).toEqual([
      1_000,
      1_000 + VIEW_ACTIVITY_INTERVAL_MS,
      1_000 + VIEW_ACTIVITY_INTERVAL_MS * 4,
    ]);
  });

  test("the interval is five seconds", () => {
    expect(VIEW_ACTIVITY_INTERVAL_MS).toBe(5_000);
  });
});
