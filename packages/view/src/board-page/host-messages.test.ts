import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_MESSAGES, PUSH_HOST_MESSAGES } from "@askboard/contract";
import {
  boardProtocolExamples,
  contextProtocolExamples,
  lifecycleProtocolExamples,
  plainChoiceBoardDocument,
  settingsProtocolExamples,
  subagentOrigin,
  treeBoardDocument,
  uncheckedOrigin,
  waitingAgentStatus,
} from "@askboard/contract/fixtures";
import { readHostMessage } from "./host-messages.ts";
import { hostMessageSchemas } from "./validators.ts";

const problemsOf = (data: unknown) => {
  const checked = readHostMessage(data);
  return checked.ok ? [] : checked.problems;
};

describe("the messages board-host sends, as the board page reads them (AD-7)", () => {
  test("there is one validator per message type, push delivery's origin and agent included", () => {
    expect(Object.keys(hostMessageSchemas).sort()).toEqual(
      Object.keys({ ...BOARD_PROTOCOL_MESSAGES.toPage, ...PUSH_HOST_MESSAGES }).sort(),
    );
  });

  test("each message type the contract lists is read with its own validator, 1.1's and 1.2's included", () => {
    const examples = [
      ...boardProtocolExamples.toPage,
      ...lifecycleProtocolExamples.toPage,
      ...contextProtocolExamples.toPage,
      ...settingsProtocolExamples.toPage,
    ];
    const names = Object.keys(BOARD_PROTOCOL_MESSAGES.toPage);
    expect(new Set<string>(examples.map((message) => message.type))).toEqual(new Set(names));
    for (const name of names) expect(Object.hasOwn(hostMessageSchemas, name)).toBe(true);
    for (const message of examples) {
      const read = readHostMessage(JSON.stringify(message));
      // E5's messages join `BoardHostMessage` with the reading panel's handlers (excerpts, task 6.6).
      // `settings` joins `BoardHostMessage` with the board page's settings (settings-languages 8.2).
      expect({ type: message.type, read }).toEqual({
        type: message.type,
        read: { ok: true, value: message as never },
      });
    }
  });

  test.each(boardProtocolExamples.toPage.map((message) => [message.type, message] as const))(
    "a %s message as the WebSocket delivers it, in text, is read",
    (_, message) => {
      expect(readHostMessage(JSON.stringify(message))).toEqual({ ok: true, value: message });
    },
  );

  test("text that is not JSON is refused", () => {
    expect(readHostMessage("{")).toMatchObject({ ok: false, reason: "schema" });
  });

  test("binary data or a JSON array is refused", () => {
    expect(problemsOf(new ArrayBuffer(2))[0]?.path).toBe("/");
    expect(problemsOf("[1]")[0]?.message).toContain("JSON object");
  });

  test("another major is refused first, saying which version is supported", () => {
    const checked = readHostMessage(JSON.stringify({ version: "2.0", type: "moved" }));
    expect(checked).toMatchObject({ ok: false, reason: "version" });
    expect(problemsOf(JSON.stringify({ version: "2.0", type: "moved" }))[0]?.message).toContain(
      "supports version 1",
    );
  });

  test("a type the host does not send, an inherited name included, is refused at /type", () => {
    for (const type of ["connect", "answer", "constructor", 7]) {
      const problems = problemsOf(JSON.stringify({ version: "1.0", type }));
      expect(problems).toEqual([{ path: "/type", message: expect.stringContaining("board-host") }]);
    }
  });

  test("an unknown field is refused, naming it", () => {
    const problems = problemsOf(JSON.stringify({ version: "1.0", type: "moved", extra: true }));
    expect(problems).toEqual([{ path: "/extra", message: 'unknown field "extra"' }]);
  });

  test("a missing field is refused, naming it", () => {
    const problems = problemsOf(JSON.stringify({ version: "1.0", type: "discarded" }));
    expect(problems).toEqual([{ path: "/reason", message: 'missing field "reason"' }]);
  });

  test("a wrong value is refused at its path", () => {
    const message = { version: "1.0", type: "discarded", reason: "agent-finished" };
    expect(problemsOf(JSON.stringify(message))[0]?.path).toBe("/reason");
  });

  test("a board document whose question holds a widget item is refused as a schema error (design decision 7)", () => {
    // A test-only `probe` widget item (design decision 12), beside the options and instead of them.
    const [question] = plainChoiceBoardDocument.items;
    const probe = { type: "probe", id: "sketch", props: { size: 3 } };
    const boardWith = (props: object) =>
      JSON.stringify({
        version: "1.0",
        type: "board",
        document: { ...plainChoiceBoardDocument, items: [{ ...question, props }] },
      });
    // Since board document 1.2 a question's items hold its context, and a widget item is refused
    // at the item, by its type (excerpts, design decision 2).
    const unknownItems = {
      path: "/document/items/0/props/items/0",
      message: 'value of tag "type" must be in oneOf',
    };
    expect(readHostMessage(boardWith({ ...question.props, items: [probe] }))).toEqual({
      ok: false,
      reason: "schema",
      problems: [unknownItems],
    });
    const { options: _, ...withoutOptions } = question.props;
    const instead = readHostMessage(boardWith({ ...withoutOptions, items: [probe] }));
    expect(instead).toMatchObject({ ok: false, reason: "schema" });
    expect(problemsOf(boardWith({ ...withoutOptions, items: [probe] }))).toEqual(
      expect.arrayContaining([
        unknownItems,
        { path: "/document/items/0/props/options", message: 'missing field "options"' },
      ]),
    );
  });

  test("a board message holding the fixture Tree's question is refused as a schema error (view spec)", () => {
    // Until the input format admits a Tree, the board page never builds a view from one.
    const board = JSON.stringify({ version: "1.0", type: "board", document: treeBoardDocument });
    expect(readHostMessage(board)).toMatchObject({ ok: false, reason: "schema" });
    expect(problemsOf(board)).toEqual(
      expect.arrayContaining([
        {
          path: "/document/items/0/props/items/0",
          message: 'value of tag "type" must be in oneOf',
        },
        { path: "/document/items/0/props/options", message: 'missing field "options"' },
      ]),
    );
  });
});

