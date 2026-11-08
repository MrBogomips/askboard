import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { AnswerView, LifecycleBoardView } from "@askboard/core";
import { stateOf } from "../../src/board-host/messages.ts";
import { freeRange, removeViews, startHost } from "./helpers.ts";

// Board-host spec, Board protocol over a WebSocket ("A reopened question's state" and "An answered
// question's state"): the board state carries `unchanged` exactly as ask-core gives it, in the
// current and the previous answer, an empty list included, and nothing when ask-core gave none
// (reopen-start-from-answer, design decisions 1 and 10).

afterAll(removeViews);

const when = "2026-11-08T09:30:00Z";
const answer = (fields: Partial<AnswerView> = {}): AnswerView => ({
  choice: ["PostgreSQL"],
  who: "Giulia Rossi",
  when,
  delivered: true,
  ...fields,
});

const board = (
  question: Record<string, unknown>,
): Exclude<LifecycleBoardView, { readonly state: "discarded" }> =>
  ({
    askId: "order-db-choice-x7k2",
    state: "waiting",
    document: plainChoiceBoardDocument,
    questions: [{ itemId: "database", rev: 2, thread: [], ...question }],
  }) as never;

const valid = (state: unknown) =>
  validateBoardMessage("toPage", { version: BOARD_PROTOCOL_VERSION, type: "state", state }).ok;

describe("the board state's unchanged items", () => {
  test("a previous answer's unchanged IDs reach the page, in a state the protocol accepts", () => {
    const state = stateOf(
      board({ state: "open", previous: answer({ unchanged: ["database", "side"] }) }),
    );
    expect(state.questions[0]).toMatchObject({
      previous: { choice: ["PostgreSQL"], unchanged: ["database", "side"] },
    });
    expect(valid(state)).toBe(true);
  });

  test("a current answer's unchanged IDs reach the page too", () => {
    const state = stateOf(
      board({ state: "answered", answer: answer({ unchanged: ["database"] }) }),
    );
    expect(state.questions[0]).toMatchObject({ answer: { unchanged: ["database"] } });
    expect(valid(state)).toBe(true);
  });

  test("an empty list reaches the page as an empty list, never as no field", () => {
    for (const side of ["answer", "previous"] as const) {
      const state = stateOf(
        board(
          side === "answer"
            ? { state: "answered", answer: answer({ unchanged: [] }) }
            : { state: "open", previous: answer({ unchanged: [] }) },
        ),
      );
      expect((state.questions[0] as Record<string, unknown>)?.[side]).toHaveProperty(
        "unchanged",
        [],
      );
      expect(valid(state)).toBe(true);
    }
  });

  test("an answer with none carries no field, and the list sent is a copy", () => {
    const state = stateOf(board({ state: "open", previous: answer() }));
    expect(JSON.stringify(state)).not.toContain("unchanged");
    const unchanged = ["database"];
    const copied = stateOf(board({ state: "open", previous: answer({ unchanged }) }));
    const sent = copied.questions[0]?.previous?.unchanged;
    expect(sent).toEqual(unchanged);
    expect(sent).not.toBe(unchanged);
  });
});

describe("the board state around the real ask-core", () => {
  const ACT = {
    actionId: "action-000000000000001",
    acts: [
      {
        type: "answer",
        itemId: "database",
        rev: 1,
        when,
        choice: ["PostgreSQL"],
      },
    ],
  };

  const asked = async () => {
    const fixture = startHost({ ports: await freeRange(1) });
    const { askId } = await fixture.ask();
    const state = () => {
      const view = fixture.core.lifecycleBoard(askId);
      if (view === undefined || view.state === "discarded") throw new Error("no board");
      return stateOf(view);
    };
    return { fixture, askId, state };
  };

  test("an ask answered and reopened with no other change: the previous answer lists the question and its items", async () => {
    const { fixture, askId, state } = await asked();
    try {
      expect(fixture.core.act(askId, ACT as never).ok).toBe(true);
      await fixture.core.update({
        askId,
        actions: [{ action: "reopen", itemId: "database" }],
      } as never);
      const [question] = state().questions;
      expect(question).toMatchObject({ rev: 2, state: "open" });
      expect(question?.previous?.unchanged).toEqual(["database"]);
      expect(valid(state())).toBe(true);
    } finally {
      await fixture.host.close();
    }
  });

  test("an ask only answered: no unchanged anywhere in the state", async () => {
    const { fixture, askId, state } = await asked();
    try {
      expect(fixture.core.act(askId, ACT as never).ok).toBe(true);
      expect(state().questions[0]).toMatchObject({ state: "answered" });
      expect(JSON.stringify(state())).not.toContain("unchanged");
    } finally {
      await fixture.host.close();
    }
  });
});
