import { describe, expect, mock, test } from "bun:test";
import type { DraftRecord, LifecycleBoardState } from "@askboard/contract";
import {
  lifecycleBoardDocument,
  lifecycleDraftRecord,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import {
  questionsOf,
  type ViewArea,
  type ViewDocument,
  type ViewQuestion,
} from "../view-document.ts";
import {
  answerContentOf,
  connectDrafts,
  createBoardDraft,
  draftRecordOf,
  hasAnswerWork,
  restoreDraft,
} from "./board-draft.ts";
import { createDraftStore } from "./draft-store.ts";

const setUp = (document: ViewDocument = lifecycleBoardDocument) => {
  const values = createDraftStore();
  const board = createBoardDraft(document.delivery ?? "immediate");
  const stop = connectDrafts(document, values, board);
  return {
    values,
    board,
    stop,
    record: () => draftRecordOf(document, values.record(), board.get()),
  };
};

const openState = (document: ViewDocument): LifecycleBoardState => ({
  ask: "waiting",
  questions: questionsOf(document).map(({ id, rev }) => ({
    itemId: id,
    rev,
    state: "open",
  })) as unknown as LifecycleBoardState["questions"],
});

describe("the lifecycle draft beside the draft record (ask-lifecycle, design decision 6)", () => {
  test("it starts with no work, in the delivery the ask requests", () => {
    const { record } = setUp();
    expect(record()).toEqual({ delivery: "submitted", questions: {} });
    expect(setUp(plainChoiceBoardDocument).record()).toEqual({
      delivery: "immediate",
      questions: {},
    });
  });

  test("a question's work keeps the revision it was made on, from its first edit", () => {
    const { board, values, record } = setUp();
    values.set("region", ["EU"]);
    board.edit("payment", 1, (work) => ({ ...work, other: "Mollie", note: "Cheaper." }));
    board.edit("payment", 2, (work) => ({ ...work, composer: "Does the EU" }));
    expect(record()).toEqual({
      delivery: "submitted",
      questions: {
        region: { rev: 1, values: { region: ["EU"] } },
        payment: { rev: 1, other: "Mollie", note: "Cheaper.", composer: "Does the EU" },
      },
    });
  });

  test("empty texts and empty option notes leave the record; Other chosen with no text stays", () => {
    const { board, record } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, other: "", note: "", optionNotes: { Adyen: "" } }));
    expect(record()).toEqual({
      delivery: "submitted",
      questions: { payment: { rev: 1, other: "" } },
    });
  });

  test("a question whose work is all gone leaves the record, and so does its revision", () => {
    const { board, values, record } = setUp();
    values.set("region", ["EU"]);
    values.set("region", undefined);
    board.edit("payment", 1, () => ({ rev: 1, note: "x" }));
    board.clear("payment", ["note"]);
    expect(record()).toEqual({ delivery: "submitted", questions: {} });
    expect(board.work("region")).toBeUndefined();
  });

  test("an edit to a ready question makes it not ready (FR-22); a held postpone stays", () => {
    const { board, values } = setUp();
    board.edit("region", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    values.set("region", ["EU", "US"]);
    expect(board.work("region")?.held).toBeUndefined();
    board.edit("payment", 1, (work) => ({ ...work, held: { act: "decline", order: 1 } }));
    board.edit("payment", 1, (work) => ({ ...work, note: "Reason" }));
    expect(board.work("payment")?.held).toBeUndefined();
    board.edit("rollout", 1, (work) => ({ ...work, held: { act: "postpone", order: 2 } }));
    board.edit("rollout", 1, (work) => ({ ...work, note: "Later" }));
    expect(board.work("rollout")?.held).toEqual({ act: "postpone", order: 2 });
  });

  test("a held note alone is not ready once the note or the choice changes; a held undo stays (task 6.6)", () => {
    const { board, values } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, note: "Ask", held: { act: "note", order: 0 } }));
    board.edit("payment", 1, (work) => ({ ...work, note: "Ask ops" }));
    expect(board.work("payment")?.held).toBeUndefined();
    board.edit("region", 1, () => ({ rev: 1, note: "EU", held: { act: "note", order: 1 } }));
    values.set("region", ["EU"]);
    expect(board.work("region")?.held).toBeUndefined();
    board.edit("rollout", 1, () => ({ rev: 1, held: { act: "reopen", order: 2 } }));
    board.edit("rollout", 1, (work) => ({ ...work, note: "Later" }));
    values.set("rollout", ["All at once"]);
    expect(board.work("rollout")?.held).toEqual({ act: "reopen", order: 2 });
  });

  test("an edit that makes an act held over the undo of a sent postpone not ready holds the undo again; the record holds the act alone", () => {
    const { board, values, record } = setUp();
    const undo = { act: "reopen", order: 0 } as const;
    board.edit("region", 1, () => ({ rev: 1, held: { act: "answer", order: 1 }, undo }));
    values.set("region", ["EU"]);
    expect(board.work("region")).toEqual({ rev: 1, held: undo });
    board.edit("payment", 1, () => ({
      rev: 1,
      note: "Ask",
      held: { act: "note", order: 2 },
      undo,
    }));
    expect(record().questions.payment).toEqual({
      rev: 1,
      note: "Ask",
      held: { act: "note", order: 2 },
    });
    board.edit("payment", 1, (work) => ({ ...work, note: "Ask ops" }));
    expect(board.work("payment")).toEqual({ rev: 1, note: "Ask ops", held: undo });
  });

  test("the composer's text does not touch a ready answer", () => {
    const { board } = setUp();
    board.edit("region", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    board.edit("region", 1, (work) => ({ ...work, composer: "Why?" }));
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 0 });
  });

  test("the delivery mode and the question in view are the board's", () => {
    const { board, record } = setUp();
    board.setDelivery("immediate");
    board.setInView("payment");
    expect(record()).toEqual({ delivery: "immediate", inView: "payment", questions: {} });
    board.setInView("gone");
    expect(record()).toEqual({ delivery: "immediate", questions: {} });
  });

  test("subscribers hear each change; nothing that changes nothing is heard", () => {
    const { board } = setUp();
    const heard = mock(() => {});
    board.subscribe(heard);
    board.setDelivery("submitted");
    board.setInView(undefined);
    board.clear("region", ["note"]);
    expect(heard).not.toHaveBeenCalled();
    board.setDelivery("immediate");
    expect(heard).toHaveBeenCalledTimes(1);
  });

  test("a question no longer on the board leaves the record", () => {
    const { board, values } = setUp();
    board.edit("gone", 1, () => ({ rev: 1, note: "x" }));
    values.set("gone", ["x"]);
    expect(draftRecordOf(lifecycleBoardDocument, values.record(), board.get()).questions).toEqual(
      {},
    );
  });
});