describe("push delivery's origin and agent messages (task 8.4, design decision 12)", () => {
  test.each([
    ["a subagent's origin", subagentOrigin],
    ["an unchecked ask's origin", uncheckedOrigin],
    ["the agent status", waitingAgentStatus],
  ] as const)("%s is read", (_, message) => {
    expect(readHostMessage(JSON.stringify(message))).toEqual({ ok: true, value: message });
  });

  test.each([
    ["an origin with an unknown field", { ...uncheckedOrigin, cwd: "/Users/paola" }, "/cwd"],
    ["an origin without who asked", { version: "1.0", type: "origin" }, "/who"],
    [
      "an origin with an ordinal of 1",
      { ...subagentOrigin, who: { label: "Subagent x", ordinal: 1 } },
      "/who/ordinal",
    ],
    ["an origin with an empty branch", { ...subagentOrigin, branch: "" }, "/branch"],
    [
      "an agent status other than working or waiting",
      { ...waitingAgentStatus, status: "idle" },
      "/status",
    ],
    ["an agent message without its status", { version: "1.0", type: "agent" }, "/status"],
  ] as const)("%s is refused at its path, like E1's", (_, message, path) => {
    const checked = readHostMessage(JSON.stringify(message));
    expect(checked).toMatchObject({ ok: false, reason: "schema" });
    expect(problemsOf(JSON.stringify(message)).map((problem) => problem.path)).toContain(path);
  });

  test("an origin or agent message of another major is refused first", () => {
    for (const message of [uncheckedOrigin, waitingAgentStatus]) {
      expect(readHostMessage(JSON.stringify({ ...message, version: "2.0" }))).toMatchObject({
        ok: false,
        reason: "version",
      });
    }
  });
});
