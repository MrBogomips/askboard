import { describe, expect, mock, test } from "bun:test";
import { type DraftRecord, type LifecycleBoardState, widgetResultFits } from "@askboard/contract";
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
import { createRevisions, shownOfBoard } from "./agent-change.ts";
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

describe("the board's default placement (settings-languages, task 8.5; FR-13)", () => {
  test("a question without its own placement takes the default, and the default can change", () => {
    const { board } = setUp();
    expect(board.effectivePlacement("region")).toBe("beside");
    board.setDefaultPlacement("inline");
    expect(board.effectivePlacement("region")).toBe("inline");
    expect(board.placement("region")).toBeUndefined();
  });

  test("under an inline default, Beside is the question's own choice, held and restored", () => {
    const { board, record, values } = setUp();
    board.setDefaultPlacement("inline");
    board.setPlacement("region", "beside");
    expect(board.effectivePlacement("region")).toBe("beside");
    expect(record().questions).toEqual({ region: { rev: 1, context: "beside" } });
    board.setPlacement("region", "inline");
    expect(board.placement("region")).toBeUndefined();
    expect(record().questions).toEqual({});
    const saved = { delivery: "immediate", questions: { region: { rev: 1, context: "beside" } } };
    restoreDraft(
      saved as DraftRecord,
      lifecycleBoardDocument,
      openState(lifecycleBoardDocument),
      values,
      board,
    );
    expect(board.effectivePlacement("region")).toBe("beside");
  });

  test("a replaced draft keeps the default", () => {
    const { board } = setUp();
    board.setDefaultPlacement("inline");
    board.replace({ delivery: "immediate", questions: new Map() });
    expect(board.effectivePlacement("region")).toBe("inline");
  });
});

