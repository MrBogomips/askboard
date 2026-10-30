import { describe, expect, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import {
  ITEM_ERROR_MAX_CHARS,
  readViewMessage,
  readViewUpdate,
  toolCallOf,
  VIEW_TOOL_PREFIX,
  type ViewMessage,
  viewUpdateResult,
} from "./view-protocol.ts";

const waiting: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};

const problemsOf = (params: unknown) => {
  const checked = readViewMessage(params);
  return checked.ok ? [] : checked.problems;
};

describe("view messages, as App tool calls the board page answers itself (design decision 8)", () => {
  const messages: ViewMessage[] = [
    { type: "ready", itemId: "database" },
    { type: "item-error", itemId: "database", error: "the component threw" },
  ];

  test.each(messages.map((message) => [message.type, message] as const))(
    "a %s message goes as a tool call under askboard.view.* and reads back",
    (type, message) => {
      const call = toolCallOf(message);
      expect(call.name).toBe(`${VIEW_TOOL_PREFIX}${type}`);
      expect(call.arguments).not.toHaveProperty("type");
      // ext-apps adds `_meta` to every call it sends.
      expect(readViewMessage({ ...call, _meta: { progressToken: 1 } })).toEqual({
        ok: true,
        value: message,
      });
    },
  );

  test("an item error longer than the cap is cut on the way out, never refused", () => {
    const call = toolCallOf({ type: "item-error", itemId: "q", error: "x".repeat(5_000) });
    const checked = readViewMessage(call);
    expect(checked.ok && checked.value.type === "item-error" && checked.value.error.length).toBe(
      ITEM_ERROR_MAX_CHARS,
    );
  });

  test("a call that is not an object, or has no name, is refused", () => {
    for (const params of [null, "ready", [], {}, { name: 7 }]) {
      expect(problemsOf(params)[0]?.path).toBe("/name");
    }
  });

  test("a name outside askboard.view.*, or naming no view message, is refused", () => {
    for (const name of ["ready", "askboard.view.", "askboard.view.constructor", "x.ready"]) {
      expect(problemsOf({ name, arguments: { itemId: "q" } })).toEqual([
        { path: "/name", message: expect.stringContaining("view message") },
      ]);
    }
  });

  test("arguments that are missing or not an object are refused", () => {
    for (const args of [undefined, null, "q", ["q"]]) {
      expect(problemsOf({ name: "askboard.view.ready", arguments: args })[0]?.path).toBe(
        "/arguments",
      );
    }
  });

  test("an unknown field is refused, naming it", () => {
    const params = { name: "askboard.view.ready", arguments: { itemId: "q", extra: 1 } };
    expect(problemsOf(params)).toEqual([
      { path: "/arguments/extra", message: 'unknown field "extra"' },
    ]);
  });

  test("an item ID outside the ID pattern, or missing, is refused", () => {
    for (const itemId of [undefined, "", "a b", "x".repeat(65), 7]) {
      expect(problemsOf({ name: "askboard.view.ready", arguments: { itemId } })[0]?.path).toBe(
        "/arguments/itemId",
      );
    }
  });

  test("an item error without its text is refused", () => {
    const params = { name: "askboard.view.item-error", arguments: { itemId: "q", error: 3 } };
    expect(problemsOf(params)[0]?.path).toBe("/arguments/error");
  });
});

describe("what the board page tells the view after boot, as tool-result notifications", () => {
  test("a state update goes as the result's structured content and reads back", () => {
    const result = viewUpdateResult({ type: "state", state: waiting });
    expect(result.content).toEqual([]);
    expect(readViewUpdate(result.structuredContent)).toEqual({ type: "state", state: waiting });
  });

  test("anything else is not an update", () => {
    for (const content of [
      undefined,
      null,
      "state",
      { type: "state" },
      { type: "state", state: { ask: "waiting" } },
      { type: "state", state: { ask: 1, questions: [] } },
      { type: "constructor", state: waiting },
    ]) {
      expect(readViewUpdate(content)).toBeUndefined();
    }
  });
});
