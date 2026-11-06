import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type HostMessage } from "@askboard/contract";
import {
  uj2ExpandedBoardDocument,
  uj2ExpandedDerived,
  uj2ExpandedEditedValues,
  uj2WidgetAnswerAct,
  uj2WidgetWaitingState,
} from "@askboard/contract/fixtures";
import type { ViewAnswer } from "../view-protocol.ts";
import {
  actsFor,
  answerActFor,
  type BoardModel,
  EMPTY_MODEL,
  withHostMessage,
  withViewMessage,
} from "./model.ts";

// View-and-widgets spec, The board page sends widget answers (widget-answers, task 5.1): on the
// UJ-2 board document, the view's answer with widget values is an `answer` act carrying them.

const version = BOARD_PROTOCOL_VERSION;
const when = "2026-11-02T09:30:00Z";

const uj2Model = (visible = true): BoardModel => {
  const board = { version, type: "board", document: uj2ExpandedBoardDocument } as HostMessage;
  const state = { version, type: "state", state: uj2WidgetWaitingState.state } as HostMessage;
  const loaded = withHostMessage(withHostMessage(EMPTY_MODEL, board), state);
  return visible ? withViewMessage(loaded, { type: "ready", itemId: "plan" }) : loaded;
};

const answer: ViewAnswer = {
  type: "answer",
  itemId: "plan",
  rev: 1,
  values: uj2ExpandedEditedValues as Record<string, unknown>,
  derived: uj2ExpandedDerived as Record<string, unknown>,
  when,
};

const detailOf = (model: BoardModel, message: ViewAnswer) => {
  const acts = answerActFor(model, message);
  return acts.ok ? undefined : acts.detail;
};

describe("the board page sends widget answers", () => {
  test("the UJ-2 edits become one answer act with values and derived", () => {
    const acts = answerActFor(uj2Model(), answer);
    expect(acts).toEqual({
      ok: true,
      value: [{ ...answer, type: "answer" }] as never,
    });
    const [sent] = uj2WidgetAnswerAct.acts;
    expect(acts.ok && acts.value[0]).toMatchObject({
      values: (sent as { values: object }).values,
      derived: uj2ExpandedDerived,
    });
  });

  test("an answer of the Tree's value alone is one too", () => {
    const { derived: _, ...alone } = answer;
    const values = { wbs__tree: answer.values?.wbs__tree as object };
    expect(answerActFor(uj2Model(), { ...alone, values }).ok).toBe(true);
  });

  test("a value for an item that is not in the question is refused, sending nothing", () => {
    const values = { ...answer.values, other__tree: { nodes: [] } };
    expect(detailOf(uj2Model(), { ...answer, values })).toBe(
      'the answer carries a value for "other__tree", which is not a widget item of the question',
    );
  });

  test("the usual checks still hold: visible, at a known revision, open", () => {
    expect(detailOf(uj2Model(false), answer)).toContain("visible");
    expect(detailOf(uj2Model(), { ...answer, rev: 2 })).toContain("revision 1, not 2");
    const closed = withHostMessage(uj2Model(), {
      version,
      type: "state",
      state: { ask: "closed", questions: uj2WidgetWaitingState.state.questions },
    } as unknown as HostMessage);
    expect(actsFor(closed, [{ ...answer }])).toEqual({ ok: false, detail: "the ask is closed" });
  });
});
