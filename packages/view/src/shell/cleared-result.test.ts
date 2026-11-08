import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createAnsweredResults } from "./board-content.ts";
import { createBoardDraft, hasAnswerWork } from "./board-draft.ts";
import { answer, startRevision } from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { itemCallbacks, itemResultOf } from "./item-callbacks.ts";

// A result the user clears during a revision of an answered question (reopen-start-from-answer,
// design decision 2; view-and-widgets: "A result cleared during a revision"): the first edit starts
// the revision and copies the answer's results into the draft, the clear then deletes the item's
// held result, and from then on the card shows the draft alone. The answered lookup is a fallback
// only while no revision has started, so a cleared result is never shown again from the answer
// (re-review 2.11 X-1, Issue #107).

const [database] = plainChoiceBoardDocument.items;
const ACTION_ID = "AAAAAAAAAAAAAAAAAAAAAA";

// A test-only checker of each type's chunk: every result fits, so the display and the carry
// differ by nothing but the revision's start.
const accepting = () => ({ fits: () => true });

const text: WidgetItem = { type: "text-field", id: "name", props: { label: "Name" } };
const pick: WidgetItem = {
  type: "pick-field",
  id: "colour",
  props: {
    label: "Colour",
    options: [
      { id: "red", label: "Red" },
      { id: "blue", label: "Blue" },
    ],
  },
};
const days: WidgetItem = { type: "number-field", id: "days", props: { label: "Days" } };
const ANSWERED = { name: "abc", colour: "red", days: 3 } as const;

const question = {
  ...database,
  props: { text: "Details?", items: [text, pick, days] },
} as unknown as ViewQuestion;
const document = { ...plainChoiceBoardDocument, items: [question] } as unknown as ViewDocument;
const loggedAnswer = { results: ANSWERED, when: "2026-11-08T10:00:00Z", receipt: "delivered" };
const status = {
  itemId: question.id,
  rev: question.rev,
  state: "answered",
  answer: loggedAnswer,
} as unknown as LifecycleQuestionStatus;
const state = {
  ask: "waiting",
  questions: [status],
} as unknown as LifecycleBoardState;

const setUp = () => {
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return { outcome: "sent", actionId: ACTION_ID };
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const draft = createDraftStore();
  const results = createDraftStore();
  const board = createBoardDraft("immediate");
  const context = {
    channel,
    acts: createAnswerActs(),
    draft,
    results,
    board,
    derived: createDerivedStore(),
    delivery: "immediate" as const,
    facts: accepting,
  };
  const answered = createAnsweredResults(() => ({ document, state }), accepting);
  // The card's own step before an edit: the first one starts the revision from the answer.
  const revise = () => {
    if (hasAnswerWork(question, draft.record(), board.work(question.id), results.record())) return;
    startRevision(question, loggedAnswer, context);
  };
  const callbacksOf = (itemId: string) =>
    itemCallbacks({
      draft,
      results,
      itemId,
      questionId: question.id,
      itemIds: [question.id, text.id, pick.id, days.id],
      onBeforeChange: revise,
      onError: (error) => {
        throw error;
      },
    });
  // What an item shows, as the renderer composes it while the card shows no answer of its own.
  const shownOf = (itemId: string): unknown =>
    itemResultOf(
      undefined,
      results.valueOf(itemId),
      answered(itemId),
      hasAnswerWork(question, draft.record(), board.work(question.id), results.record()),
    );
  return { sent, results, context, callbacksOf, shownOf };
};

describe("a result the user clears during a revision (decision 2; Issue #107)", () => {
  const keptWithout = (cleared: string): Record<string, unknown> =>
    Object.fromEntries(Object.entries(ANSWERED).filter(([id]) => id !== cleared));

  for (const cleared of ["name", "colour", "days"] as const) {
    test(`clearing the ${cleared} item shows nothing for it and still shows the others`, () => {
      const { results, callbacksOf, shownOf } = setUp();
      // Before any edit the answered card draws the logged answer; the lookup serves the fallback.
      expect(shownOf(cleared)).toBe(ANSWERED[cleared]);
      callbacksOf(cleared).onResultChange(undefined);
      // The first edit started the revision and copied the answer's results into the draft.
      expect(results.record().has(cleared)).toBe(false);
      expect(shownOf(cleared)).toBeUndefined();
      for (const [id, value] of Object.entries(keptWithout(cleared))) {
        expect(shownOf(id)).toBe(value);
      }
    });

    test(`clearing the ${cleared} item, Answer sends the others' results and none for it`, () => {
      const { sent, context, callbacksOf } = setUp();
      callbacksOf(cleared).onResultChange(undefined);
      answer(question, context);
      expect(sent).toEqual([
        expect.objectContaining({
          type: "answer",
          itemId: question.id,
          results: keptWithout(cleared),
        }),
      ]);
    });
  }

  test("an item the revision has not touched still shows its answered result while no revision has started", () => {
    const { results, shownOf } = setUp();
    expect(results.record().size).toBe(0);
    for (const [id, value] of Object.entries(ANSWERED)) expect(shownOf(id)).toBe(value);
  });
});
