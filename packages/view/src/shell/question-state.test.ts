import { describe, expect, test } from "bun:test";
import type { BoardState, QuestionStatus } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewQuestion, WidgetItem } from "../view-document.ts";
import {
  answerOf,
  cardState,
  choiceOf,
  draftAnswerOf,
  shownFor,
  statusOf,
} from "./question-state.ts";

const [question] = plainChoiceBoardDocument.items;
// The draft's answer content: the question's choice and the changed widget items' values.
const chosen = (...choice: string[]) => (choice.length === 0 ? {} : { choice });
const open: QuestionStatus = { itemId: "database", rev: 1, state: "open" };
const answered = (receipt: "sent" | "delivered"): QuestionStatus => ({
  itemId: "database",
  rev: 1,
  state: "answered",
  answer: { choice: ["SQLite"], when: "2026-10-29T09:41:27Z", receipt },
});

describe("what a question card shows (EXPERIENCE.md, Question card and Delivery receipt)", () => {
  test("an open question: nothing chosen, Answer disabled until a choice (AD-10, FR-3)", () => {
    expect(cardState(open, {}, undefined, "visible")).toEqual({
      phase: "open",
      readOnly: false,
      canAnswer: false,
    });
    expect(cardState(open, chosen("PostgreSQL"), undefined, "visible").canAnswer).toBe(true);
  });

  test("while loading or after its item failed, nothing can be chosen or answered (AD-9)", () => {
    for (const load of ["loading", "failed"] as const) {
      expect(cardState(open, chosen("PostgreSQL"), undefined, load)).toMatchObject({
        readOnly: true,
        canAnswer: false,
      });
    }
  });

  test("once Answer is pressed: read-only with what was sent, then the receipt at sent", () => {
    const act = { choice: ["PostgreSQL"], when: "2026-10-30T09:41:27.123Z" };
    expect(cardState(open, chosen("SQLite"), act, "visible")).toEqual({
      phase: "sending",
      shown: { choice: ["PostgreSQL"] },
      readOnly: true,
      canAnswer: false,
    });
    expect(cardState(open, {}, { ...act, outcome: "sent" }, "visible").receipt).toBe("sent");
  });

  test("an answer the board page queued while disconnected shows not sent yet (F-56)", () => {
    const act = {
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27Z",
      outcome: "queued" as const,
    };
    expect(cardState(open, {}, act, "visible")).toEqual({
      phase: "sending",
      shown: { choice: ["PostgreSQL"] },
      receipt: "not sent yet",
      readOnly: true,
      canAnswer: false,
    });
  });

  test("a locked board can be neither changed nor answered, and keeps what it shows (AD-21)", () => {
    expect(cardState(open, chosen("PostgreSQL"), undefined, "visible", true)).toEqual({
      phase: "open",
      readOnly: true,
      canAnswer: false,
    });
    const act = {
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27Z",
      outcome: "queued" as const,
    };
    expect(cardState(open, {}, act, "visible", true).receipt).toBe("not sent yet");
    expect(cardState(answered("delivered"), {}, undefined, "visible", true)).toMatchObject({
      phase: "answered",
      receipt: "delivered to the agent",
      readOnly: true,
    });
  });

  test("an answer the board page holds shows, read-only, with its receipt, act or not (M3)", () => {
    const held = {
      itemId: "database",
      choice: ["SQLite"],
      when: "2026-10-30T09:41:27Z",
      outcome: "sent" as const,
    };
    expect(cardState(open, chosen("PostgreSQL"), undefined, "visible", false, held)).toEqual({
      phase: "sending",
      shown: { choice: ["SQLite"] },
      receipt: "sent",
      readOnly: true,
      canAnswer: false,
    });
    const act = { choice: ["PostgreSQL"], when: held.when, outcome: "sent" as const };
    expect(
      cardState(open, {}, act, "visible", false, { ...held, outcome: "queued" }),
    ).toMatchObject({
      shown: { choice: ["SQLite"] },
      receipt: "not sent yet",
    });
    expect(cardState(answered("sent"), {}, act, "visible", false, held).shown).toEqual({
      choice: ["SQLite"],
    });
  });

  test("once the board page holds no answer and the act is gone, the question is open again", () => {
    expect(cardState(open, chosen("PostgreSQL"), undefined, "visible", false, undefined)).toEqual({
      phase: "open",
      readOnly: false,
      canAnswer: true,
    });
  });

  test("an answered question shows the logged answer, read-only, with its receipt", () => {
    expect(cardState(answered("sent"), chosen("PostgreSQL"), undefined, "visible")).toEqual({
      phase: "answered",
      shown: { choice: ["SQLite"] },
      receipt: "sent",
      readOnly: true,
      canAnswer: false,
    });
    expect(cardState(answered("delivered"), {}, undefined, "visible").receipt).toBe(
      "delivered to the agent",
    );
  });

  test("the logged answer wins over an act still in flight", () => {
    const act = { choice: ["PostgreSQL"], when: "2026-10-30T09:41:27Z", outcome: "sent" as const };
    expect(cardState(answered("sent"), {}, act, "visible").shown).toEqual({ choice: ["SQLite"] });
  });

  test("a question the state does not list can be neither changed nor answered (AD-10)", () => {
    expect(cardState(undefined, chosen("PostgreSQL"), undefined, "visible")).toMatchObject({
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

describe("the question's choice in the draft record (design decision 7)", () => {
  test("is the labels Choice put there, and none while unset", () => {
    expect(choiceOf(["PostgreSQL"])).toEqual(["PostgreSQL"]);
    expect(choiceOf(undefined)).toEqual([]);
  });
});

describe("a question with widget items (design decision 7)", () => {
  // Test-only `probe` widget items and their edited values (design decision 12).
  const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
  const second: WidgetItem = { type: "probe", id: "second", props: { size: 1 } };
  const withItems = (options: boolean): ViewQuestion => {
    const { options: kept, ...props } = question.props;
    return {
      ...question,
      props: { ...props, ...(options ? { options: kept } : {}), items: [sketch, second] },
    };
  };
  const edited = { size: 4 };

  test("the draft's answer holds the choice, if any, and only the changed widget items' values", () => {
    const record = new Map<string, unknown>([["sketch", edited]]);
    expect(draftAnswerOf(withItems(false), record)).toEqual({ values: { sketch: edited } });
    expect(draftAnswerOf(withItems(true), new Map([...record, ["database", ["SQLite"]]]))).toEqual({
      choice: ["SQLite"],
      values: { sketch: edited },
    });
    expect(draftAnswerOf(withItems(true), new Map([["database", []]]))).toEqual({});
    expect(draftAnswerOf(withItems(true), new Map([["other", edited]]))).toEqual({});
  });

  test("Answer is enabled by a widget's draft value on a visible, open question", () => {
    const draft = { values: { sketch: edited } };
    expect(cardState(open, draft, undefined, "visible")).toEqual({
      phase: "open",
      readOnly: false,
      canAnswer: true,
    });
    expect(cardState(open, draft, undefined, "loading").canAnswer).toBe(false);
    expect(cardState(open, draft, undefined, "visible", true).canAnswer).toBe(false);
  });

  test("the answer sends values only for the changed widget items, and no choice when none", () => {
    const at = new Date("2026-10-30T09:41:27.123Z");
    const record = new Map<string, unknown>([["second", edited]]);
    expect(answerOf(withItems(true), draftAnswerOf(withItems(true), record), at)).toEqual({
      type: "answer",
      itemId: "database",
      rev: 1,
      values: { second: edited },
      when: "2026-10-30T09:41:27.123Z",
    });
  });

  test("the act shows the sent values, each on its item, and nothing on an unsent one", () => {
    const act = {
      values: { sketch: edited },
      when: "2026-10-30T09:41:27Z",
      outcome: "sent" as const,
    };
    const card = cardState(open, {}, act, "visible");
    expect(card).toMatchObject({ phase: "sending", shown: { values: { sketch: edited } } });
    expect(shownFor(card.shown, "database", "sketch")).toBe(edited);
    expect(shownFor(card.shown, "database", "second")).toBeUndefined();
    expect(shownFor(card.shown, "database", "constructor")).toBeUndefined();
    expect(shownFor(card.shown, "database", "database")).toBeUndefined();
    expect(shownFor({ choice: ["SQLite"] }, "database", "database")).toEqual(["SQLite"]);
    expect(shownFor(undefined, "database", "sketch")).toBeUndefined();
  });
});

describe("the answer view message (FR-19, FR-22)", () => {
  test("carries the question's ID and revision, the choice, and the act's time in UTC", () => {
    const at = new Date("2026-10-30T09:41:27.123Z");
    expect(answerOf(question, { choice: ["PostgreSQL"] }, at)).toEqual({
      type: "answer",
      itemId: "database",
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27.123Z",
    });
  });
});