describe("results beside the draft record (widget-registry, design decision 9)", () => {
  // The plain question with a test-only `probe` widget item `sketch`, and its logged state.
  const [asked] = plainChoiceBoardDocument.items;
  const document = {
    ...plainChoiceBoardDocument,
    items: [
      {
        ...asked,
        props: { ...asked.props, items: [{ type: "probe", id: "sketch", props: { size: 3 } }] },
      },
    ],
  } as unknown as ViewDocument;
  const [question] = questionsOf(document) as [ViewQuestion];
  const result = { pick: "a" };

  // What the probe's chunk would register: its type takes any result (the check of a result's
  // type is the chunks' and the contract's, tested there).
  const accepting = () => ({ fits: () => true });
  const withResults = () => {
    const values = createDraftStore();
    const results = createDraftStore();
    const board = createBoardDraft("immediate");
    connectDrafts(document, values, board, results);
    return {
      values,
      results,
      board,
      record: () => draftRecordOf(document, values.record(), board.get(), results.record()),
    };
  };

  test("a held result starts the question's work and is mirrored under results, none under values", () => {
    const { results, board, record } = withResults();
    results.set("sketch", result);
    expect(board.work("database")).toEqual({ rev: 1 });
    expect(record()).toEqual({
      delivery: "immediate",
      questions: { database: { rev: 1, results: { sketch: result } } },
    });
  });

  test("a result reported and then removed leaves no entry and no work", () => {
    const { results, board, record } = withResults();
    results.set("sketch", result);
    results.set("sketch", undefined);
    expect(record()).toEqual({ delivery: "immediate", questions: {} });
    expect(board.work("database")).toBeUndefined();
  });

  test("a result is answer work, which a revision of an answered question is made of", () => {
    expect(hasAnswerWork(question, new Map(), undefined, new Map([["sketch", result]]))).toBe(true);
    expect(hasAnswerWork(question, new Map(), undefined, new Map())).toBe(false);
    expect(hasAnswerWork(question, new Map(), undefined)).toBe(false);
  });

  test("an edit of a held result makes a ready answer not ready, as an edit of a value does", () => {
    const { results, board } = withResults();
    results.set("sketch", result);
    board.edit("database", 1, (work) => ({ ...work, held: { act: "answer", order: 0 } }));
    results.set("sketch", { pick: "b" });
    expect(board.work("database")?.held).toBeUndefined();
  });

  test("the answer's content holds the results, none when none is held", () => {
    expect(answerContentOf(question, new Map(), undefined, new Map([["sketch", result]]))).toEqual({
      results: { sketch: result },
    });
    expect(answerContentOf(question, new Map(), undefined)).toEqual({});
  });

  test("a mirrored record comes back whole after a reload, the component's result among it", () => {
    const first = withResults();
    first.results.set("sketch", result);
    first.values.set("sketch", { size: 4 });
    const mirrored = first.record();
    const second = withResults();
    restoreDraft(
      mirrored,
      document,
      openState(document),
      second.values,
      second.board,
      second.results,
      accepting,
    );
    expect(second.results.valueOf("sketch")).toEqual(result);
    expect(second.values.valueOf("sketch")).toEqual({ size: 4 });
    expect(second.record()).toEqual(mirrored);
  });

  test("a restored result naming no widget item of the question, or the question itself, is left out", () => {
    const { values, results, board } = withResults();
    const stale: DraftRecord = {
      delivery: "immediate",
      questions: {
        database: {
          rev: 1,
          results: { sketch: result, database: 1, elsewhere: 2, constructor: 3 },
        },
      },
    };
    restoreDraft(stale, document, openState(document), values, board, results, accepting);
    expect([...results.record().keys()]).toEqual(["sketch"]);
  });

  test("a restored result that holds nothing is dropped, and with it the work it was", () => {
    const { values, results, board } = withResults();
    const stale: DraftRecord = {
      delivery: "immediate",
      questions: {
        database: { rev: 1, results: { sketch: { annotations: [] } } },
      },
    };
    restoreDraft(stale, document, openState(document), values, board, results, accepting);
    expect(results.record().size).toBe(0);
    expect(board.get().questions.get("database")).toBeUndefined();
  });

  test("a restored result the item's type refuses against its props now is dropped, and so is the work it was", () => {
    const ranked = {
      ...document,
      items: [
        {
          ...asked,
          props: {
            ...asked.props,
            items: [
              {
                type: "ranking",
                id: "priorities",
                props: { items: ["speed", "comfort"].map((id) => ({ id, label: id })) },
              },
              { type: "probe", id: "sketch", props: {} },
            ],
          },
        },
      ],
    } as unknown as ViewDocument;
    const saved = (results: Record<string, unknown>): DraftRecord => ({
      delivery: "immediate",
      questions: { database: { rev: 1, results } } as never,
    });
    const refused = { order: ["cost", "speed", "comfort"] };
    const fitting = (type: string) =>
      type === "probe"
        ? accepting()
        : type === "ranking"
          ? {
              fits: (result: unknown, props: unknown) =>
                widgetResultFits({ type, id: "x" }, result, props),
            }
          : undefined;
    const alone = withResults();
    restoreDraft(
      saved({ priorities: refused }),
      ranked,
      openState(ranked),
      alone.values,
      alone.board,
      alone.results,
      fitting,
    );
    expect(alone.results.record().size).toBe(0);
    expect(alone.board.get().questions.get("database")).toBeUndefined();
    const beside = withResults();
    restoreDraft(
      saved({ priorities: refused, sketch: result }),
      ranked,
      openState(ranked),
      beside.values,
      beside.board,
      beside.results,
      fitting,
    );
    expect([...beside.results.record().keys()]).toEqual(["sketch"]);
    expect(beside.board.work("database")).toEqual({ rev: 1 });
    const fits = withResults();
    restoreDraft(
      saved({ priorities: { order: ["comfort", "speed"] } }),
      ranked,
      openState(ranked),
      fits.values,
      fits.board,
      fits.results,
      fitting,
    );
    expect(fits.results.valueOf("priorities")).toEqual({ order: ["comfort", "speed"] });
  });

  test("a restored result made on an earlier revision stays, for the notice and Keep mine to settle", () => {
    const rerevised = {
      ...document,
      items: [{ ...document.items[0], rev: 2 }],
    } as unknown as ViewDocument;
    const saved: DraftRecord = {
      delivery: "immediate",
      questions: { database: { rev: 1, results: { sketch: result } } } as never,
    };
    const never = () => ({ fits: () => false });
    const restored = withResults();
    restoreDraft(
      saved,
      rerevised,
      openState(rerevised),
      restored.values,
      restored.board,
      restored.results,
      never,
    );
    expect(restored.results.valueOf("sketch")).toEqual(result);
    expect(restored.board.work("database")).toEqual({ rev: 1 });
  });

  // A widget with a value check, as the Kanban and the Timeline register: a value fits while it
  // names the question's own tag (security review X-2).
  describe("a value the shown revision does not fit", () => {
    const tagged = {
      ...document,
      items: [
        {
          ...document.items[0],
          props: {
            ...(document.items[0] as { props: object }).props,
            items: [{ type: "tagged", id: "cards", props: { tag: "a" } }],
          },
        },
      ],
    } as unknown as ViewDocument;
    const valueFacts = (type: string) =>
      type === "tagged"
        ? {
            valueFits: (value: unknown, props: unknown) =>
              (value as { tag: string }).tag === (props as { tag: string }).tag,
          }
        : undefined;
    const savedAt = (rev: number, value: unknown): DraftRecord => ({
      delivery: "immediate",
      questions: { database: { rev, values: { cards: value } } } as never,
    });
    const restoredFrom = (record: DraftRecord, shown: ViewDocument) => {
      const values = createDraftStore();
      const results = createDraftStore();
      const board = createBoardDraft("immediate");
      connectDrafts(shown, values, board, results);
      restoreDraft(record, shown, openState(shown), values, board, results, valueFacts);
      return { values, results, board };
    };

    test("work on this revision holds a value that fits and drops one that does not, with no work left", () => {
      const fits = restoredFrom(savedAt(1, { tag: "a" }), tagged);
      expect(fits.values.valueOf("cards")).toEqual({ tag: "a" });
      expect(fits.board.work("database")).toEqual({ rev: 1 });
      const refused = restoredFrom(savedAt(1, { tag: "b" }), tagged);
      expect(refused.values.record().has("cards")).toBe(false);
      expect(refused.board.work("database")).toBeUndefined();
    });

    test("work on an earlier revision stays for the notice and Keep mine to settle, as a result does", () => {
      const rerevised = {
        ...tagged,
        items: [{ ...tagged.items[0], rev: 2 }],
      } as unknown as ViewDocument;
      const restored = restoredFrom(savedAt(1, { tag: "b" }), rerevised);
      expect(restored.values.valueOf("cards")).toEqual({ tag: "b" });
      expect(restored.board.work("database")).toEqual({ rev: 1 });
    });

    test("an item whose type registered no value check keeps its value", () => {
      const restored = restoredFrom(savedAt(1, { tag: "b" }), document);
      expect(restored.values.record().size).toBe(0);
      const bare = {
        ...tagged,
        items: [
          {
            ...tagged.items[0],
            props: {
              ...(tagged.items[0] as { props: object }).props,
              items: [{ type: "probe", id: "cards", props: {} }],
            },
          },
        ],
      } as unknown as ViewDocument;
      const kept = restoredFrom(savedAt(1, { tag: "b" }), bare);
      expect(kept.values.valueOf("cards")).toEqual({ tag: "b" });
    });
  });

  test("a record holding results alone is work, and comes back as work", () => {
    const { values, results, board } = withResults();
    const saved: DraftRecord = {
      delivery: "immediate",
      questions: { database: { rev: 1, results: { sketch: result } } },
    };
    restoreDraft(saved, document, openState(document), values, board, results, accepting);
    expect(board.work("database")).toEqual({ rev: 1 });
  });

  test("a mirror of the logged answer's own results is stale, one of other results a revision", () => {
    const state: LifecycleBoardState = {
      ask: "answered",
      questions: [
        {
          itemId: "database",
          rev: 1,
          state: "answered",
          answer: {
            results: { sketch: result },
            when: "2026-11-06T09:30:00Z",
            receipt: "delivered",
          },
        },
      ],
    };
    const mirror = (shown: unknown): DraftRecord => ({
      delivery: "immediate",
      questions: { database: { rev: 1, results: { sketch: shown } } } as never,
    });
    const same = withResults();
    restoreDraft(
      mirror({ pick: "a" }),
      document,
      state,
      same.values,
      same.board,
      same.results,
      accepting,
    );
    expect(same.results.record().size).toBe(0);
    const other = withResults();
    restoreDraft(
      mirror({ pick: "b" }),
      document,
      state,
      other.values,
      other.board,
      other.results,
      accepting,
    );
    expect(other.results.valueOf("sketch")).toEqual({ pick: "b" });
  });
});

