import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type HostMessage } from "@askboard/contract";
import { ARRANGED_ITEM, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, WidgetItem } from "../view-document.ts";
import type { ViewAnswer } from "../view-protocol.ts";
import { holdsMarkdown, openLinkRefusal } from "./markdown-links.ts";
import {
  answerActFor,
  type BoardModel,
  EMPTY_MODEL,
  withHostMessage,
  withViewMessage,
} from "./model.ts";
import { boardItemOf } from "./references.ts";

// View-and-widgets spec, Items inside layouts (layouts, task 3.1; design decision 6): the board
// page accepts an answer naming a nested item and refuses one naming a layout, and opens a link of
// a Markdown Text that sits in a layout. It checks the board document it holds, never the message.

const version = BOARD_PROTOCOL_VERSION;
const note: WidgetItem = {
  type: "text",
  id: "plan-note",
  props: { format: "markdown", content: "[docs](https://example.com)" },
};
const [first] = plainChoiceBoardDocument.items;
const { options: _, ...rest } = first.props;
const document = {
  ...plainChoiceBoardDocument,
  items: [
    {
      ...first,
      id: "plan",
      props: {
        ...rest,
        text: "Plan?",
        items: [
          {
            type: "group",
            id: "outer",
            props: { title: "Outer", items: [ARRANGED_ITEM, note] },
          },
        ],
      },
    },
  ],
} as unknown as ViewDocument;

const model = (): BoardModel => {
  const board = { version, type: "board", document } as HostMessage;
  const state = {
    version,
    type: "state",
    state: { ask: "waiting", questions: [{ itemId: "plan", rev: 1, state: "open" }] },
  } as HostMessage;
  const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
  return withViewMessage(loaded, { type: "ready", itemId: "plan" });
};

const base: ViewAnswer = {
  type: "answer",
  itemId: "plan",
  rev: 1,
  when: "2026-11-07T09:30:00Z",
};
const detailOf = (answer: ViewAnswer) => {
  const acts = answerActFor(model(), answer);
  return acts.ok ? undefined : acts.detail;
};

describe("an act that names an item inside a layout", () => {
  test("a value and a result for a nested item are accepted", () => {
    expect(answerActFor(model(), { ...base, values: { "plan-hours": 3 } }).ok).toBe(true);
    expect(answerActFor(model(), { ...base, results: { "plan-owner": "x" } }).ok).toBe(true);
  });

  test("a value or a result keyed by a layout is refused, naming the key", () => {
    expect(detailOf({ ...base, values: { "plan-tabs": {} } })).toBe(
      'the answer carries a value for "plan-tabs", which is not a widget item of the question',
    );
    expect(detailOf({ ...base, results: { outer: 1 } })).toBe(
      'the answer carries a result for "outer", which is not a widget item of the question',
    );
  });
});

describe("a link in Markdown inside a layout", () => {
  test("the board page finds the nested Text in its board document and opens the link", () => {
    expect(boardItemOf(document, "plan-note")?.type).toBe("text");
    expect(holdsMarkdown(document, "plan-note")).toBe(true);
    expect(openLinkRefusal(document, "plan-note", "https://example.com/a")).toBeUndefined();
    expect(openLinkRefusal(document, "plan-owner", "https://example.com/a")).toBe(
      "the item holds no Markdown in the board document",
    );
  });
});
