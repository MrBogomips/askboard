import { describe, expect, test } from "bun:test";
import type { BoardState, LifecycleQuestionStatus, QuestionStatus } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewQuestion, WidgetItem } from "../view-document.ts";
import type { Flight } from "./answer-acts.ts";
import {
  type ActionInputs,
  answerOf,
  type CardInputs,
  cardActions,
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

const flightOf = (acts: Flight["acts"], outcome?: "sent" | "queued"): Flight => ({
  key: 1,
  acts,
  ...(outcome === undefined ? {} : { actionId: "AAAAAAAAAAAAAAAAAAAAAA", outcome }),
});
const answerAct = (content: Record<string, unknown>) =>
  ({
    type: "answer",
    itemId: "database",
    rev: 1,
    when: "2026-10-30T10:00:00Z",
    ...content,
  }) as const;
const card = (inputs: Partial<CardInputs>) =>
  cardState({ status: open, draft: {}, load: "visible", ready: false, ...inputs });

describe("what a question card shows (EXPERIENCE.md, Question card and Delivery receipt)", () => {
  test("an open question: nothing chosen, Answer disabled until a choice, Other text or a note (AD-10, FR-3)", () => {
    expect(card({})).toEqual({
      phase: "open",
      readOnly: false,
      canAnswer: false,
      noteOnly: false,
      ready: false,
    });
    expect(card({ draft: chosen("SQLite") }).canAnswer).toBe(true);
    expect(card({ draft: { other: "MariaDB" } }).canAnswer).toBe(true);
    expect(card({ draft: { note: "Ask ops." } })).toMatchObject({
      canAnswer: true,
      noteOnly: true,
    });
    expect(card({ draft: { optionNotes: { SQLite: "Small." } } }).canAnswer).toBe(false);
    expect(card({ draft: { ...chosen("SQLite"), note: "n" } }).noteOnly).toBe(false);
  });

  test("a postponed question can be answered; a ready one says so (FR-4, FR-22)", () => {
    const postponed = { itemId: "database", rev: 1, state: "postponed" } as const;
    expect(card({ status: postponed, draft: chosen("SQLite") }).canAnswer).toBe(true);
    expect(card({ draft: chosen("SQLite"), ready: true })).toMatchObject({
      phase: "open",
      ready: true,
      canAnswer: true,
      readOnly: false,
    });
  });

  test("while loading or after its item failed, nothing can be chosen or answered (AD-9)", () => {
    for (const load of ["loading", "failed"] as const) {
      expect(card({ draft: chosen("SQLite"), load })).toMatchObject({
        readOnly: true,
        canAnswer: false,
      });
    }
  });

  test("once acted on: read-only with what was sent, then the receipt at sent or not sent yet (F-56)", () => {
    const acts = [answerAct({ choice: ["SQLite"], other: "x" })];
    expect(card({ flight: flightOf(acts) })).toEqual({
      phase: "sending",
      shown: { choice: ["SQLite"], other: "x" },
      readOnly: true,
      canAnswer: false,
      noteOnly: false,
      ready: false,
    });
    expect(card({ flight: flightOf(acts, "sent") }).receipt).toBe("sent");
    expect(card({ flight: flightOf(acts, "queued") }).receipt).toBe("not sent yet");
    const note = [
      { type: "note", itemId: "database", rev: 1, note: "n", when: "2026-10-30T10:00:00Z" },
    ] as const;
    expect(card({ flight: flightOf(note, "sent") })).toMatchObject({
      phase: "sending",
      readOnly: true,
    });
    expect(card({ flight: flightOf(note, "sent") }).shown).toBeUndefined();
  });

  test("a locked board can be neither changed nor answered, and keeps what it shows (AD-21, FR-6)", () => {
    for (const lock of ["moved", "discarded", "closed"] as const) {
      expect(card({ draft: chosen("SQLite"), lock })).toMatchObject({
        phase: "open",
        readOnly: true,
        canAnswer: false,
      });
    }
    expect(card({ status: answered("sent"), lock: "discarded" }).shown).toEqual({
      choice: ["SQLite"],
    });
  });

  test("an answered question shows the logged answer whole with its receipt, and stays editable while the ask is open (FR-22)", () => {
    expect(card({ status: answered("sent") })).toEqual({
      phase: "answered",
      shown: { choice: ["SQLite"] },
      receipt: "sent",
      readOnly: false,
      canAnswer: false,
      noteOnly: false,
      ready: false,
    });
    expect(card({ status: answered("delivered") }).receipt).toBe("delivered to the agent");
    const whole = {
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: {
        other: "MariaDB",
        optionNotes: { SQLite: "Small." },
        note: "n",
        when: "2026-10-29T09:41:27Z",
        receipt: "sent",
      },
    } as const;
    expect(card({ status: whole }).shown).toEqual({
      other: "MariaDB",
      optionNotes: { SQLite: "Small." },
      note: "n",
    });
  });

  test("a revision in flight shows what it sent over the logged answer, until the board page settles it", () => {
    const acts = [answerAct({ choice: ["PostgreSQL"] })];
    expect(card({ status: answered("sent"), flight: flightOf(acts, "sent") })).toMatchObject({
      phase: "sending",
      shown: { choice: ["PostgreSQL"] },
      receipt: "sent",
      readOnly: true,
    });
  });

  test("a declined question shows as declined with its reason, and stays editable", () => {
    const declined = {
      itemId: "database",
      rev: 1,
      state: "declined",
      answer: { declined: true, note: "Not mine.", when: "2026-10-29T09:41:27Z", receipt: "sent" },
    } as const;
    expect(card({ status: declined })).toMatchObject({
      phase: "declined",
      shown: { note: "Not mine." },
      readOnly: false,
      canAnswer: false,
    });
  });

  test("an answered question with work in the draft is a revision: the draft shows, the latest answer's receipt stays, and Answer sends it once it holds an answer (task 6.7)", () => {
    expect(
      card({ status: answered("delivered"), editing: true, draft: chosen("PostgreSQL") }),
    ).toEqual({
      phase: "open",
      receipt: "delivered to the agent",
      readOnly: false,
      canAnswer: true,
      noteOnly: false,
      ready: false,
    });
    expect(card({ status: answered("sent"), editing: true, draft: { note: "n" } })).toMatchObject({
      canAnswer: false,
      noteOnly: false,
    });
    expect(
      card({ status: answered("sent"), editing: true, draft: chosen("SQLite"), ready: true }),
    ).toMatchObject({ ready: true, canAnswer: true });
  });

  test("while an agent-change notice waits for the user's choice, Answer waits too (FR-6)", () => {
    expect(card({ draft: chosen("SQLite"), pending: true })).toMatchObject({
      readOnly: false,
      canAnswer: false,
    });
  });

  test("a question the state does not list can be neither changed nor answered (AD-10)", () => {
    expect(card({ status: undefined, draft: chosen("SQLite") })).toMatchObject({
      readOnly: true,
      canAnswer: false,
    });
  });

  test("a question's status is found in the state by its item ID", () => {
    const state: BoardState = { ask: "waiting", questions: [open] };
    expect(statusOf(state, "database")).toBe(open);
    expect(statusOf(state, "cache")).toBeUndefined();
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
    expect(card({ draft })).toMatchObject({ phase: "open", readOnly: false, canAnswer: true });
    expect(card({ draft, load: "loading" }).canAnswer).toBe(false);
    expect(card({ draft, lock: "moved" }).canAnswer).toBe(false);
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
    const sending = card({ flight: flightOf([answerAct({ values: { sketch: edited } })], "sent") });
    expect(sending).toMatchObject({ phase: "sending", shown: { values: { sketch: edited } } });
    expect(shownFor(sending.shown, "database", "sketch")).toBe(edited);
    expect(shownFor(sending.shown, "database", "second")).toBeUndefined();
    expect(shownFor(sending.shown, "database", "constructor")).toBeUndefined();
    expect(shownFor(sending.shown, "database", "database")).toBeUndefined();
    expect(shownFor({ choice: ["SQLite"] }, "database", "database")).toEqual(["SQLite"]);
    expect(shownFor(undefined, "database", "sketch")).toBeUndefined();
  });
});

describe("the answer view message (FR-19, FR-22)", () => {
  test("carries the Other text, the option notes and the note with the choice (FR-3, FR-7)", () => {
    const at = new Date("2026-10-30T09:41:27.123Z");
    const content = { other: "MariaDB", optionNotes: { SQLite: "Small." }, note: "n" };
    expect(answerOf(question, content, at)).toEqual({
      type: "answer",
      itemId: "database",
      rev: 1,
      ...content,
      when: "2026-10-30T09:41:27.123Z",
    });
  });

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

describe("Postpone, Decline and Explain on the card (FR-4, FR-10; task 6.5)", () => {
  const actions = (inputs: Partial<ActionInputs>) =>
    cardActions({
      status: open,
      held: undefined,
      sending: false,
      load: "visible",
      pending: false,
      explaining: false,
      ...inputs,
    });
  const postponed: LifecycleQuestionStatus = { itemId: "database", rev: 1, state: "postponed" };
  const declined = {
    itemId: "database",
    rev: 1,
    state: "declined",
    answer: { declined: true, when: "2026-10-29T09:41:27Z", receipt: "sent" },
  } as const;

  test("on an open question all three can be used, and nothing is pressed", () => {
    expect(actions({})).toEqual({
      postponed: false,
      canPostpone: true,
      declined: false,
      canDecline: true,
      canExplain: true,
    });
  });

  test("Postpone is pressed on a postponed question or a held postpone, and not on a held undo", () => {
    expect(actions({ status: postponed }).postponed).toBe(true);
    expect(actions({ held: "postpone" }).postponed).toBe(true);
    expect(actions({ status: postponed, held: "reopen" })).toMatchObject({
      postponed: false,
      canPostpone: true,
    });
  });

  test("an act held over the undo of a sent postpone or decline shows the question undone", () => {
    expect(actions({ status: postponed, held: "note", undone: true })).toMatchObject({
      postponed: false,
      canPostpone: true,
    });
    expect(actions({ status: postponed, held: "answer", undone: true }).postponed).toBe(false);
    expect(actions({ status: postponed, held: "note" }).postponed).toBe(true);
    expect(actions({ status: declined, held: "answer", undone: true }).declined).toBe(false);
  });

  test("Postpone is disabled on an answered, declined or ready question; Decline on an answered or ready one", () => {
    expect(actions({ status: answered("sent") })).toMatchObject({
      canPostpone: false,
      canDecline: false,
    });
    expect(actions({ status: declined })).toMatchObject({
      canPostpone: false,
      canDecline: true,
      declined: true,
    });
    expect(actions({ held: "answer" })).toMatchObject({ canPostpone: false, canDecline: false });
    expect(actions({ held: "decline" })).toMatchObject({
      canPostpone: false,
      canDecline: true,
      declined: true,
    });
    expect(actions({ status: declined, held: "reopen" }).declined).toBe(false);
  });

  test("nothing acts while the card's command is on its way, a notice waits, the question is not visible, or the board is locked", () => {
    for (const inputs of [
      { sending: true },
      { pending: true },
      { load: "loading" as const },
      { lock: "closed" as const },
    ]) {
      expect(actions(inputs)).toMatchObject({ canPostpone: false, canDecline: false });
    }
    expect(actions({ sending: true }).canExplain).toBe(true);
    expect(actions({ lock: "closed" }).canExplain).toBe(false);
  });

  test("Explain is disabled until its reply arrives", () => {
    expect(actions({ explaining: true }).canExplain).toBe(false);
  });
});
