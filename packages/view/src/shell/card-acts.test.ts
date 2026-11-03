import { describe, expect, test } from "bun:test";
import {
  ganttBoardDocument,
  ganttEditedValue,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { ViewArea, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { connectDrafts, createBoardDraft, type Delivery } from "./board-draft.ts";
import {
  acceptRecommended,
  answer,
  decline,
  EXPLAIN,
  explain,
  fillFrom,
  keepMine,
  nextHeldOrder,
  postpone,
  recommendedOf,
  reloadQuestion,
  sendFollowUp,
  withDerived,
} from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";

const [database] = plainChoiceBoardDocument.items;
const [scope] = lifecycleBoardDocument.items as unknown as readonly [ViewArea];
const [region, payment] = scope.props.items as unknown as readonly [ViewQuestion, ViewQuestion];
const ACTION_ID = "AAAAAAAAAAAAAAAAAAAAAA";

const setUp = (delivery: Delivery = "immediate") => {
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
  const board = createBoardDraft(delivery);
  const acts = createAnswerActs();
  const derived = createDerivedStore();
  return {
    sent,
    draft,
    board,
    acts,
    derived,
    context: { channel, acts, draft, board, derived, delivery },
  };
};

describe("what a card's Answer sends (ask-lifecycle, task 6.4; FR-7, FR-22)", () => {
  test("in immediate delivery: the answer view message with the whole answer, held until settled", async () => {
    const { sent, draft, board, acts, context } = setUp();
    draft.set("payment", ["Stripe"]);
    board.edit("payment", 1, () => ({ rev: 1, optionNotes: { Adyen: "Costly." }, note: "Go." }));
    answer(payment, context);
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "payment",
        rev: 1,
        choice: ["Stripe"],
        optionNotes: { Adyen: "Costly." },
        note: "Go.",
        when: expect.stringMatching(/Z$/),
      },
    ]);
    await Bun.sleep(0);
    expect(acts.of("payment")).toMatchObject({ actionId: ACTION_ID, outcome: "sent" });
  });

  test("with only the open prompt's text in immediate delivery: a note act alone", () => {
    const { sent, board, context } = setUp();
    board.edit("database", 1, () => ({ rev: 1, note: "Ask ops." }));
    answer(database, context);
    expect(sent).toEqual([
      {
        type: "act",
        acts: [
          {
            type: "note",
            itemId: "database",
            rev: 1,
            note: "Ask ops.",
            when: expect.any(String),
          },
        ],
      },
    ]);
  });

  test("with only the open prompt's text in submitted delivery: the note is held for Submit, and pressed again it is not (AD-20)", () => {
    const { sent, board, context } = setUp("submitted");
    board.edit("database", 1, () => ({ rev: 1, note: "Ask ops." }));
    answer(database, context);
    expect(board.work("database")?.held).toEqual({ act: "note", order: 0 });
    answer(database, context);
    expect(board.work("database")?.held).toBeUndefined();
    expect(board.work("database")?.note).toBe("Ask ops.");
    expect(sent).toEqual([]);
  });

  test("work kept on an earlier revision answers that revision (FR-6)", () => {
    const { sent, draft, board, context } = setUp();
    draft.set("payment", ["Adyen"]);
    board.edit("payment", 1, (work) => work);
    answer({ ...payment, rev: 2 }, context);
    expect(sent).toEqual([expect.objectContaining({ type: "answer", rev: 1, choice: ["Adyen"] })]);
  });

  test("with nothing to send, nothing goes", () => {
    const { sent, context } = setUp();
    answer(database, context);
    expect(sent).toEqual([]);
  });

  test("in submitted delivery: marks the answer ready, in the order given; pressed again, unmarks it", () => {
    const { sent, draft, board, context } = setUp("submitted");
    draft.set("payment", ["Stripe"]);
    draft.set("region", ["EU"]);
    answer(payment, context);
    answer(region, context);
    expect(board.work("payment")?.held).toEqual({ act: "answer", order: 0 });
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 1 });
    expect(nextHeldOrder(board)).toBe(2);
    answer(payment, context);
    expect(board.work("payment")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("Accept recommended (FR-3, AD-10; L186)", () => {
  test("selects the recommended option, clears Other on a single choice, and sends at once", () => {
    const { sent, draft, board, context } = setUp();
    const rollout = (lifecycleBoardDocument.items[1] as unknown as ViewArea).props
      .items[0] as ViewQuestion;
    draft.set("rollout", ["All at once"]);
    board.edit("rollout", 1, () => ({ rev: 1, other: "Canary" }));
    acceptRecommended(rollout, context);
    expect(draft.valueOf("rollout")).toEqual(["Behind a flag"]);
    expect(board.work("rollout")?.other).toBeUndefined();
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "rollout",
        rev: 1,
        choice: ["Behind a flag"],
        when: expect.any(String),
      },
    ]);
  });

  test("on a multiple choice it joins the user's choices; in submitted delivery it marks the answer ready", () => {
    const { sent, draft, board, context } = setUp("submitted");
    draft.set("region", ["US"]);
    acceptRecommended(region, context);
    expect(draft.valueOf("region")).toEqual(["EU", "US"]);
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 0 });
    acceptRecommended(region, context);
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 0 });
    expect(sent).toEqual([]);
  });

  test("a question without a recommendation has none to accept", () => {
    const { sent, context } = setUp();
    expect(recommendedOf(payment)).toBeUndefined();
    acceptRecommended(payment, context);
    expect(sent).toEqual([]);
  });
});

