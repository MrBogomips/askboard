import { describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { AnswerView, LifecycleBoardView } from "../src/lifecycle/views.ts";
import { boardStateOf as stateOf } from "../src/snapshot/state.ts";

// Core spec, When an answer carries its unchanged items, "In a Snapshot" (reopen-start-from-answer,
// design decision 10): a Snapshot's board state carries `unchanged` as the live board's does, an
// empty list included, and nothing when ask-core gave none.

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

  test("an empty list reaches the state as an empty list, never as no field", () => {
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
