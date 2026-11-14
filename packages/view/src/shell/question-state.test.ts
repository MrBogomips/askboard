import { describe, expect, test } from "bun:test";
import type { BoardState, LifecycleQuestionStatus, QuestionStatus } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewQuestion, WidgetItem } from "../view-document.ts";
import type { Flight } from "./answer-acts.ts";
import {
  type ActionInputs,
  answerOf,
  type CardInputs,
  cardActions,
  cardState,
  choiceOf,
  contentOf,
  draftAnswerOf,
  shownFor,
  shownResultFor,
  statusOf,
  unchangedOf,
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

describe("the derived values an answer carries (gantt-widget design decision 10; AD-20, FR-12)", () => {
  // The Gantt question; `card-acts.ts` adds the derived values to what "Answer" sends.
  const [schedule] = ganttBoardDocument.items;
  const finish = { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] };
  const sent = { values: { release: ganttEditedValue }, derived: finish };

  test("the answer view message keeps them beside the values", () => {
    expect(answerOf(schedule, sent, new Date("2026-10-31T09:41:27.123Z"))).toEqual({
      type: "answer",
      itemId: "schedule-review",
      rev: 1,
      values: { release: ganttEditedValue },
      derived: finish,
      when: "2026-10-31T09:41:27.123Z",
    });
  });

  test("the act keeps them, and they enable nothing on their own", () => {
    expect(card({ flight: flightOf([answerAct(sent)], "sent") }).shown).toEqual(sent);
    expect(card({ draft: { derived: finish } }).canAnswer).toBe(false);
  });
});

