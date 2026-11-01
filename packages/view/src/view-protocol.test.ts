import { describe, expect, test } from "bun:test";
import type { BoardState } from "@askboard/contract";
import {
  ITEM_ERROR_MAX_CHARS,
  readAnswerReply,
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
    {
      type: "answer",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27.123Z",
    },
    { type: "ready", itemId: "database" },
    { type: "item-error", itemId: "database", error: "the component threw" },
  ];
  // Answers with a test-only `probe` widget item's full edited value (design decisions 7 and 12).
  const answers: ViewMessage[] = [
    {
      type: "answer",
      itemId: "plan",
      rev: 1,
      values: { sketch: { size: 4 } },
      when: "2026-10-30T09:41:27.123Z",
    },
    {
      type: "answer",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      values: { sketch: { size: 4 }, second: { size: 1 } },
      when: "2026-10-30T09:41:27.123Z",
    },
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

  test.each(answers.map((message) => [Object.keys(message).join(", "), message] as const))(
    "an answer with widget values (%s) goes as a tool call and reads back",
    (_, message) => {
      expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    },
  );

  test("an answer's values are keyed by own-property item IDs, as JSON gives them", () => {
    const args = JSON.parse(
      '{"itemId":"q","rev":1,"when":"2026-10-30T09:41:27Z","values":{"__proto__":{"size":4}}}',
    );
    const checked = readViewMessage({ name: "askboard.view.answer", arguments: args });
    const values = checked.ok && checked.value.type === "answer" ? checked.value.values : {};
    expect(Object.keys(values ?? {})).toEqual(["__proto__"]);
    expect(Object.hasOwn(values ?? {}, "__proto__")).toBe(true);
  });

  test("a missing field is refused, naming it; only an answer's choice and values may be left out", () => {
    expect(problemsOf({ name: "askboard.view.answer", arguments: { choice: ["a"] } })).toEqual([
      { path: "/arguments/itemId", message: 'missing field "itemId"' },
      { path: "/arguments/rev", message: 'missing field "rev"' },
      { path: "/arguments/when", message: 'missing field "when"' },
    ]);
  });

  test("an answer with neither a choice nor values is refused", () => {
    const args = { itemId: "q", rev: 1, when: "2026-10-30T09:41:27Z" };
    expect(problemsOf({ name: "askboard.view.answer", arguments: args })).toEqual([
      { path: "/arguments", message: 'holds none of "choice" and "values"' },
    ]);
  });

  test("an answer's values map one or more item IDs, each to an object", () => {
    const base = { itemId: "q", rev: 1, when: "2026-10-30T09:41:27Z" };
    for (const values of [
      undefined,
      null,
      [],
      [{ size: 4 }],
      "sketch",
      {},
      { "a b": { size: 4 } },
      { ["x".repeat(65)]: { size: 4 } },
      { sketch: null },
      { sketch: [1] },
      { sketch: 4 },
      { sketch: { size: 4 }, other: "x" },
    ]) {
      const params = { name: "askboard.view.answer", arguments: { ...base, values } };
      expect(problemsOf(params)).toEqual([
        { path: "/arguments/values", message: expect.stringContaining("item IDs") },
      ]);
    }
  });

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

  test("an answer's choice is a non-empty list of distinct, non-empty labels", () => {
    const base = { itemId: "q", rev: 1, when: "2026-10-30T09:41:27Z" };
    for (const choice of [undefined, [], "PostgreSQL", ["a", "a"], [""], [1]]) {
      const params = { name: "askboard.view.answer", arguments: { ...base, choice } };
      expect(problemsOf(params)[0]?.path).toBe("/arguments/choice");
    }
  });

  test("an answer names a revision from 1 and the time of the act in UTC (FR-19)", () => {
    const base = { itemId: "q", choice: ["a"] };
    for (const [field, value] of [
      ["rev", 0],
      ["rev", 1.5],
      ["rev", "1"],
      ["when", "2026-10-30 09:41:27"],
      ["when", "2026-10-30T09:41:27+01:00"],
      ["when", 1_761_817_287_000],
    ] as const) {
      const args = { rev: 1, when: "2026-10-30T09:41:27Z", ...base, [field]: value };
      expect(problemsOf({ name: "askboard.view.answer", arguments: args })[0]?.path).toBe(
        `/arguments/${field}`,
      );
    }
  });

  test("an item error without its text is refused", () => {
    const params = { name: "askboard.view.item-error", arguments: { itemId: "q", error: 3 } };
    expect(problemsOf(params)[0]?.path).toBe("/arguments/error");
  });
});

describe("the board page's reply to an answer", () => {
  test("says the answer was sent, queued while disconnected, or why it was refused", () => {
    expect(readAnswerReply({ outcome: "sent" })).toEqual({ outcome: "sent" });
    expect(readAnswerReply({ outcome: "queued" })).toEqual({ outcome: "queued" });
    expect(readAnswerReply({ outcome: "refused", detail: "not open" })).toEqual({
      outcome: "refused",
      detail: "not open",
    });
  });

  test("anything else is no reply", () => {
    for (const reply of [undefined, {}, { outcome: "read" }, { outcome: "refused" }]) {
      expect(readAnswerReply(reply)).toBeUndefined();
    }
  });
});

describe("what the board page tells the view after boot, as tool-result notifications", () => {
  test("a state update goes as the result's structured content and reads back", () => {
    const result = viewUpdateResult({ type: "state", state: waiting });
    expect(result.content).toEqual([]);
    expect(readViewUpdate(result.structuredContent)).toEqual({ type: "state", state: waiting });
  });

  test("the update says when the board page locked the view, and why (AD-21)", () => {
    for (const lock of ["discarded", "moved"] as const) {
      const result = viewUpdateResult({ type: "state", state: waiting, lock });
      expect(readViewUpdate(result.structuredContent)).toEqual({
        type: "state",
        state: waiting,
        lock,
      });
    }
    expect(readViewUpdate({ type: "state", state: waiting, lock: "closed" })).toBeUndefined();
  });

  test("the update lists the answers the board page holds, sent or queued", () => {
    const pending = [
      {
        itemId: "database",
        choice: ["PostgreSQL"],
        when: "2026-10-30T10:00:00Z",
        outcome: "queued",
      },
    ] as const;
    const result = viewUpdateResult({ type: "state", state: waiting, pending });
    expect(readViewUpdate(result.structuredContent)).toEqual({
      type: "state",
      state: waiting,
      pending,
    });
    const [held] = pending;
    for (const wrong of [
      "database",
      [{ ...held, itemId: "x y" }],
      [{ ...held, choice: [1] }],
      [{ ...held, when: 5 }],
      [{ ...held, outcome: "read" }],
      [null],
    ]) {
      expect(readViewUpdate({ type: "state", state: waiting, pending: wrong })).toBeUndefined();
    }
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