const actsOf = (sent: readonly ViewMessage[]) =>
  sent.map((message) => (message.type === "act" ? message.acts : message));

describe("Postpone (FR-4; task 6.5)", () => {
  test("in immediate delivery an open question's postpone goes at once, and its undo sends a reopen", () => {
    const { sent, context } = setUp();
    postpone(payment, "open", context);
    postpone(payment, "postponed", context);
    expect(actsOf(sent)).toEqual([
      [{ type: "postpone", itemId: "payment", rev: 1 }],
      [{ type: "reopen", itemId: "payment" }],
    ]);
  });

  test("in submitted delivery it is held, an undo of a held one only changes the draft, and the undo of a sent one is held as a reopen", () => {
    const { sent, board, context } = setUp("submitted");
    postpone(payment, "open", context);
    expect(board.work("payment")?.held).toEqual({ act: "postpone", order: 0 });
    postpone(payment, "open", context);
    expect(board.work("payment")?.held).toBeUndefined();
    postpone(region, "postponed", context);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    postpone(region, "postponed", context);
    expect(board.work("region")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("Decline (FR-4; task 6.5)", () => {
  test("in immediate delivery it goes at once with the open prompt's text as the reason; its undo sends a reopen", () => {
    const { sent, board, context } = setUp();
    board.edit("payment", 1, () => ({ rev: 1, note: "Not ours to decide." }));
    decline(payment, "open", context);
    decline(region, "declined", context);
    expect(actsOf(sent)).toEqual([
      [
        {
          type: "decline",
          itemId: "payment",
          rev: 1,
          note: "Not ours to decide.",
          when: expect.stringMatching(/Z$/),
        },
      ],
      [{ type: "reopen", itemId: "region" }],
    ]);
  });

  test("without a reason the decline carries none", () => {
    const { sent, context } = setUp();
    decline(payment, "postponed", context);
    expect(actsOf(sent)).toEqual([
      [{ type: "decline", itemId: "payment", rev: 1, when: expect.any(String) }],
    ]);
  });

  test("in submitted delivery it is held and undone like Postpone; nothing is sent", () => {
    const { sent, board, context } = setUp("submitted");
    board.edit("payment", 1, () => ({ rev: 1, note: "Not ours." }));
    decline(payment, "open", context);
    expect(board.work("payment")?.held).toEqual({ act: "decline", order: 0 });
    decline(payment, "open", context);
    expect(board.work("payment")).toEqual({ rev: 1, note: "Not ours." });
    decline(region, "declined", context);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    decline(region, "declined", context);
    expect(board.work("region")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("on a sent postpone whose undo is held, it holds a decline over the undo, and chosen again gives the undo back (AD-10, AD-20)", () => {
    const { sent, board, context } = setUp("submitted");
    postpone(region, "postponed", context);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    decline(region, "postponed", context);
    expect(board.work("region")?.held?.act).toBe("decline");
    expect(board.work("region")?.undo).toEqual({ act: "reopen", order: 0 });
    decline(region, "postponed", context);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    expect(board.work("region")?.undo).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("work held over the undo of a sent postpone or decline (AD-20; task 6.6)", () => {
  test("Answer holds the answer over the undo; pressed again, or once its choice changes, the undo is held again", () => {
    const { sent, draft, board, context } = setUp("submitted");
    connectDrafts(lifecycleBoardDocument as never, draft, board);
    postpone(region, "postponed", context);
    draft.set("region", ["EU"]);
    answer(region, context);
    expect(board.work("region")?.held).toEqual({ act: "answer", order: 1 });
    expect(board.work("region")?.undo).toEqual({ act: "reopen", order: 0 });
    answer(region, context);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    answer(region, context);
    draft.set("region", ["US"]);
    expect(board.work("region")?.held).toEqual({ act: "reopen", order: 0 });
    expect(board.work("region")?.undo).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("a note held over the undo keeps it beneath; Postpone pressed again takes back only the undo", () => {
    const { sent, board, context } = setUp("submitted");
    postpone(payment, "postponed", context);
    board.edit("payment", 1, (work) => ({ ...work, note: "Ask ops." }));
    answer(payment, context);
    expect(board.work("payment")).toEqual({
      rev: 1,
      note: "Ask ops.",
      held: { act: "note", order: 1 },
      undo: { act: "reopen", order: 0 },
    });
    postpone(payment, "postponed", context);
    expect(board.work("payment")).toEqual({
      rev: 1,
      note: "Ask ops.",
      held: { act: "note", order: 1 },
    });
    expect(sent).toEqual([]);
  });

  test("Accept recommended over the undo keeps it beneath the answer", () => {
    const { board, context } = setUp("submitted");
    postpone(region, "postponed", context);
    acceptRecommended(region, context);
    expect(board.work("region")?.held?.act).toBe("answer");
    expect(board.work("region")?.undo).toEqual({ act: "reopen", order: 0 });
  });

  test("a newly held act comes after an undo held beneath another act", () => {
    const { board } = setUp("submitted");
    board.edit("region", 1, () => ({ rev: 1, undo: { act: "reopen", order: 4 } }));
    expect(nextHeldOrder(board)).toBe(5);
  });
});

describe("a held act on a board answering at once: the single-question board left by deletes (AD-20)", () => {
  // Held in submitted delivery, before the agent's deletes left one question on the board.
  const holding = (questionId: string, act: "postpone" | "decline" | "reopen") => {
    const set = setUp("immediate");
    set.board.edit(questionId, 1, () => ({ rev: 1, held: { act, order: 0 } }));
    return set;
  };

  test("Decline chosen again on a held decline takes it back and sends nothing", () => {
    const { sent, board, context } = holding("payment", "decline");
    decline(payment, "open", context);
    expect(board.work("payment")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("Postpone pressed again on a held postpone takes it back and sends nothing", () => {
    const { sent, board, context } = holding("payment", "postpone");
    postpone(payment, "open", context);
    expect(board.work("payment")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("the held undo of a sent postpone or decline is taken back by its control, and nothing is sent", () => {
    const postponed = holding("payment", "reopen");
    postpone(payment, "postponed", postponed.context);
    expect(postponed.board.work("payment")?.held).toBeUndefined();
    const declined = holding("payment", "reopen");
    decline(payment, "declined", declined.context);
    expect(declined.board.work("payment")?.held).toBeUndefined();
    expect([...postponed.sent, ...declined.sent]).toEqual([]);
  });

  test("with nothing of its own held, each control sends at once", () => {
    const { sent, context } = holding("region", "decline");
    decline(payment, "open", context);
    postpone(payment, "open", context);
    expect(actsOf(sent)).toEqual([
      [expect.objectContaining({ type: "decline", itemId: "payment" })],
      [{ type: "postpone", itemId: "payment", rev: 1 }],
    ]);
  });
});

describe("Explain and the follow-up composer (FR-10; task 6.5)", () => {
  test("Explain sends its follow-up at once, in submitted delivery too", () => {
    const { sent, context } = setUp("submitted");
    explain(payment, context);
    expect(EXPLAIN).toBe("Why are you asking, and what changes with each option?");
    expect(actsOf(sent)).toEqual([
      [
        {
          type: "follow-up",
          itemId: "payment",
          rev: 1,
          text: EXPLAIN,
          when: expect.stringMatching(/Z$/),
        },
      ],
    ]);
  });

  test("Send sends the composer's text at once in either mode; an empty composer sends nothing", () => {
    for (const delivery of ["immediate", "submitted"] as const) {
      const { sent, board, context } = setUp(delivery);
      sendFollowUp(payment, context);
      board.edit("payment", 1, () => ({ rev: 1, composer: "Does Adyen\ncover iDEAL?" }));
      sendFollowUp(payment, context);
      expect(actsOf(sent)).toEqual([
        [
          {
            type: "follow-up",
            itemId: "payment",
            rev: 1,
            text: "Does Adyen\ncover iDEAL?",
            when: expect.any(String),
          },
        ],
      ]);
    }
  });
});

describe("the agent-change choices (FR-6; task 6.7)", () => {
  const changed = { ...payment, rev: 2 } as ViewQuestion;

  test("Keep mine sends an ignore keeping the work's revision at once, and keeps the work", () => {
    const { sent, draft, board, context } = setUp("submitted");
    draft.set("payment", ["Adyen"]);
    board.edit("payment", 1, (work) => work);
    keepMine(changed, context);
    expect(actsOf(sent)).toEqual([
      [{ type: "edit-choice", itemId: "payment", rev: 2, edit: "ignore", keptRev: 1 }],
    ]);
    expect(board.work("payment")?.rev).toBe(1);
    expect(draft.valueOf("payment")).toEqual(["Adyen"]);
  });

  test("Reload, losing my work sends a reload at once and drops the question's draft", () => {
    const { sent, draft, board, context } = setUp("submitted");
    draft.set("payment", ["Adyen"]);
    board.edit("payment", 1, (work) => ({
      ...work,
      note: "Mine.",
      held: { act: "answer", order: 0 },
    }));
    reloadQuestion(changed, context);
    expect(actsOf(sent)).toEqual([
      [{ type: "edit-choice", itemId: "payment", rev: 2, edit: "reload" }],
    ]);
    expect(board.work("payment")?.held).toBeUndefined();
    expect(draft.valueOf("payment")).toBeUndefined();
  });

  test("with no work there is nothing to keep", () => {
    const { sent, context } = setUp();
    keepMine(changed, context);
    expect(sent).toEqual([]);
  });
});

describe("filling the draft from an answer (Start from my previous answer; a revision's start)", () => {
  test("the choice, the Other text, the option notes and the note, on what the revision offers; nothing is sent", () => {
    const { sent, draft, board, context } = setUp();
    const rollout = {
      ...(lifecycleBoardDocument.items[1] as unknown as ViewArea).props.items[0],
      rev: 3,
    } as ViewQuestion;
    fillFrom(
      rollout,
      {
        choice: ["All at once", "Gone"],
        other: "Canary",
        optionNotes: { "All at once": "Tuesday.", Gone: "x" },
        note: "Before the freeze.",
      },
      context,
    );
    expect(draft.valueOf("rollout")).toEqual(["All at once"]);
    expect(board.work("rollout")).toEqual({
      rev: 3,
      optionNotes: { "All at once": "Tuesday." },
      note: "Before the freeze.",
    });
    board.edit("payment", 1, () => ({ rev: 1, note: "old", composer: "Why?" }));
    fillFrom(payment, { other: "Mollie" }, context);
    expect(board.work("payment")).toEqual({ rev: 1, other: "Mollie", composer: "Why?" });
    expect(draft.valueOf("payment")).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("the derived values an answer carries (gantt-widget design decision 10; AD-20, FR-12; cross-review M3)", () => {
  // The Gantt question, and a test-only `probe` widget item beside its Gantt (design decision 12).
  const [schedule] = ganttBoardDocument.items;
  const [release] = schedule.props.items;
  const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
  const both: ViewQuestion = {
    ...schedule,
    props: { ...schedule.props, items: [release, sketch] },
  };
  const finish = { "release.finish": "2026-12-16", "release.criticalPath": ["reporting"] };
  const reports = new Map<string, Record<string, unknown>>([
    ["release", finish],
    ["sketch", { "sketch.area": 16 }],
  ]);
  const reported = (itemId: string) => reports.get(itemId);

  test("those of the items the answer carries a value for, as they last reported them", () => {
    expect(withDerived({ values: { release: ganttEditedValue } }, reported)).toEqual({
      values: { release: ganttEditedValue },
      derived: finish,
    });
  });

  test("each carried item's, in the order of the answer's values, which is the question's", () => {
    const { derived } = withDerived(
      { values: { release: ganttEditedValue, sketch: { size: 4 } } },
      reported,
    );
    expect(Object.keys(derived ?? {})).toEqual([
      "release.finish",
      "release.criticalPath",
      "sketch.area",
    ]);
  });

  test("none for an untouched Gantt, and no field when no carried item reported any", () => {
    expect(withDerived({ values: { sketch: { size: 4 } } }, reported)).toEqual({
      values: { sketch: { size: 4 } },
      derived: { "sketch.area": 16 },
    });
    const quiet = withDerived({ values: { sketch: { size: 4 } } }, () => undefined);
    expect(quiet).toEqual({ values: { sketch: { size: 4 } } });
    expect(Object.hasOwn(quiet, "derived")).toBe(false);
    expect(withDerived({ choice: ["SQLite"] }, reported)).toEqual({ choice: ["SQLite"] });
    expect(withDerived({}, reported)).toEqual({});
  });

  test("Answer sends, for a question whose item reported derived values and has a value, those values beside it", () => {
    const { sent, draft, derived, context } = setUp();
    derived.report("release", finish);
    derived.report("sketch", { "sketch.area": 16 });
    draft.set("release", ganttEditedValue);
    answer(both, context);
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "schedule-review",
        rev: 1,
        values: { release: ganttEditedValue },
        derived: finish,
        when: expect.stringMatching(/Z$/),
      },
    ]);
  });

  test("an answer with no widget value carries none, though its Gantt reported some (design decision 10: only the items in `values`)", () => {
    // The plain question with the Gantt beside its options.
    const withGantt: ViewQuestion = {
      ...database,
      props: { ...database.props, items: [release] },
    };
    const { sent, draft, derived, context } = setUp();
    derived.report("release", finish);
    draft.set("database", ["SQLite"]);
    answer(withGantt, context);
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "database",
        rev: 1,
        choice: ["SQLite"],
        when: expect.stringMatching(/Z$/),
      },
    ]);
  });
});
