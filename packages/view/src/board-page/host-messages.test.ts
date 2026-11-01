import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_MESSAGES } from "@askboard/contract";
import {
  boardProtocolExamples,
  plainChoiceBoardDocument,
  treeBoardDocument,
} from "@askboard/contract/fixtures";
import { readHostMessage } from "./host-messages.ts";
import { hostMessageSchemas } from "./validators.ts";

const problemsOf = (data: unknown) => {
  const checked = readHostMessage(data);
  return checked.ok ? [] : checked.problems;
};

describe("the messages board-host sends, as the board page reads them (AD-7)", () => {
  test("there is one validator per message type", () => {
    expect(Object.keys(hostMessageSchemas).sort()).toEqual(
      Object.keys(BOARD_PROTOCOL_MESSAGES.toPage).sort(),
    );
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
    const unknownItems = {
      path: "/document/items/0/props/items",
      message: 'unknown field "items"',
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
        { path: "/document/items/0/props/items", message: 'unknown field "items"' },
        { path: "/document/items/0/props/options", message: 'missing field "options"' },
      ]),
    );
  });
});
