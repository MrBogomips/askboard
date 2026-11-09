import { describe, expect, test } from "bun:test";
import {
  type BoardState,
  type DraftRecord,
  JSON_MAX_DEPTH,
  KEY_ACTION_MAX_CHARS,
  KEY_COMBINATION_MAX_CHARS,
  KEY_OVERRIDE_MAX_COMBINATIONS,
  KEY_OVERRIDES_MAX_ACTIONS,
  SCHEMA_IDS,
  SCHEMA_SETS,
} from "@askboard/contract";
import {
  ganttEditedValue,
  lifecycleBoardDocument,
  lifecycleDraftRecord,
} from "@askboard/contract/fixtures";
import { validateConfiguration } from "@askboard/contract/validate";
import {
  fieldProblems,
  ITEM_ERROR_MAX_CHARS,
  type MessageFields,
  REFERENCE_PATTERN,
  readActReply,
  readAnswerReply,
  readDraftReply,
  readViewMessage,
  readViewUpdate,
  toolCallOf,
  UPDATE_FIELDS,
  type UpdateField,
  type UpdateFields,
  VIEW_TOOL_PREFIX,
  type ViewAnswer,
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

  test("a missing field is refused, naming it; only an answer's choice, values and derived values may be left out", () => {
    expect(problemsOf({ name: "askboard.view.answer", arguments: { choice: ["a"] } })).toEqual([
      { path: "/arguments/itemId", message: 'missing field "itemId"' },
      { path: "/arguments/rev", message: 'missing field "rev"' },
      { path: "/arguments/when", message: 'missing field "when"' },
    ]);
  });

  test("an answer with neither a choice, values nor Other text is refused", () => {
    const args = { itemId: "q", rev: 1, when: "2026-10-30T09:41:27Z", note: "only a note" };
    expect(problemsOf({ name: "askboard.view.answer", arguments: args })).toEqual([
      { path: "/arguments", message: 'holds none of "choice", "values", "results" and "other"' },
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

const DERIVED_ALONE = 'comes only beside "choice", "values", "results" or "other"';

describe("an answer's derived values (gantt-widget design decision 10; AD-13, AD-20, FR-12)", () => {
  // The Gantt question's answer: the Gantt's full edited value and its derived values.
  const base = {
    itemId: "schedule-review",
    rev: 1,
    values: { release: ganttEditedValue },
    when: "2026-10-31T09:41:27.123Z",
  };
  const derived = {
    "release.finish": "2026-12-16",
    "release.criticalPath": ["reporting"],
  };
  const call = (args: Record<string, unknown>) => ({
    name: "askboard.view.answer",
    arguments: args,
  });

  test("an answer carrying derived values beside its widget values goes as a tool call and reads back", () => {
    const message: ViewAnswer = { type: "answer", ...base, derived };
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
  });

  test("a reference is AD-13's, as the output format's answer event writes its derived keys", () => {
    const answerEvent = SCHEMA_SETS.flatMap((set) => set.schemas).find(
      (schema) => (schema as { $id?: string }).$id === SCHEMA_IDS.answerEvent,
    ) as { $defs: { reference: { pattern: string } } } | undefined;
    expect(REFERENCE_PATTERN).toBe(answerEvent?.$defs.reference.pattern ?? "");
  });

  test("every JSON value is taken: text, numbers, true, false, null, lists and objects", () => {
    const values = {
      release: "x",
      "release.a": 1.5,
      "release.b-1.c_2": -3,
      "release.d": true,
      "release.e": false,
      "release.f": null,
      "release.g": [1, ["x", null], { h: [] }],
      "release.i": { j: { k: "l" }, m: [] },
      [`${"r".repeat(64)}.${"s".repeat(64)}`]: 0,
    };
    expect(problemsOf(call({ ...base, derived: values }))).toEqual([]);
  });

  test("references are own properties, as JSON gives them", () => {
    const args = JSON.parse(
      `{"itemId":"q","rev":1,"when":"2026-10-30T09:41:27Z","values":{"r":{}},"derived":{"__proto__":1}}`,
    );
    const checked = readViewMessage(call(args));
    const read = checked.ok && checked.value.type === "answer" ? checked.value.derived : {};
    expect(Object.keys(read ?? {})).toEqual(["__proto__"]);
    expect(Object.hasOwn(read ?? {}, "__proto__")).toBe(true);
  });

  test("anything but one or more references, each to a JSON value, is refused", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const shared = ["ux"];
    for (const value of [
      undefined,
      null,
      [],
      [{ "release.finish": "2026-12-16" }],
      "release.finish",
      {},
      { "release..finish": 1 },
      { "release.": 1 },
      { ".finish": 1 },
      { "release finish": 1 },
      { "release[0]": 1 },
      { "release.tasks.0": 1, "release:finish": 1 },
      { [`release.${"x".repeat(65)}`]: 1 },
      { "release.finish": undefined },
      { "release.finish": Number.NaN },
      { "release.finish": Number.POSITIVE_INFINITY },
      { "release.finish": () => "2026-12-16" },
      { "release.finish": 1n },
      { "release.finish": Symbol("finish") },
      { "release.finish": new Date(0) },
      { "release.finish": new Map() },
      { "release.path": [undefined] },
      // biome-ignore lint/suspicious/noSparseArray: a hole is no JSON value.
      { "release.path": [, "ux"] },
      { "release.path": { a: { b: Number.NaN } } },
      { "release.path": cycle },
      { "release.a": shared, "release.b": shared },
    ]) {
      expect(problemsOf(call({ ...base, derived: value }))).toEqual([
        { path: "/arguments/derived", message: expect.stringContaining("references") },
      ]);
    }
  });

  test("a deep value is walked without overflowing the stack, and refused past the JSON bound (X-5)", () => {
    let deep: unknown = "ux";
    for (let level = 0; level < 200_000; level += 1) deep = [deep];
    expect(
      problemsOf(call({ ...base, derived: { "release.deep": deep } })).map(({ path }) => path),
    ).toEqual(["/arguments/derived"]);
  });

  test("derived values come beside any answer content, never alone (design decision 10)", () => {
    const { values: _, ...withoutValues } = base;
    expect(problemsOf(call({ ...withoutValues, choice: ["Yes"], derived }))).toEqual([]);
    expect(problemsOf(call({ ...withoutValues, other: "Maybe", derived }))).toEqual([]);
    expect(problemsOf(call({ ...withoutValues, derived }))).toEqual([
      { path: "/arguments", message: 'holds none of "choice", "values", "results" and "other"' },
      { path: "/arguments/derived", message: DERIVED_ALONE },
    ]);
    expect(problemsOf(call({ ...withoutValues, note: "only a note", derived }))).toEqual([
      { path: "/arguments", message: 'holds none of "choice", "values", "results" and "other"' },
      { path: "/arguments/derived", message: DERIVED_ALONE },
    ]);
  });

  // The answer act of an act command, which the answer message's checks serve too (ask-lifecycle,
  // design decision 6; cross-review M3).
  const actCall = (...acts: unknown[]) => ({ name: "askboard.view.act", arguments: { acts } });
  const note = {
    type: "note",
    itemId: "schedule-review",
    rev: 1,
    note: "See the plan.",
    when: base.when,
  } as const;

  test("an answer act carrying derived values beside its widget values goes in an act command and reads back", () => {
    const act = { type: "answer", ...base, derived } as const;
    expect(readViewMessage(actCall(note, act))).toEqual({
      ok: true,
      value: { type: "act", acts: [note, act] },
    });
  });

  test("an answer act's derived values come beside any answer content, never alone, the act and the field named", () => {
    const { values: _, ...withoutValues } = base;
    const act = { type: "answer", ...withoutValues, choice: ["Yes"], derived };
    expect(problemsOf(actCall(note, act))).toEqual([]);
    expect(problemsOf(actCall({ type: "answer", ...withoutValues, derived }))).toEqual([
      {
        path: "/arguments/acts/0",
        message: 'holds none of "choice", "values", "results" and "other"',
      },
      { path: "/arguments/acts/0/derived", message: DERIVED_ALONE },
    ]);
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

  test("the update says when the board page locked the view, and why (AD-21, FR-6)", () => {
    for (const lock of ["discarded", "moved", "closed"] as const) {
      const result = viewUpdateResult({ type: "state", state: waiting, lock });
      expect(readViewUpdate(result.structuredContent)).toEqual({
        type: "state",
        state: waiting,
        lock,
      });
    }
    expect(readViewUpdate({ type: "state", state: waiting, lock: "gone" })).toBeUndefined();
  });

  test("the update lists the act commands the board page holds, sent or queued, by action ID", () => {
    const pending = [{ actionId: ACTION_ID, outcome: "queued" }] as const;
    const result = viewUpdateResult({ type: "state", state: waiting, pending });
    expect(readViewUpdate(result.structuredContent)).toEqual({
      type: "state",
      state: waiting,
      pending,
    });
    const [held] = pending;
    for (const wrong of [
      "database",
      [{ ...held, actionId: "short" }],
      [{ ...held, outcome: "read" }],
      [{ outcome: "sent" }],
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

const ACTION_ID = "Ab3dE5gH7jK9mN1pQ3sT5v";
const WHEN = "2026-10-31T09:41:27.123Z";

describe("the lifecycle's view messages (ask-lifecycle, design decision 6)", () => {
  test("an answer carries the Other text, the option notes and the open prompt's note (FR-3, FR-7)", () => {
    const message: ViewMessage = {
      type: "answer",
      itemId: "payment",
      rev: 1,
      other: "Mollie",
      optionNotes: { Adyen: "Ask the shop team." },
      note: "Cheaper for iDEAL.",
      when: WHEN,
    };
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
  });

  test("an answer's Other text, option notes and note are non-empty texts within their limits", () => {
    const base = { itemId: "q", rev: 1, when: WHEN, choice: ["a"] };
    for (const [field, value] of [
      ["other", ""],
      ["other", "x".repeat(10_001)],
      ["other", 3],
      ["note", ""],
      ["note", "x".repeat(10_001)],
      ["optionNotes", {}],
      ["optionNotes", { a: "" }],
      ["optionNotes", { a: "x".repeat(2_001) }],
      ["optionNotes", { "": "x" }],
      ["optionNotes", ["x"]],
    ] as const) {
      const params = { name: "askboard.view.answer", arguments: { ...base, [field]: value } };
      expect(problemsOf(params)[0]?.path).toBe(`/arguments/${field}`);
    }
  });

  const acts = [
    { type: "answer", itemId: "payment", rev: 1, choice: ["Stripe"], note: "Fine.", when: WHEN },
    { type: "decline", itemId: "payment", rev: 1, note: "Not mine to decide.", when: WHEN },
    { type: "decline", itemId: "payment", rev: 1, when: WHEN },
    { type: "postpone", itemId: "payment", rev: 1 },
    { type: "reopen", itemId: "payment" },
    { type: "note", itemId: "payment", rev: 2, note: "Ask finance.", when: WHEN },
    { type: "follow-up", itemId: "payment", rev: 1, text: "Why?", when: WHEN },
    { type: "edit-choice", itemId: "payment", rev: 2, edit: "reload" },
    { type: "edit-choice", itemId: "payment", rev: 2, edit: "ignore", keptRev: 1 },
  ] as const;

  test.each(acts.map((act) => [act.type, act] as const))(
    "an act command of a %s act goes as a tool call and reads back",
    (_, act) => {
      const message: ViewMessage = { type: "act", acts: [act] };
      expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    },
  );

  test("an act command holds its acts in the order the user made them", () => {
    const message: ViewMessage = { type: "act", acts: [acts[3], acts[0], acts[1]] };
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
  });

  test("an act command with no act, an unknown act or a malformed one is refused, naming it", () => {
    const refusedAt = (list: unknown) =>
      problemsOf({ name: "askboard.view.act", arguments: { acts: list } })[0]?.path;
    expect(refusedAt([])).toBe("/arguments/acts");
    expect(refusedAt("postpone")).toBe("/arguments/acts");
    expect(refusedAt([acts[3], { type: "telemetry", itemId: "q" }])).toBe("/arguments/acts/1");
    expect(refusedAt([{ type: "constructor", itemId: "q" }])).toBe("/arguments/acts/0");
    expect(refusedAt([{ type: "postpone", itemId: "q" }])).toBe("/arguments/acts/0/rev");
    expect(refusedAt([{ ...acts[3], extra: 1 }])).toBe("/arguments/acts/0/extra");
    expect(refusedAt([{ type: "note", itemId: "q", rev: 1, note: "", when: WHEN }])).toBe(
      "/arguments/acts/0/note",
    );
    expect(refusedAt([{ type: "follow-up", itemId: "q", rev: 1, text: "", when: WHEN }])).toBe(
      "/arguments/acts/0/text",
    );
    expect(refusedAt([{ type: "answer", itemId: "q", rev: 1, when: WHEN }])).toBe(
      "/arguments/acts/0",
    );
    expect(refusedAt([{ type: "edit-choice", itemId: "q", rev: 2, edit: "ignore" }])).toBe(
      "/arguments/acts/0/keptRev",
    );
    expect(refusedAt([{ ...acts[7], keptRev: 1 }])).toBe("/arguments/acts/0/keptRev");
    expect(refusedAt([{ type: "edit-choice", itemId: "q", rev: 2, edit: "merge" }])).toBe(
      "/arguments/acts/0/edit",
    );
    expect(refusedAt([null])).toBe("/arguments/acts/0");
  });

  test("an open-reference message names an item and the view's insets, and nothing else (excerpts, task 6.5)", () => {
    const message: ViewMessage = {
      type: "open-reference",
      itemId: "pr",
      inset: { top: 64, bottom: 48 },
    };
    expect(toolCallOf(message).name).toBe("askboard.view.open-reference");
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    const refusedAt = (arguments_: Record<string, unknown>) => {
      const read = readViewMessage({ name: "askboard.view.open-reference", arguments: arguments_ });
      return read.ok ? undefined : read.problems[0]?.path;
    };
    expect(refusedAt({ inset: { top: 0, bottom: 0 } })).toBe("/arguments/itemId");
    expect(refusedAt({ itemId: "not an id", inset: { top: 0, bottom: 0 } })).toBe(
      "/arguments/itemId",
    );
    expect(refusedAt({ itemId: "pr" })).toBe("/arguments/inset");
    expect(refusedAt({ itemId: "pr", inset: { top: -1, bottom: 0 } })).toBe("/arguments/inset");
    expect(refusedAt({ itemId: "pr", inset: { top: 0 } })).toBe("/arguments/inset");
    expect(refusedAt({ itemId: "pr", inset: { top: "9", bottom: 0 } })).toBe("/arguments/inset");
    expect(refusedAt({ itemId: "pr", inset: { top: 0, bottom: 1e9 } })).toBe("/arguments/inset");
    expect(refusedAt({ itemId: "pr", inset: { top: 0, bottom: 0 }, url: "https://x.test" })).toBe(
      "/arguments/url",
    );
  });

  test("an open-link message names an item and a URL of at most 2,048 characters, and nothing else (atoms, task 4.2)", () => {
    const message: ViewMessage = {
      type: "open-link",
      itemId: "notes",
      url: "https://example.com/docs",
    };
    expect(toolCallOf(message).name).toBe("askboard.view.open-link");
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    const refusedAt = (arguments_: Record<string, unknown>) => {
      const read = readViewMessage({ name: "askboard.view.open-link", arguments: arguments_ });
      return read.ok ? undefined : read.problems[0]?.path;
    };
    const longUrl = (length: number) => `https://example.com/${"a".repeat(length - 20)}`;
    expect(readViewMessage(toolCallOf({ ...message, url: longUrl(2048) })).ok).toBe(true);
    expect(refusedAt({ itemId: "notes", url: longUrl(2049) })).toBe("/arguments/url");
    expect(refusedAt({ url: "https://example.com/" })).toBe("/arguments/itemId");
    expect(refusedAt({ itemId: "not an id", url: "https://example.com/" })).toBe(
      "/arguments/itemId",
    );
    expect(refusedAt({ itemId: "notes" })).toBe("/arguments/url");
    for (const url of [5, null, ["https://example.com/"], {}, true]) {
      expect(refusedAt({ itemId: "notes", url }), String(url)).toBe("/arguments/url");
    }
    expect(refusedAt({ itemId: "notes", url: "https://example.com/", inset: {} })).toBe(
      "/arguments/inset",
    );
  });

  test("a draft message carries the whole draft record, checked only for its shape here", () => {
    const message: ViewMessage = { type: "draft", record: lifecycleDraftRecord };
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    const empty: DraftRecord = { delivery: "immediate", questions: {} };
    expect(readViewMessage(toolCallOf({ type: "draft", record: empty }))).toEqual({
      ok: true,
      value: { type: "draft", record: empty },
    });
    for (const record of [
      null,
      [],
      { questions: {} },
      { delivery: "later", questions: {} },
      { delivery: "immediate" },
      { delivery: "immediate", questions: [] },
    ]) {
      expect(problemsOf({ name: "askboard.view.draft", arguments: { record } })[0]?.path).toBe(
        "/arguments/record",
      );
    }
  });

  test("the board page's reply names the action ID it gave the command", () => {
    expect(readActReply({ outcome: "sent", actionId: ACTION_ID })).toEqual({
      outcome: "sent",
      actionId: ACTION_ID,
    });
    expect(readActReply({ outcome: "queued", actionId: ACTION_ID })).toEqual({
      outcome: "queued",
      actionId: ACTION_ID,
    });
    expect(readActReply({ outcome: "refused", detail: "closed" })).toEqual({
      outcome: "refused",
      detail: "closed",
    });
    for (const reply of [{ outcome: "sent" }, { outcome: "sent", actionId: "x" }, undefined]) {
      expect(readActReply(reply)).toBeUndefined();
    }
    expect(readAnswerReply({ outcome: "sent", actionId: ACTION_ID })).toEqual({ outcome: "sent" });
  });

  // oversized-acts, design decision 2: a refusal may carry the size and the limit that caused it.
  test("a refusal's size is kept when it is two positive safe integers, else dropped", () => {
    const size = { bytes: 6_100_000, max: 6_004_096 };
    expect(readActReply({ outcome: "refused", detail: "too big", size })).toEqual({
      outcome: "refused",
      detail: "too big",
      size,
    });
    for (const bad of [
      { bytes: 0, max: 6_004_096 },
      { bytes: 6_100_000, max: -1 },
      { bytes: 1.5, max: 2 },
      { bytes: Number.MAX_SAFE_INTEGER + 1, max: 2 },
      { bytes: "6100000", max: 6_004_096 },
      { bytes: 6_100_000 },
      [6_100_000, 6_004_096],
      null,
      "big",
    ]) {
      expect(readActReply({ outcome: "refused", detail: "x", size: bad })).toEqual({
        outcome: "refused",
        detail: "x",
      });
    }
    expect(readActReply({ outcome: "sent", actionId: ACTION_ID, size })).toEqual({
      outcome: "sent",
      actionId: ACTION_ID,
    });
  });
});

describe("the board page's reply to a draft (oversized-acts, design decision 4)", () => {
  test("names the questions left out, as IDs", () => {
    expect(readDraftReply({})).toEqual([]);
    expect(readDraftReply({ leftOut: ["database", "cache"] })).toEqual(["database", "cache"]);
  });

  test("a refusal, a malformed list or anything else says nothing: the latest good reply stands", () => {
    for (const reply of [
      { outcome: "refused", detail: "no" },
      { leftOut: "database" },
      { leftOut: [1] },
      { leftOut: ["not an id"] },
      { leftOut: [""] },
      { leftOut: [null] },
      "x",
      null,
      undefined,
    ]) {
      expect(readDraftReply(reply)).toBeUndefined();
    }
  });
});

describe("what the board page tells the view of the lifecycle (ask-lifecycle, design decision 6)", () => {
  const lifecycleState = {
    ask: "partly-answered",
    questions: [
      { itemId: "region", rev: 1, state: "postponed" },
      {
        itemId: "payment",
        rev: 1,
        state: "answered",
        answer: { other: "Mollie", when: WHEN, receipt: "sent" },
      },
    ],
  } as const;

  test("the latest board document, the connection lost, settled commands and a draft to restore read back", () => {
    const update = {
      type: "state",
      state: lifecycleState,
      document: lifecycleBoardDocument,
      connection: "lost",
      pending: [{ actionId: ACTION_ID, outcome: "sent" }],
      settled: [
        { actionId: ACTION_ID, outcome: "done" },
        { actionId: "Zz3dE5gH7jK9mN1pQ3sT5v", outcome: "refused" },
        { actionId: "Yy3dE5gH7jK9mN1pQ3sT5v", outcome: "dropped" },
        { actionId: "Xx3dE5gH7jK9mN1pQ3sT5v", outcome: "refused", tooLarge: true },
      ],
      restore: { id: 1, record: lifecycleDraftRecord },
    } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
  });

  test("the reading panel's closing reads back, numbered, and a malformed one is no update (excerpts, task 6.6)", () => {
    const update = {
      type: "state",
      state: lifecycleState,
      panelClosed: { id: 2, itemId: "retry-src" },
    } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
    for (const panelClosed of [
      { id: 0, itemId: "retry-src" },
      { id: 1 },
      { id: 1, itemId: "not an id" },
      { id: 1.5, itemId: "retry-src" },
      "retry-src",
    ]) {
      expect(readViewUpdate({ type: "state", state: lifecycleState, panelClosed })).toBeUndefined();
    }
  });

  test("a malformed document, connection, settled list or restore is no update", () => {
    for (const extra of [
      { document: { items: "x" } },
      { document: null },
      { connection: "live" },
      { settled: [{ actionId: ACTION_ID, outcome: "maybe" }] },
      { settled: [{ actionId: ACTION_ID, outcome: "refused", tooLarge: false }] },
      { settled: [{ actionId: ACTION_ID, outcome: "refused", tooLarge: "yes" }] },
      { settled: "done" },
      { restore: { id: 0, record: lifecycleDraftRecord } },
      { restore: { id: 1 } },
      { restore: { id: 1, record: [] } },
    ]) {
      expect(readViewUpdate({ type: "state", state: lifecycleState, ...extra })).toBeUndefined();
    }
  });
});

describe("who asked and where, and the agent status, in an update (task 8.4)", () => {
  const origin = {
    who: { label: "Subagent code-reviewer", name: "Retry review", ordinal: 2 },
    forUser: "Marco Rossi",
    project: "order-service",
    directory: ".",
    branch: "fix/retry",
    worktree: "order-service-fix-retry",
  };

  test("go with the state and read back", () => {
    const update = { type: "state", state: waiting, origin, agent: "waiting" } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
    expect(
      readViewUpdate({ type: "state", state: waiting, origin: { who: { label: "Agent" } } }),
    ).toEqual({
      type: "state",
      state: waiting,
      origin: { who: { label: "Agent" } },
    });
  });

  test("an update whose origin or agent status the view cannot show is not an update", () => {
    for (const wrong of [
      { origin: "Main agent" },
      { origin: {} },
      { origin: { who: { label: 7 } } },
      { origin: { who: { label: "Agent", ordinal: "2" } } },
      { origin: { ...origin, branch: 5 } },
      { agent: "idle" },
      { agent: true },
    ]) {
      expect(readViewUpdate({ type: "state", state: waiting, ...wrong })).toBeUndefined();
    }
  });
});

describe("a field that goes only beside another (review M3)", () => {
  // A test-only pair: `extra` may come only with `base`, as a later change's field with its partner.
  const text = (value: unknown) => (typeof value === "string" ? undefined : "is not a text");
  const fields: MessageFields = {
    checks: { itemId: text, base: text, extra: text },
    optional: ["base"],
    beside: { extra: "base" },
  };

  test("may come with its partner, and both may be left out", () => {
    expect(fieldProblems(fields, { itemId: "q", base: "b", extra: "e" })).toEqual([]);
    expect(fieldProblems(fields, { itemId: "q", base: "b" })).toEqual([]);
    expect(fieldProblems(fields, { itemId: "q" })).toEqual([]);
  });

  test("without its partner is refused, at the message, naming both", () => {
    expect(fieldProblems(fields, { itemId: "q", extra: "e" })).toEqual([
      { path: "/arguments", message: '"extra" goes only beside "base"' },
    ]);
    expect(fieldProblems(fields, { itemId: "q", extra: "e" }, "/arguments/acts/0")).toEqual([
      { path: "/arguments/acts/0", message: '"extra" goes only beside "base"' },
    ]);
  });

  test("is still checked itself", () => {
    expect(fieldProblems(fields, { itemId: "q", base: "b", extra: 3 })).toEqual([
      { path: "/arguments/extra", message: "is not a text" },
    ]);
  });
});

describe("the table of an update's optional fields (review M4, L10)", () => {
  test("is keyed by the update's optional fields: one left out, or one more, is a type error", () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const keyed: Same<keyof typeof UPDATE_FIELDS, UpdateField> = true;
    const { agent: _, ...short } = UPDATE_FIELDS;
    // @ts-expect-error: the table leaves out `agent`, an optional field of `ViewUpdate`
    const missing: UpdateFields = short;
    expect(keyed).toBe(true);
    expect(Object.keys(missing)).not.toContain("agent");
  });

  test("an update with any of its fields in a shape the view cannot read is no update", () => {
    for (const field of Object.keys(UPDATE_FIELDS)) {
      expect(readViewUpdate({ type: "state", state: waiting, [field]: Symbol(field) })).toBe(
        undefined,
      );
    }
  });
});

describe("the presentation in an update (settings-languages, task 8.2)", () => {
  const presentation = {
    theme: "light",
    density: "comfortable",
    contextPlacement: "beside",
    locked: ["theme", "contextPlacement"],
  } as const;

  test("goes with the state and reads back", () => {
    const update = { type: "state", state: waiting, presentation } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
  });

  test("an update whose presentation the view cannot apply is not an update", () => {
    for (const wrong of [
      { ...presentation, theme: "auto" },
      { ...presentation, density: "tight" },
      { ...presentation, contextPlacement: "left" },
      { ...presentation, locked: ["language"] },
      { ...presentation, locked: "theme" },
      { theme: "dark" },
      "dark",
    ]) {
      expect(
        readViewUpdate({ type: "state", state: waiting, presentation: wrong }),
      ).toBeUndefined();
    }
  });
});

describe("the user's keys in an update (keyboard-shortcuts-help, task 10.1)", () => {
  const keys = { "move.top": ["Mod+Alt+ArrowUp"], "select.all": [] } as const;
  const updateWith = (value: unknown) =>
    readViewUpdate({ type: "state", state: waiting, keys: value });

  test("go with the state and read back", () => {
    const update = { type: "state", state: waiting, keys } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
  });

  test("the entry is not atBoot: a Snapshot's and a booted view's data carry none", () => {
    expect("atBoot" in UPDATE_FIELDS.keys).toBe(false);
  });

  test("an empty object is a valid, empty set of overrides", () => {
    expect(updateWith({})).toEqual({ type: "state", state: waiting, keys: {} });
  });

  test("the contract's bounds, and one past each: the figures are the constants'", () => {
    const actions = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, at) => [`own.action${at}`, []]));
    const many = (count: number) =>
      Array.from({ length: count }, (_, at) => String.fromCharCode(97 + at));
    expect(updateWith(actions(KEY_OVERRIDES_MAX_ACTIONS))).toBeDefined();
    expect(updateWith(actions(KEY_OVERRIDES_MAX_ACTIONS + 1))).toBeUndefined();
    expect(updateWith({ a: many(KEY_OVERRIDE_MAX_COMBINATIONS) })).toBeDefined();
    expect(updateWith({ a: many(KEY_OVERRIDE_MAX_COMBINATIONS + 1) })).toBeUndefined();
    expect(updateWith({ a: ["x".repeat(KEY_COMBINATION_MAX_CHARS)] })).toBeDefined();
    expect(updateWith({ a: ["x".repeat(KEY_COMBINATION_MAX_CHARS + 1)] })).toBeUndefined();
    expect(updateWith({ a: [""] })).toBeUndefined();
    expect(updateWith({ ["x".repeat(KEY_ACTION_MAX_CHARS)]: [] })).toBeDefined();
    expect(updateWith({ ["x".repeat(KEY_ACTION_MAX_CHARS + 1)]: [] })).toBeUndefined();
    expect(updateWith({ "": [] })).toBeUndefined();
  });

  test("it admits what the configuration schema admits at each bound and refuses what it refuses", () => {
    // The oracle is the schema itself, so a bound changed in the constants alone fails here.
    const actions = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, at) => [`own.action${at}`, ["F2"]]));
    const cases: readonly Record<string, readonly string[]>[] = [
      actions(KEY_OVERRIDES_MAX_ACTIONS),
      actions(KEY_OVERRIDES_MAX_ACTIONS + 1),
      { ["x".repeat(KEY_ACTION_MAX_CHARS)]: ["F2"] },
      { ["x".repeat(KEY_ACTION_MAX_CHARS + 1)]: ["F2"] },
      { a: Array.from({ length: KEY_OVERRIDE_MAX_COMBINATIONS }, () => "F2") },
      { a: Array.from({ length: KEY_OVERRIDE_MAX_COMBINATIONS + 1 }, () => "F2") },
      { a: ["x".repeat(KEY_COMBINATION_MAX_CHARS)] },
      { a: ["x".repeat(KEY_COMBINATION_MAX_CHARS + 1)] },
    ];
    for (const keys of cases) {
      const schema = validateConfiguration({ version: "1.0", keys }).ok;
      expect({
        keys: Object.keys(keys).length,
        viewAdmits: updateWith(keys) !== undefined,
      }).toEqual({ keys: Object.keys(keys).length, viewAdmits: schema });
    }
  });

  test("anything else is no update: a list, a number, a text, null, a list holding a non-string", () => {
    for (const wrong of [
      ["move.top"],
      3,
      "move.top",
      null,
      { "move.top": "Mod+Alt+ArrowUp" },
      { "move.top": 3 },
      { "move.top": [3] },
      { "move.top": [null] },
      { "move.top": [["Mod+Alt+ArrowUp"]] },
      { "move.top": { 0: "Mod+Alt+ArrowUp" } },
    ]) {
      expect(updateWith(wrong)).toBeUndefined();
    }
  });

  test("a name that is no action is still a name: the check leaves its meaning to the board page", () => {
    expect(updateWith(JSON.parse('{"__proto__":["Mod+Alt+ArrowUp"]}'))).toBeDefined();
  });
});

describe("the settings panel closing in an update (settings-languages, task 8.4)", () => {
  test("goes with the state as a count and reads back", () => {
    const update = { type: "state", state: waiting, settingsClosed: 2 } as const;
    expect(readViewUpdate(viewUpdateResult(update).structuredContent)).toEqual(update);
  });

  test("a count that is not a whole number of one or more is not an update", () => {
    for (const wrong of [0, -1, 1.5, "1"]) {
      expect(
        readViewUpdate({ type: "state", state: waiting, settingsClosed: wrong }),
      ).toBeUndefined();
    }
  });
});

describe("the presentation messages the view sends (settings-languages, task 8.3)", () => {
  test("a setting names one presentation key and a value its schema allows", () => {
    for (const message of [
      { type: "setting", key: "theme", value: "dark" },
      { type: "setting", key: "theme", value: "system" },
      { type: "setting", key: "density", value: "comfortable" },
      { type: "setting", key: "contextPlacement", value: "inline" },
    ] as const) {
      expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    }
  });

  test("a setting for any other key, or with a value the key does not allow, is refused", () => {
    for (const arguments_ of [
      { key: "editor", value: "evil" },
      { key: "askingRule", value: "none" },
      { key: "defaultLanguage", value: "it-IT" },
      { key: "theme", value: "comfortable" },
      { key: "density", value: "dark" },
      { key: "contextPlacement", value: "left" },
      { key: "theme", value: 1 },
      { key: "theme" },
      { value: "dark" },
      { key: "theme", value: "dark", extra: true },
    ]) {
      const read = readViewMessage({ name: `${VIEW_TOOL_PREFIX}setting`, arguments: arguments_ });
      expect(read.ok).toBe(false);
    }
  });

  test("opening the settings takes no arguments", () => {
    const message = { type: "open-settings" } as const;
    expect(readViewMessage(toolCallOf(message))).toEqual({ ok: true, value: message });
    const refused = readViewMessage({
      name: `${VIEW_TOOL_PREFIX}open-settings`,
      arguments: { panel: "x" },
    });
    expect(refused.ok).toBe(false);
  });
});

describe("an answer's results (widget-registry, design decision 9; AD-20)", () => {
  const base = { itemId: "q", rev: 1, when: "2026-10-30T09:41:27Z" };
  const call = (args: Record<string, unknown>) => ({
    name: "askboard.view.answer",
    arguments: args,
  });
  const results = { sketch: { pick: "a" } };

  test("results alone are an answer, and read back as sent", () => {
    expect(problemsOf(call({ ...base, results }))).toEqual([]);
    const checked = readViewMessage(call({ ...base, results }));
    expect(
      checked.ok && checked.value.type === "answer" ? checked.value.results : undefined,
    ).toEqual(results);
  });

  test("results go beside a choice, widget values, Other text and derived values", () => {
    const derived = { "sketch.count": 3 };
    expect(problemsOf(call({ ...base, choice: ["Yes"], results }))).toEqual([]);
    expect(problemsOf(call({ ...base, values: { sketch: {} }, results, derived }))).toEqual([]);
    expect(problemsOf(call({ ...base, other: "Maybe", results }))).toEqual([]);
    expect(problemsOf(call({ ...base, results, derived }))).toEqual([]);
  });

  test("derived values alone, or beside a note alone, are still no answer", () => {
    const derived = { "sketch.count": 3 };
    expect(problemsOf(call({ ...base, derived })).map(({ path }) => path)).toContain(
      "/arguments/derived",
    );
  });

  test.each([
    ["no object", [] as unknown],
    ["empty", {}],
    ["a key that is no item ID", { "a b": 1 }],
    ["a value that is no JSON", { sketch: undefined }],
    ["a value that holds a function", { sketch: () => 1 }],
    [
      "a value that holds itself",
      (() => {
        const loop: Record<string, unknown> = {};
        loop.self = loop;
        return { sketch: loop };
      })(),
    ],
    ["a date", { sketch: new Date(0) }],
  ])("results that are %s are refused, naming results", (_, value) => {
    const found = problemsOf(call({ ...base, choice: ["Yes"], results: value }));
    expect(found.map(({ path }) => path)).toEqual(["/arguments/results"]);
  });

  const nested = (levels: number): unknown => {
    let value: unknown = 1;
    for (let at = 0; at < levels; at += 1) value = [value];
    return value;
  };

  test("a result nested past the contract's JSON bound is refused, never thrown (X-3)", () => {
    const bound = JSON_MAX_DEPTH;
    for (const levels of [bound + 1, 1_000_000]) {
      const found = problemsOf(
        call({ ...base, choice: ["Yes"], results: { sketch: nested(levels) } }),
      );
      expect(found.map(({ path }) => path)).toEqual(["/arguments/results"]);
    }
    expect(problemsOf(call({ ...base, results: { sketch: nested(bound) } }))).toEqual([]);
  });

  test("derived values nested past the JSON bound are refused, naming derived (X-5)", () => {
    const found = problemsOf(
      call({ ...base, choice: ["Yes"], derived: { "sketch.count": nested(JSON_MAX_DEPTH + 1) } }),
    );
    expect(found.map(({ path }) => path)).toEqual(["/arguments/derived"]);
  });

  test("a result may be any JSON value, a key such as __proto__ among the keys", () => {
    for (const value of [null, 3, "text", true, [1, [2]], { deep: { deeper: [] } }]) {
      expect(problemsOf(call({ ...base, results: { sketch: value } }))).toEqual([]);
    }
    const text = `{"itemId":"q","rev":1,"when":"2026-10-30T09:41:27Z","results":{"__proto__":1}}`;
    const checked = readViewMessage({
      name: "askboard.view.answer",
      arguments: JSON.parse(text),
    });
    const read = checked.ok && checked.value.type === "answer" ? checked.value.results : {};
    expect(Object.hasOwn(read ?? {}, "__proto__")).toBe(true);
  });

  test("an answer act holds results the same way", () => {
    const act = { type: "answer", ...base, results } as const;
    expect(problemsOf({ name: "askboard.view.act", arguments: { acts: [act] } })).toEqual([]);
    const { results: _, ...bare } = act;
    expect(
      problemsOf({
        name: "askboard.view.act",
        arguments: { acts: [{ ...bare, derived: { "a.b": 1 } }] },
      }),
    ).not.toEqual([]);
  });
});