describe("restoring a draft record (ask-lifecycle: What a reload keeps; FR-25)", () => {
  test("the record comes back whole: values, Other text, notes, held acts, delivery and view", () => {
    const { values, board, record } = setUp();
    restoreDraft(
      lifecycleDraftRecord,
      lifecycleBoardDocument,
      openState(lifecycleBoardDocument),
      values,
      board,
    );
    expect(record()).toEqual(lifecycleDraftRecord);
    expect(values.valueOf("region")).toEqual(["EU"]);
    expect(board.work("payment")?.other).toBe("Mollie");
  });

  test("work on questions the board no longer holds, and values not of the question, are left out", () => {
    const { values, board, record } = setUp();
    const stale: DraftRecord = {
      delivery: "immediate",
      inView: "gone",
      questions: {
        gone: { rev: 1, note: "x" },
        region: { rev: 1, values: { region: [3], payment: ["Stripe"] }, note: "kept" },
      },
    };
    restoreDraft(stale, lifecycleBoardDocument, openState(lifecycleBoardDocument), values, board);
    expect(record()).toEqual({
      delivery: "immediate",
      questions: { region: { rev: 1, note: "kept" } },
    });
    expect(values.valueOf("payment")).toBeUndefined();
  });

  test("a single-question board stays in immediate delivery", () => {
    const { values, board, record } = setUp(plainChoiceBoardDocument);
    restoreDraft(
      { delivery: "submitted", questions: { database: { rev: 1, note: "n" } } },
      plainChoiceBoardDocument,
      openState(plainChoiceBoardDocument),
      values,
      board,
    );
    expect(record()).toEqual({
      delivery: "immediate",
      questions: { database: { rev: 1, note: "n" } },
    });
  });

  test("a stale mirror of the current answer is not restored as a revision", () => {
    const { values, board, record } = setUp(plainChoiceBoardDocument);
    const state: LifecycleBoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: {
            choice: ["PostgreSQL"],
            when: "2026-10-31T14:05:12Z",
            receipt: "delivered",
          },
        },
      ],
    };
    const stale: DraftRecord = {
      delivery: "immediate",
      questions: {
        database: {
          rev: 1,
          values: { database: ["PostgreSQL"] },
          composer: "Why this choice?",
        },
      },
    };

    restoreDraft(stale, plainChoiceBoardDocument, state, values, board);

    expect(record()).toEqual({
      delivery: "immediate",
      questions: { database: { rev: 1, composer: "Why this choice?" } },
    });
    const database = plainChoiceBoardDocument.items[0] as ViewQuestion;
    expect(hasAnswerWork(database, values.record(), board.work("database"))).toBe(false);
  });

  test("different answer content remains unsent work", () => {
    const { values, board, record } = setUp(plainChoiceBoardDocument);
    const state: LifecycleBoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: {
            choice: ["PostgreSQL"],
            when: "2026-10-31T14:05:12Z",
            receipt: "delivered",
          },
        },
      ],
    };
    const revision: DraftRecord = {
      delivery: "immediate",
      questions: { database: { rev: 1, values: { database: ["SQLite"] } } },
    };

    restoreDraft(revision, plainChoiceBoardDocument, state, values, board);

    expect(record()).toEqual(revision);
    const database = plainChoiceBoardDocument.items[0] as ViewQuestion;
    expect(hasAnswerWork(database, values.record(), board.work("database"))).toBe(true);
  });
});