// A record restored into a view that has seen the revision its work was made on (document-review,
// task 6.18, row 10): the work names `b` (a TextField), `c` (a NumberField) and `t` (a Table), which
// revision 2 removes. A view that saw revision 1 restores it; a reloaded page never did and drops it.
describe("restoring work made on an item a later revision removed (task 6.18; design decision 15)", () => {
  const [first] = plainChoiceBoardDocument.items;
  const item = (id: string, type: string, extra: object = {}): never =>
    ({ type, id, props: { label: id, ...extra } }) as never;
  const questionOf = (items: readonly never[], rev: number): ViewQuestion =>
    ({
      ...first,
      id: "plan",
      rev,
      props: { ...first?.props, text: "Plan?", options: [{ label: "Yes" }], items },
    }) as unknown as ViewQuestion;
  const table = item("t", "table", {
    columns: [{ field: "rate", type: "number", label: "Rate" }],
    rows: [{ id: "r1", rate: 1 }],
  });
  const REV1 = questionOf(
    [item("a", "text-field"), item("b", "text-field"), item("c", "number-field"), table],
    1,
  );
  const REV2 = questionOf([item("a", "text-field")], 2);
  const documentOf = (question: ViewQuestion): ViewDocument =>
    ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;
  const state: LifecycleBoardState = {
    ask: "waiting",
    questions: [{ itemId: "plan", rev: 2, state: "open" }],
  } as unknown as LifecycleBoardState;
  const RECORD: DraftRecord = {
    delivery: "immediate",
    questions: {
      plan: {
        rev: 1,
        values: { b: { size: 3 } },
        results: { b: "first" },
        entries: { c: "12x" },
        cellEntries: { t: { "r1.rate": "abc" } },
      },
    },
  };
  const restore = (record: DraftRecord, seen: boolean) => {
    const values = createDraftStore();
    const results = createDraftStore();
    const entries = createDraftStore();
    const cellEntries = createDraftStore();
    const board = createBoardDraft("immediate");
    const revisions = createRevisions();
    if (seen) revisions.record(documentOf(REV1));
    revisions.record(documentOf(REV2));
    restoreDraft(
      record,
      documentOf(REV2),
      state,
      values,
      board,
      results,
      undefined,
      entries,
      cellEntries,
      revisions,
    );
    const shownOf = shownOfBoard(board, revisions);
    return {
      values,
      results,
      entries,
      cellEntries,
      board,
      record: () =>
        draftRecordOf(
          documentOf(REV2),
          values.record(),
          board.get(),
          results.record(),
          entries.record(),
          cellEntries.record(),
          shownOf,
        ),
    };
  };

  test("a view that saw revision 1 keeps a value, a result, an entry and a cell entry on them", () => {
    const held = restore(RECORD, true);
    expect(held.values.valueOf("b")).toEqual({ size: 3 });
    expect(held.results.valueOf("b")).toBe("first");
    expect(held.entries.valueOf("c")).toBe("12x");
    expect(held.cellEntries.valueOf("t")).toEqual(new Map([["r1.rate", "abc"]]));
    expect(held.board.work("plan")).toEqual({ rev: 1 });
    expect(held.record()).toEqual(RECORD);
  });

  test("a view that never saw it drops them and leaves the question no work", () => {
    const held = restore(RECORD, false);
    expect(held.values.valueOf("b")).toBeUndefined();
    expect(held.results.valueOf("b")).toBeUndefined();
    expect(held.entries.valueOf("c")).toBeUndefined();
    expect(held.cellEntries.valueOf("t")).toBeUndefined();
    expect(held.board.work("plan")).toBeUndefined();
    expect(held.record().questions).toEqual({});
  });

  test("entry-only and cell-entry-only work follow the same rule", () => {
    const entryOnly: DraftRecord = {
      delivery: "immediate",
      questions: { plan: { rev: 1, entries: { c: "12x" } } },
    };
    const cellsOnly: DraftRecord = {
      delivery: "immediate",
      questions: { plan: { rev: 1, cellEntries: { t: { "r1.rate": "abc" } } } },
    };
    expect(restore(entryOnly, true).record()).toEqual(entryOnly);
    expect(restore(cellsOnly, true).record()).toEqual(cellsOnly);
    expect(restore(entryOnly, false).board.work("plan")).toBeUndefined();
    expect(restore(cellsOnly, false).board.work("plan")).toBeUndefined();
  });

  test("work on an item both revisions hold is restored either way", () => {
    const both: DraftRecord = {
      delivery: "immediate",
      questions: { plan: { rev: 1, results: { a: "kept" } } },
    };
    for (const seen of [true, false]) {
      const held = restore(both, seen);
      expect(held.results.valueOf("a")).toBe("kept");
      expect(held.board.work("plan")).toEqual({ rev: 1 });
    }
  });
});