describe("a question with widget results (widget-registry, design decision 9)", () => {
  // Test-only `probe` widget items, one of which reports a result (design decision 12).
  const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
  const second: WidgetItem = { type: "probe", id: "second", props: { size: 1 } };
  const asked: ViewQuestion = {
    ...question,
    props: { text: "Which one?", items: [sketch, second] },
  };
  const result = { pick: "a" };
  const none = new Map<string, unknown>();
  const held = new Map<string, unknown>([["sketch", result]]);

  test("the draft's answer holds the held results of the question's widget items, beside no values", () => {
    expect(draftAnswerOf(asked, none, held)).toEqual({ results: { sketch: result } });
  });

  test("the results go beside the choice and the values, and an item of another question adds none", () => {
    const record = new Map<string, unknown>([["sketch", { size: 4 }]]);
    expect(draftAnswerOf(asked, record, held)).toEqual({
      values: { sketch: { size: 4 } },
      results: { sketch: result },
    });
    expect(draftAnswerOf(asked, none, new Map([["other", result]]))).toEqual({});
    expect(draftAnswerOf(asked, none, new Map([["database", result]]))).toEqual({});
  });

  test("with no results store the answer is what it was", () => {
    expect(draftAnswerOf(asked, new Map([["sketch", { size: 4 }]]))).toEqual({
      values: { sketch: { size: 4 } },
    });
  });

  test("an item ID such as __proto__ is a plain key in the results", () => {
    const proto = { ...sketch, id: "__proto__" };
    const question2: ViewQuestion = { ...asked, props: { text: "t", items: [proto] } };
    const answer = draftAnswerOf(question2, none, new Map([["__proto__", result]]));
    expect(Object.hasOwn(answer.results ?? {}, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(answer.results)).toBe(Object.prototype);
  });

  test("Answer is enabled by a result alone, on a visible, open question", () => {
    const draft = { results: { sketch: result } };
    expect(card({ draft })).toMatchObject({ phase: "open", readOnly: false, canAnswer: true });
    expect(card({ draft }).noteOnly).toBe(false);
    expect(card({ draft, load: "loading" }).canAnswer).toBe(false);
    expect(card({ draft, lock: "moved" }).canAnswer).toBe(false);
  });

  test("derived values alone are still no content", () => {
    expect(card({ draft: { derived: { "sketch.count": 1 } } }).canAnswer).toBe(false);
  });

  test("the answer sends the results and no values", () => {
    const at = new Date("2026-11-06T09:41:27.123Z");
    expect(answerOf(asked, draftAnswerOf(asked, none, held), at)).toEqual({
      type: "answer",
      itemId: "database",
      rev: 1,
      results: { sketch: result },
      when: "2026-11-06T09:41:27.123Z",
    });
  });

  test("the act shows the sent results, each on its item, and a logged answer's results read-only", () => {
    const sending = card({
      flight: flightOf([answerAct({ results: { sketch: result } })], "sent"),
    });
    expect(sending).toMatchObject({ phase: "sending", shown: { results: { sketch: result } } });
    expect(shownResultFor(sending.shown, "database", "sketch")).toBe(result);
    expect(shownResultFor(sending.shown, "database", "second")).toBeUndefined();
    expect(shownResultFor(sending.shown, "database", "constructor")).toBeUndefined();
    expect(shownResultFor(sending.shown, "database", "database")).toBeUndefined();
    expect(shownResultFor(undefined, "database", "sketch")).toBeUndefined();
    const logged = {
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: {
        results: { sketch: result },
        when: "2026-11-06T09:41:27Z",
        receipt: "delivered",
      },
    } as LifecycleQuestionStatus;
    const shown = card({ status: logged });
    expect(shown).toMatchObject({
      phase: "answered",
      readOnly: false,
      shown: { results: { sketch: result } },
    });
    expect(shownResultFor(shown.shown, "database", "sketch")).toEqual(result);
  });
});

describe("an answer's content, results included (approval-scale-ranking, design decision 6)", () => {
  test("carries the results of the answer, and none when it has none", () => {
    const results = { sketch: { pick: "a" } };
    expect(contentOf({ choice: ["SQLite"], results, note: "Ok." })).toEqual({
      choice: ["SQLite"],
      results,
      note: "Ok.",
    });
    expect(Object.hasOwn(contentOf({ choice: ["SQLite"] }), "results")).toBe(false);
  });
});

// View-and-widgets: Which items an answer holds unchanged (reopen-start-from-answer, design
// decision 2): the one reader of `unchanged`, by the answer's role.
describe("which items an answer holds unchanged", () => {
  test("the listed IDs when the answer holds the list, whatever its role", () => {
    for (const role of ["current", "previous"] as const) {
      const holds = unchangedOf({ unchanged: ["plan", "roadmap"] }, role);
      expect(holds("plan")).toBe(true);
      expect(holds("roadmap")).toBe(true);
      expect(holds("board")).toBe(false);
    }
  });

  test("an empty list holds none, whatever its role", () => {
    for (const role of ["current", "previous"] as const) {
      const holds = unchangedOf({ unchanged: [] }, role);
      expect(holds("plan")).toBe(false);
      expect(holds("roadmap")).toBe(false);
    }
  });

  test("a current answer without the list holds every ID: it names the current revision", () => {
    const holds = unchangedOf({ choice: ["SQLite"] }, "current");
    expect(holds("plan")).toBe(true);
    expect(holds("anything-else")).toBe(true);
  });

  test("a previous answer without the list holds none: a field lost on the way carries nothing", () => {
    const holds = unchangedOf({ choice: ["SQLite"] }, "previous");
    expect(holds("plan")).toBe(false);
    expect(holds("anything-else")).toBe(false);
  });

  test("an ID is read as an own entry of the list, never as an inherited name", () => {
    const holds = unchangedOf({ unchanged: ["plan"] }, "previous");
    expect(holds("constructor")).toBe(false);
    expect(holds("__proto__")).toBe(false);
    expect(holds("toString")).toBe(false);
  });

  test("the answer's content keeps the list, an empty one included, and none when it has none", () => {
    expect(contentOf({ choice: ["a"], unchanged: ["plan"] })).toEqual({
      choice: ["a"],
      unchanged: ["plan"],
    });
    expect(contentOf({ unchanged: [] })).toEqual({ unchanged: [] });
    expect(Object.hasOwn(contentOf({ choice: ["a"] }), "unchanged")).toBe(false);
  });

  test("the content's list is a copy, not the answer's array", () => {
    const given = { unchanged: ["plan"] };
    const content = contentOf(given);
    expect(content.unchanged).not.toBe(given.unchanged);
  });

  test("the draft's answer message carries no list: the board never sends one", () => {
    const sent = answerOf(question, { choice: ["SQLite"] }, new Date("2026-11-08T10:00:00Z"));
    expect(Object.hasOwn(sent, "unchanged")).toBe(false);
  });
});
