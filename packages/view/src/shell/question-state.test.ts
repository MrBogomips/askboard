import { describe, expect, test } from "bun:test";
import type { BoardState, QuestionStatus } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { answerOf, cardState, statusOf } from "./question-state.ts";

const [question] = plainChoiceBoardDocument.items;
const open: QuestionStatus = { itemId: "database", rev: 1, state: "open" };
const answered = (receipt: "sent" | "delivered"): QuestionStatus => ({
  itemId: "database",
  rev: 1,
  state: "answered",
  answer: { choice: ["SQLite"], when: "2026-10-29T09:41:27Z", receipt },
});

describe("what a question card shows (EXPERIENCE.md, Question card and Delivery receipt)", () => {
  test("an open question: nothing chosen, Answer disabled until a choice (AD-10, FR-3)", () => {
    expect(cardState(open, [], undefined, "visible")).toEqual({
      phase: "open",
      readOnly: false,
      canAnswer: false,
    });
    expect(cardState(open, ["PostgreSQL"], undefined, "visible").canAnswer).toBe(true);
  });

  test("while loading or after its item failed, nothing can be chosen or answered (AD-9)", () => {
    for (const load of ["loading", "failed"] as const) {
      expect(cardState(open, ["PostgreSQL"], undefined, load)).toMatchObject({
        readOnly: true,
        canAnswer: false,
      });
    }
  });

  test("once Answer is pressed: read-only with what was sent, then the receipt at sent", () => {
    const act = { choice: ["PostgreSQL"], when: "2026-10-30T09:41:27.123Z" };
    expect(cardState(open, ["SQLite"], act, "visible")).toEqual({
      phase: "sending",
      shown: ["PostgreSQL"],
      readOnly: true,
      canAnswer: false,
    });
    expect(cardState(open, [], { ...act, outcome: "sent" }, "visible").receipt).toBe("sent");
  });

  test("an answered question shows the logged answer, read-only, with its receipt", () => {
    expect(cardState(answered("sent"), ["PostgreSQL"], undefined, "visible")).toEqual({
      phase: "answered",
      shown: ["SQLite"],
      receipt: "sent",
      readOnly: true,
      canAnswer: false,
    });
    expect(cardState(answered("delivered"), [], undefined, "visible").receipt).toBe(
      "delivered to the agent",
    );
  });

  test("the logged answer wins over an act still in flight", () => {
    const act = { choice: ["PostgreSQL"], when: "2026-10-30T09:41:27Z", outcome: "sent" as const };
    expect(cardState(answered("sent"), [], act, "visible").shown).toEqual(["SQLite"]);
  });

  test("a question the state does not list can be neither changed nor answered (AD-10)", () => {
    expect(cardState(undefined, ["PostgreSQL"], undefined, "visible")).toMatchObject({
      readOnly: true,
      canAnswer: false,
    });
  });

  test("a question's status is found in the state by its item ID", () => {
    const state: BoardState = { ask: "waiting", questions: [open] };
    expect(statusOf(state, "database")).toBe(open);
    expect(statusOf(state, "other")).toBeUndefined();
  });
});

describe("the answer view message (FR-19, FR-22)", () => {
  test("carries the question's ID and revision, the choice, and the act's time in UTC", () => {
    const at = new Date("2026-10-30T09:41:27.123Z");
    expect(answerOf(question, ["PostgreSQL"], at)).toEqual({
      type: "answer",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27.123Z",
    });
  });
});