describe("what Answer sends: the question's whole answer (FR-3, FR-7, FR-18)", () => {
  const payment = (lifecycleBoardDocument.items[0] as unknown as ViewArea).props
    .items[1] as ViewQuestion;

  test("the choice, the Other text, the option notes and the note, each only when given", () => {
    const { values, board } = setUp();
    values.set("payment", ["Stripe"]);
    board.edit("payment", 1, () => ({
      rev: 1,
      optionNotes: { Adyen: "Costly.", Stripe: "" },
      note: "Go.",
    }));
    expect(answerContentOf(payment, values.record(), board.work("payment"))).toEqual({
      choice: ["Stripe"],
      optionNotes: { Adyen: "Costly." },
      note: "Go.",
    });
  });

  test("Other chosen with its text and no option; with no text, no Other", () => {
    const { values, board } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, other: "MariaDB" }));
    expect(answerContentOf(payment, values.record(), board.work("payment"))).toEqual({
      other: "MariaDB",
    });
    board.edit("payment", 1, () => ({ rev: 1, other: "" }));
    expect(answerContentOf(payment, values.record(), board.work("payment"))).toEqual({});
  });
});

describe("whether a question's draft holds answer work (a revision's start; task 6.7)", () => {
  const payment = (lifecycleBoardDocument.items[0] as unknown as ViewArea).props
    .items[1] as ViewQuestion;

  test("a value, Other chosen, an option note or a note do; the composer or a held act alone do not", () => {
    const { values, board } = setUp();
    expect(hasAnswerWork(payment, values.record(), undefined)).toBe(false);
    board.edit("payment", 1, () => ({
      rev: 1,
      composer: "Why?",
      held: { act: "postpone", order: 0 },
    }));
    expect(hasAnswerWork(payment, values.record(), board.work("payment"))).toBe(false);
    for (const work of [
      { rev: 1, other: "" },
      { rev: 1, optionNotes: { Adyen: "x" } },
      { rev: 1, note: "n" },
    ]) {
      expect(hasAnswerWork(payment, values.record(), work)).toBe(true);
    }
    values.set("payment", ["Stripe"]);
    expect(hasAnswerWork(payment, values.record(), board.work("payment"))).toBe(true);
  });
});

describe("a question's context placement (excerpts, task 6.3; FR-13, AD-20)", () => {
  test("Inline goes into the draft record at the question's revision and Beside takes it out", () => {
    const { board, record } = setUp();
    board.setPlacement("region", "inline");
    expect(board.placement("region")).toBe("inline");
    expect(record().questions).toEqual({ region: { rev: 1, context: "inline" } });
    board.setPlacement("region", "beside");
    expect(board.placement("region")).toBeUndefined();
    expect(record().questions).toEqual({});
  });

  test("it joins the question's other work in one entry and starts no work of its own", () => {
    const { board, record } = setUp();
    board.setPlacement("region", "inline");
    expect(board.work("region")).toBeUndefined();
    board.edit("region", 1, (work) => ({ ...work, note: "n" }));
    expect(record().questions).toEqual({ region: { rev: 1, note: "n", context: "inline" } });
  });

  test("a placement on a question the board does not hold stays out of the record", () => {
    const { board, record } = setUp();
    board.setPlacement("gone", "inline");
    expect(record().questions).toEqual({});
  });

  test("a restored record brings it back, and only it", () => {
    const { values, board, record } = setUp();
    const saved: DraftRecord = {
      delivery: "submitted",
      questions: { region: { rev: 1, context: "inline" } },
    };
    restoreDraft(saved, lifecycleBoardDocument, openState(lifecycleBoardDocument), values, board);
    expect(board.placement("region")).toBe("inline");
    expect(board.work("region")?.context).toBeUndefined();
    expect(record()).toEqual(saved);
  });

  test("a restored placement of a stale answer stays", () => {
    const { values, board } = setUp(plainChoiceBoardDocument);
    const [question] = questionsOf(plainChoiceBoardDocument);
    const id = (question as ViewQuestion).id;
    restoreDraft(
      { delivery: "immediate", questions: { [id]: { rev: 1, context: "inline" } } },
      plainChoiceBoardDocument,
      openState(plainChoiceBoardDocument),
      values,
      board,
    );
    expect(board.placement(id)).toBe("inline");
  });
});
