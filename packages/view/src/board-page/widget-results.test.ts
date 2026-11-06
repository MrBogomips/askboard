import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type DraftRecord, type HostMessage } from "@askboard/contract";
import { uj2ExpandedBoardDocument, uj2WidgetWaitingState } from "@askboard/contract/fixtures";
import type { ViewAnswer } from "../view-protocol.ts";
import {
  actsFor,
  answerActFor,
  type BoardModel,
  EMPTY_MODEL,
  withHostMessage,
  withViewMessage,
} from "./model.ts";
import { hasUnsentWork, unsentWorkText } from "./unsent-work.ts";

// View-and-widgets spec, Results in the view protocol and the board page (widget-registry, task
// 4.4): on the UJ-2 board document, whose question `plan` holds the widget items `wbs__tree` and
// `schedule__gantt` and nothing else, the board page sends an answer's results as an act and
// refuses a key that names no widget item of the question. The board page checks the key, ask-core
// the result.

const version = BOARD_PROTOCOL_VERSION;
const when = "2026-11-06T09:30:00Z";

const model = (): BoardModel => {
  const board = { version, type: "board", document: uj2ExpandedBoardDocument } as HostMessage;
  const state = { version, type: "state", state: uj2WidgetWaitingState.state } as HostMessage;
  const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
  return withViewMessage(loaded, { type: "ready", itemId: "plan" });
};

const [item] = uj2ExpandedBoardDocument.items;
const ITEMS = (item as unknown as { props: { items: { id: string }[] } }).props.items.map(
  ({ id }) => id,
);
const [WIDGET = "", SECOND = ""] = ITEMS;
const base: ViewAnswer = { type: "answer", itemId: "plan", rev: 1, when };
const detailOf = (answer: ViewAnswer) => {
  const acts = answerActFor(model(), answer);
  return acts.ok ? undefined : acts.detail;
};

describe("the board page sends an answer's results", () => {
  test("results alone are accepted and sent as one act carrying them", () => {
    const results = { [WIDGET]: { pick: "a" } };
    expect(ITEMS.length).toBeGreaterThan(1);
    expect(answerActFor(model(), { ...base, results })).toEqual({
      ok: true,
      value: [{ ...base, results }] as never,
    });
  });

  test("a result for another question's item is refused naming the key, sending nothing", () => {
    expect(detailOf({ ...base, results: { elsewhere: 1 } })).toBe(
      'the answer carries a result for "elsewhere", which is not a widget item of the question',
    );
    expect(detailOf({ ...base, results: { [WIDGET]: 1, plan: 1 } })).toContain('"plan"');
  });

  test("a key of the object prototype is no widget item", () => {
    const results = JSON.parse('{"__proto__": 1, "constructor": 2}') as Record<string, unknown>;
    expect(detailOf({ ...base, results })).toContain("which is not a widget item");
  });

  test("results beside derived values are accepted", () => {
    const derived = { [`${WIDGET}.count`]: 3 };
    const results = { [SECOND]: { pick: "a" } };
    expect(answerActFor(model(), { ...base, results, derived }).ok).toBe(true);
  });

  test("results beside values are accepted, and each is checked against the item IDs", () => {
    const values = { [WIDGET]: {} };
    expect(answerActFor(model(), { ...base, values, results: { [SECOND]: 1 } }).ok).toBe(true);
    expect(detailOf({ ...base, values, results: { nope: 1 } })).toContain('"nope"');
  });

  test("the same results in an act command are checked the same way", () => {
    const answer = { type: "answer", itemId: "plan", rev: 1, when } as const;
    expect(actsFor(model(), [{ ...answer, results: { [WIDGET]: 1 } }]).ok).toBe(true);
    const refused = actsFor(model(), [{ ...answer, results: { nope: 1 } }]);
    expect(refused.ok).toBe(false);
  });

  test("an answer of derived values alone, or with no content at all, still sends nothing", () => {
    expect(detailOf(base)).toBe(
      "the answer carries no choice, no Other… text, no widget value and no result",
    );
  });
});

describe("a held result is unsent work (widget-registry, design decision 9)", () => {
  const record = (work: object): DraftRecord => ({
    delivery: "immediate",
    questions: { plan: { rev: 1, ...work } },
  });

  test("a result arms the leave-page prompt, alone or beside values; none does not", () => {
    expect(hasUnsentWork(record({ results: { [WIDGET]: { pick: "a" } } }))).toBe(true);
    expect(hasUnsentWork(record({ values: { [WIDGET]: {} }, results: { [SECOND]: 1 } }))).toBe(
      true,
    );
    expect(hasUnsentWork(record({ results: {} }))).toBe(false);
    expect(hasUnsentWork(record({}))).toBe(false);
  });

  test("the copy of the unsent work holds each result under its item, as JSON", () => {
    const text = unsentWorkText(
      uj2ExpandedBoardDocument,
      record({ results: { [WIDGET]: { pick: "a" } } }),
    );
    expect(text).toContain(`${WIDGET}: {"pick":"a"}`);
  });
});
