import { describe, expect, test } from "bun:test";
import { type LifecycleQuestionStatus, widgetResultFits } from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttEditedValue,
  lifecycleBoardDocument,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { hasUnsentWork } from "../board-page/unsent-work.ts";
import type { ViewArea, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { connectDrafts, createBoardDraft, type Delivery, draftRecordOf } from "./board-draft.ts";
import {
  acceptRecommended,
  answer,
  answerNeedsReason,
  decline,
  EXPLAIN,
  explain,
  fillFrom,
  keepMine,
  nextHeldOrder,
  postpone,
  pressAnswer,
  recommendedOf,
  reloadQuestion,
  selectRecommendedOption,
  sendFollowUp,
  withDerived,
} from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { settle } from "./revision-confirm.ts";

const [database] = plainChoiceBoardDocument.items;
const [scope] = lifecycleBoardDocument.items as unknown as readonly [ViewArea];
const [region, payment] = scope.props.items as unknown as readonly [ViewQuestion, ViewQuestion];
const ACTION_ID = "AAAAAAAAAAAAAAAAAAAAAA";

// What the test-only widget types' chunks would register: each takes any result. The check of a
// result's type is the chunks' and the contract's, tested there and under "a result the type
// refuses" below.
const accepting = () => ({ fits: () => true });

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
  const results = createDraftStore();
  const board = createBoardDraft(delivery);
  const acts = createAnswerActs();
  const derived = createDerivedStore();
  return {
    sent,
    draft,
    results,
    board,
    acts,
    derived,
    context: { channel, acts, draft, results, board, derived, delivery, facts: accepting },
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

  const ids = ["release", "sketch"];

  test("those of every item of the question, changed or not, as they last reported them", () => {
    expect(withDerived({ values: { release: ganttEditedValue } }, reported, ids)).toEqual({
      values: { release: ganttEditedValue },
      derived: { ...finish, "sketch.area": 16 },
    });
    expect(withDerived({ values: { sketch: { size: 4 } } }, reported, ids)).toEqual({
      values: { sketch: { size: 4 } },
      derived: { ...finish, "sketch.area": 16 },
    });
  });

  test("beside a choice or Other text with no value, in the order of the question's items", () => {
    const { derived } = withDerived({ choice: ["SQLite"] }, reported, ids);
    expect(Object.keys(derived ?? {})).toEqual([
      "release.finish",
      "release.criticalPath",
      "sketch.area",
    ]);
    expect(withDerived({ other: "Else" }, reported, ["sketch"])).toEqual({
      other: "Else",
      derived: { "sketch.area": 16 },
    });
  });

  test("never alone: a note or nothing carries none; no field when no item reported any", () => {
    expect(withDerived({ note: "x" }, reported, ids)).toEqual({ note: "x" });
    expect(withDerived({}, reported, ids)).toEqual({});
    const quiet = withDerived({ values: { sketch: { size: 4 } } }, () => undefined, ids);
    expect(quiet).toEqual({ values: { sketch: { size: 4 } } });
    expect(Object.hasOwn(quiet, "derived")).toBe(false);
    expect(withDerived({ choice: ["SQLite"] }, reported, [])).toEqual({ choice: ["SQLite"] });
  });

  test("Answer sends the derived values of every computing item beside the one value it carries", () => {
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
        derived: { ...finish, "sketch.area": 16 },
        when: expect.stringMatching(/Z$/),
      },
    ]);
  });

  test("an option picked beside an untouched Gantt carries the Gantt's derived values and no values", () => {
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
        derived: finish,
        when: expect.stringMatching(/Z$/),
      },
    ]);
  });

  test("a report of another question's item stays out", () => {
    const { sent, draft, derived, context } = setUp();
    derived.report("sketch", { "sketch.area": 16 });
    draft.set("database", ["SQLite"]);
    answer(database, context);
    expect(Object.hasOwn(sent[0] ?? {}, "derived")).toBe(false);
  });
});

describe("the results an answer carries (widget-registry, design decision 9; AD-20)", () => {
  const sketch: WidgetItem = { type: "probe", id: "sketch", props: { size: 3 } };
  const asked: ViewQuestion = {
    ...database,
    props: { text: "Which one?", items: [sketch] },
  };
  const result = { pick: "a" };

  test("Answer sends a result alone as an answer with results and no values", () => {
    const { sent, results, context } = setUp();
    results.set("sketch", result);
    answer(asked, context);
    expect(sent).toEqual([
      {
        type: "answer",
        itemId: "database",
        rev: 1,
        results: { sketch: result },
        when: expect.stringMatching(/Z$/),
      },
    ]);
    expect(Object.hasOwn(sent[0] ?? {}, "values")).toBe(false);
  });

  test("the derived values of the question's items go beside a result, which makes the answer", () => {
    expect(
      withDerived({ results: { sketch: result } }, () => ({ "sketch.n": 1 }), ["sketch"]),
    ).toEqual({ results: { sketch: result }, derived: { "sketch.n": 1 } });
  });

  test("in submitted delivery the result is held for Submit, not sent", () => {
    const { sent, results, board, context } = setUp("submitted");
    results.set("sketch", result);
    answer(asked, context);
    expect(sent).toEqual([]);
    expect(board.work("database")?.held).toEqual({ act: "answer", order: 0 });
  });

  test("nothing held, nothing sent: no result, no answer", () => {
    const { sent, context } = setUp();
    answer(asked, context);
    expect(sent).toEqual([]);
  });

  test("Keep mine keeps a held result, and Reload, losing my work drops it", () => {
    const changed = { ...asked, rev: 2 } as ViewQuestion;
    const kept = setUp("submitted");
    kept.results.set("sketch", result);
    kept.board.edit("database", 1, (work) => work);
    keepMine(changed, kept.context);
    expect(kept.results.valueOf("sketch")).toBe(result);
    const reloaded = setUp("submitted");
    reloaded.results.set("sketch", result);
    reloaded.board.edit("database", 1, (work) => work);
    reloadQuestion(changed, reloaded.context);
    expect(reloaded.results.valueOf("sketch")).toBeUndefined();
    expect(reloaded.board.work("database")).toBeUndefined();
  });
});

describe("a reason the answer requires (approval-scale-ranking, design decision 6; NFR-10)", () => {
  // A test-only `verdict` type: its result `{decision: "revise"}` requires a reason.
  const verdict: WidgetItem = { type: "verdict", id: "verdict", props: {} };
  const asked: ViewQuestion = { ...database, props: { text: "Which one?", items: [verdict] } };
  const pair = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;
  const facts = (type: string) =>
    type === "verdict"
      ? {
          reason: (result: unknown) =>
            (result as { decision?: string }).decision === "revise" ? pair : undefined,
        }
      : undefined;
  const revise = { decision: "revise" };
  const accept = { decision: "accept" };

  const held = (delivery: Delivery, result: unknown, note?: string) => {
    const set = setUp(delivery);
    set.results.set("verdict", result);
    if (note !== undefined) set.board.edit("database", 1, () => ({ rev: 1, note }));
    return { ...set, context: { ...set.context, facts } };
  };

  test.each(["immediate", "submitted"] as const)(
    "in %s delivery an empty note sends nothing, marks nothing and asks for the error",
    (delivery) => {
      const { sent, board, context } = held(delivery, revise);
      expect(answer(asked, context)).toBe("needs-reason");
      expect(sent).toEqual([]);
      expect(board.work("database")?.held).toBeUndefined();
    },
  );

  test.each(["immediate", "submitted"] as const)(
    "in %s delivery a note of white space only is no reason",
    (delivery) => {
      for (const note of ["   ", "\n\t", "\u00a0\u2003"]) {
        const { sent, board, context } = held(delivery, revise, note);
        expect(answer(asked, context)).toBe("needs-reason");
        expect(sent).toEqual([]);
        expect(board.work("database")?.held).toBeUndefined();
      }
    },
  );

  test("a note with text sends the answer carrying it, in immediate delivery", () => {
    const { sent, context } = held("immediate", revise, "Cheaper.");
    expect(answer(asked, context)).toBeUndefined();
    expect(sent).toEqual([
      expect.objectContaining({
        type: "answer",
        results: { verdict: revise },
        note: "Cheaper.",
      }),
    ]);
  });

  test("a note with text marks the answer ready, in submitted delivery", () => {
    const { sent, board, context } = held("submitted", revise, "Cheaper.");
    expect(answer(asked, context)).toBeUndefined();
    expect(board.work("database")?.held).toEqual({ act: "answer", order: 0 });
    expect(sent).toEqual([]);
  });

  test("a result that requires no reason sends with no note", () => {
    const { sent, context } = held("immediate", accept);
    expect(answer(asked, context)).toBeUndefined();
    expect(sent).toEqual([
      expect.objectContaining({ type: "answer", results: { verdict: accept } }),
    ]);
  });

  test("with no facts for the type, nothing is required", () => {
    const { sent, context } = held("immediate", revise);
    expect(answer(asked, { ...context, facts: () => undefined })).toBeUndefined();
    expect(sent).toHaveLength(1);
  });

  test("pressed again on an answer already marked ready, it unmarks, as it does without a reason", () => {
    const { board, context } = held("submitted", revise, "Cheaper.");
    answer(asked, context);
    expect(board.work("database")?.held?.act).toBe("answer");
    answer(asked, context);
    expect(board.work("database")?.held).toBeUndefined();
  });

  test("unmarking is never refused: a marked answer whose note holds no reason unmarks, sends nothing", () => {
    const { sent, board, context } = held("submitted", revise);
    // State built directly: the answer was marked ready, then the note lost its text.
    board.edit("database", 1, (work) => ({ ...work, rev: 1, held: { act: "answer", order: 0 } }));
    expect(answerNeedsReason(asked, context)).toBe(false);
    expect(answer(asked, context)).toBeUndefined();
    expect(board.work("database")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("Accept recommended answers through the same gate", () => {
    const recommended: ViewQuestion = {
      ...asked,
      props: {
        ...asked.props,
        options: [
          { label: "A", description: "a", recommended: true },
          { label: "B", description: "b" },
        ],
      },
    } as ViewQuestion;
    const { sent, context } = held("immediate", revise);
    expect(acceptRecommended(recommended, context)).toBe("needs-reason");
    expect(sent).toEqual([]);
  });

  test("answerNeedsReason is the check Answer makes, without sending anything", () => {
    const empty = held("immediate", revise);
    expect(answerNeedsReason(asked, empty.context)).toBe(true);
    const written = held("immediate", revise, "Cheaper.");
    expect(answerNeedsReason(asked, written.context)).toBe(false);
    expect(answerNeedsReason(asked, held("immediate", accept).context)).toBe(false);
    expect(empty.sent).toEqual([]);
  });

  test("Decline needs no reason", () => {
    const { sent, context } = held("immediate", revise);
    decline(asked, undefined, context);
    expect(sent).toEqual([expect.objectContaining({ type: "act" })]);
  });
});

describe("Accept recommended takes the path of Answer (approval-scale-ranking, design decision 6; F-63, AD-10)", () => {
  // A test-only `verdict` type: `{decision: "revise"}` requires a reason, and the type asks first
  // when its latest answer has been received.
  const pair = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;
  const facts = (type: string) =>
    type === "verdict"
      ? {
          confirmsRevision: true as const,
          reason: (result: unknown) =>
            (result as { decision?: string }).decision === "revise" ? pair : undefined,
        }
      : undefined;
  const verdict: WidgetItem = { type: "verdict", id: "verdict", props: {} };
  const recommended: ViewQuestion = {
    ...database,
    props: {
      text: "Which one?",
      options: [
        { label: "A", description: "a", recommended: true },
        { label: "B", description: "b" },
      ],
      items: [verdict],
    },
  } as ViewQuestion;
  const statusOf = (receipt: "queued" | "sent" | "delivered"): LifecycleQuestionStatus =>
    ({
      itemId: "database",
      rev: 1,
      state: "answered",
      answer: { when: "2026-11-07T10:00:00Z", receipt },
    }) as unknown as LifecycleQuestionStatus;
  const accept = (
    delivery: Delivery,
    receipt: "queued" | "sent" | "delivered",
    result: unknown,
    note?: string,
  ) => {
    const set = setUp(delivery);
    set.results.set("verdict", result);
    if (note !== undefined) set.board.edit("database", 1, () => ({ rev: 1, note }));
    const context = { ...set.context, facts };
    const outcomes: unknown[] = [];
    // What the card does: the selection, then Answer's path.
    selectRecommendedOption(recommended, context);
    const pressed = pressAnswer(recommended, context, statusOf(receipt), (o) => outcomes.push(o));
    return { ...set, context, pressed, outcomes };
  };
  const revise = { decision: "revise" };
  const reject = { decision: "reject" };

  test("on a delivered verdict it selects the option and sends and marks nothing until confirmed", () => {
    const { sent, draft, board, pressed } = accept("immediate", "delivered", reject);
    expect(draft.valueOf("database")).toEqual(["A"]);
    expect(pressed.kind).toBe("waiting");
    expect(sent).toEqual([]);
    expect(board.work("database")?.held).toBeUndefined();
  });

  test("Cancel leaves the option selected and sends nothing, and the act cannot run afterwards", () => {
    const { sent, draft, pressed } = accept("immediate", "delivered", reject);
    if (pressed.kind !== "waiting") throw new Error(pressed.kind);
    settle(pressed.waiting, false);
    settle(pressed.waiting, true);
    expect(draft.valueOf("database")).toEqual(["A"]);
    expect(sent).toEqual([]);
  });

  test("confirming sends one answer in immediate delivery", () => {
    const { sent, pressed, outcomes } = accept("immediate", "delivered", reject);
    if (pressed.kind !== "waiting") throw new Error(pressed.kind);
    settle(pressed.waiting, true);
    expect(sent).toEqual([
      expect.objectContaining({ type: "answer", choice: ["A"], results: { verdict: reject } }),
    ]);
    expect(outcomes).toEqual([undefined]);
  });

  test("confirming marks the answer ready in submitted delivery, and sends nothing", () => {
    const { sent, board, pressed } = accept("submitted", "delivered", reject);
    if (pressed.kind !== "waiting") throw new Error(pressed.kind);
    expect(board.work("database")?.held).toBeUndefined();
    settle(pressed.waiting, true);
    expect(board.work("database")?.held).toEqual({ act: "answer", order: 0 });
    expect(sent).toEqual([]);
  });

  test("a missing reason returns needs-reason before any confirmation, and sends and marks nothing", () => {
    for (const delivery of ["immediate", "submitted"] as const) {
      const { sent, draft, board, pressed } = accept(delivery, "delivered", revise);
      expect(pressed.kind).toBe("needs-reason");
      expect(draft.valueOf("database")).toEqual(["A"]);
      expect(sent).toEqual([]);
      expect(board.work("database")?.held).toBeUndefined();
    }
  });

  test("a note with a reason passes the check and then asks", () => {
    expect(accept("immediate", "delivered", revise, "Cheaper.").pressed.kind).toBe("waiting");
  });

  test.each(["queued", "sent"] as const)(
    "with a %s receipt it acts at once, as before",
    (receipt) => {
      const { sent, pressed } = accept("immediate", receipt, reject);
      expect(pressed.kind).toBe("done");
      expect(sent).toEqual([
        expect.objectContaining({ type: "answer", choice: ["A"], results: { verdict: reject } }),
      ]);
    },
  );

  test("selecting alone sends nothing and unmarks a marked answer, as the selection changes it", () => {
    const { sent, board, context } = accept("submitted", "sent", reject);
    expect(board.work("database")?.held).toEqual({ act: "answer", order: 0 });
    selectRecommendedOption(recommended, context);
    expect(board.work("database")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("a held answer pressed again where the press sends (approval-scale-ranking, task 4b.14; F-63, AD-10)", () => {
  // The board draft is in submitted delivery and holds a marked answer, while the card answers at
  // once: the single-question board an agent's deletes left, or "Send and switch" whose command
  // was refused. A press of "Answer" there sends, so the exemptions of a press that only takes
  // the mark back do not apply.
  const pair = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;
  const facts = (type: string) =>
    type === "verdict"
      ? {
          confirmsRevision: true as const,
          reason: (result: unknown) =>
            (result as { decision?: string }).decision === "revise" ? pair : undefined,
        }
      : undefined;
  const verdict: WidgetItem = { type: "verdict", id: "verdict", props: {} };
  const asked: ViewQuestion = { ...database, props: { text: "Which one?", items: [verdict] } };
  const delivered = {
    itemId: "database",
    rev: 1,
    state: "answered",
    answer: { when: "2026-11-07T10:00:00Z", receipt: "delivered" },
  } as unknown as LifecycleQuestionStatus;
  const reject = { decision: "reject" };
  const revise = { decision: "revise" };

  const marked = (cardDelivery: Delivery, result: unknown, note?: string) => {
    const set = setUp("submitted");
    set.results.set("verdict", result);
    set.board.edit("database", 1, () => ({
      rev: 1,
      ...(note === undefined ? {} : { note }),
      held: { act: "answer", order: 0 },
    }));
    const outcomes: unknown[] = [];
    const context = { ...set.context, delivery: cardDelivery, facts };
    const pressed = pressAnswer(asked, context, delivered, (o) => outcomes.push(o));
    return { ...set, context, pressed, outcomes };
  };

  test("in immediate delivery a marked answer on a delivered verdict asks first and sends nothing", () => {
    const { sent, pressed, board } = marked("immediate", reject);
    expect(pressed.kind).toBe("waiting");
    expect(sent).toEqual([]);
    expect(board.work("database")?.held?.act).toBe("answer");
  });

  test("confirming then sends the answer", () => {
    const { sent, pressed } = marked("immediate", reject);
    if (pressed.kind !== "waiting") throw new Error(pressed.kind);
    settle(pressed.waiting, true);
    expect(sent).toEqual([
      expect.objectContaining({ type: "answer", results: { verdict: reject } }),
    ]);
  });

  test("in immediate delivery a marked answer lacking its reason is refused, and nothing is sent", () => {
    const set = marked("immediate", revise, "  ");
    expect(set.pressed.kind).toBe("needs-reason");
    expect(set.sent).toEqual([]);
    expect(answerNeedsReason(asked, set.context)).toBe(true);
  });

  test("in submitted delivery the press still only takes the mark back, with no confirmation", () => {
    const { sent, pressed, board } = marked("submitted", reject);
    expect(pressed.kind).toBe("done");
    expect(board.work("database")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });

  test("in submitted delivery unmarking a marked answer lacking its reason is never refused", () => {
    const { sent, pressed, board } = marked("submitted", revise, "  ");
    expect(pressed.kind).toBe("done");
    expect(board.work("database")?.held).toBeUndefined();
    expect(sent).toEqual([]);
  });
});

describe("a revision keeps the widgets' results (approval-scale-ranking, design decision 6; AD-20)", () => {
  const verdict: WidgetItem = { type: "verdict", id: "verdict", props: {} };
  const second: WidgetItem = { type: "verdict", id: "second", props: {} };
  const asked: ViewQuestion = { ...database, props: { text: "Which one?", items: [verdict] } };
  const both: ViewQuestion = {
    ...database,
    props: { text: "Which one?", items: [verdict, second] },
  };
  const rejected = { decision: "reject" };
  const picked = { decision: "approve" };

  test("filling from an answer seeds its results for the items the revision holds", () => {
    const { sent, results, context } = setUp();
    fillFrom(asked, { results: { verdict: rejected }, note: "No." }, context);
    expect(results.valueOf("verdict")).toEqual(rejected);
    expect(sent).toEqual([]);
  });

  test("an item the current revision no longer holds gets none", () => {
    const { results, context } = setUp();
    fillFrom(asked, { results: { verdict: rejected, gone: { pick: 1 } } }, context);
    expect(results.record().has("gone")).toBe(false);
    expect([...results.record().keys()]).toEqual(["verdict"]);
  });

  test("the question's own ID is never a result's key", () => {
    const { results, context } = setUp();
    fillFrom(asked, { results: { database: { pick: 1 } } }, context);
    expect(results.record().size).toBe(0);
  });

  test("an answer given without results seeds none, and drops the ones held in its place", () => {
    const { results, context } = setUp();
    fillFrom(asked, { choice: ["SQLite"] }, context);
    expect(results.record().size).toBe(0);
    results.set("verdict", picked);
    fillFrom(asked, { choice: ["SQLite"] }, context);
    expect(results.record().size).toBe(0);
  });

  test("each item takes its own result: one the answer lacks is cleared, none leaks across items", () => {
    const { results, context } = setUp();
    results.set("second", picked);
    fillFrom(both, { results: { verdict: rejected } }, context);
    expect(results.valueOf("verdict")).toEqual(rejected);
    expect(results.record().has("second")).toBe(false);
  });

  test("results are read as own properties of the answer's: a prototype key seeds nothing", () => {
    const { results, context } = setUp();
    const proto = { results: JSON.parse('{"constructor": 1, "__proto__": 2}') };
    const constructorItem: WidgetItem = { type: "verdict", id: "constructor", props: {} };
    const question = {
      ...database,
      props: { text: "Q?", items: [constructorItem] },
    } as ViewQuestion;
    fillFrom(question, proto, context);
    expect(results.valueOf("constructor")).toBe(1);
    expect(Object.getPrototypeOf(results.record())).toBe(Map.prototype);
  });

  // Items as the revision holds them: the earlier answer's results are checked against these.
  const ranking = (...ids: string[]): WidgetItem => ({
    type: "ranking",
    id: "priorities",
    props: { items: ids.map((id) => ({ id, label: id })) },
  });
  const scale = (props: object): WidgetItem => ({ type: "scale", id: "share", props });
  const questionOf = (...items: WidgetItem[]): ViewQuestion => ({
    ...database,
    props: { text: "Which one?", items },
  });
  const order = { order: ["cost", "speed", "comfort"] };
  // What the Scale and Ranking chunks register: each type's own check, through the contract's.
  const facts = (type: string) =>
    type === "scale" || type === "ranking" || type === "approval"
      ? {
          fits: (result: unknown, props: unknown) =>
            widgetResultFits({ type, id: "x" }, result, props),
        }
      : accepting();
  const setUpFits = () => {
    const set = setUp();
    return { ...set, context: { ...set.context, facts } };
  };

  test("a Ranking whose revision added or dropped an element is seeded no order", () => {
    for (const ids of [
      ["speed", "cost", "comfort", "risk"],
      ["speed", "comfort"],
    ]) {
      const { results, context } = setUpFits();
      fillFrom(questionOf(ranking(...ids)), { results: { priorities: order } }, context);
      expect(results.record().has("priorities")).toBe(false);
    }
  });

  test("a Ranking that still holds the same elements is seeded its order, reordered or not", () => {
    const { results, context } = setUpFits();
    fillFrom(
      questionOf(ranking("comfort", "speed", "cost")),
      { results: { priorities: order } },
      context,
    );
    expect(results.valueOf("priorities")).toEqual(order);
  });

  test("a Scale turned into a range, or whose max fell below the value, is seeded no value", () => {
    for (const [props, value] of [
      [{ min: 0, max: 100, step: 5, range: true }, 35],
      [{ min: 0, max: 50, step: 5 }, 100],
      [{ min: 0, max: 100, step: 10 }, 35],
    ] as const) {
      const { results, context } = setUpFits();
      fillFrom(questionOf(scale(props)), { results: { share: { value } } }, context);
      expect(results.record().has("share")).toBe(false);
    }
  });

  test("a result of another type's shape is seeded into no item, as when a revision changed the type under the ID", () => {
    const approval: WidgetItem = { type: "approval", id: "share", props: {} };
    const scaled: WidgetItem = {
      type: "scale",
      id: "priorities",
      props: { min: 0, max: 100, step: 5 },
    };
    const { results, context } = setUpFits();
    fillFrom(
      questionOf(approval, scaled),
      { results: { share: { value: 50 }, priorities: order } },
      context,
    );
    expect(results.record().size).toBe(0);
    const turned = setUpFits();
    fillFrom(
      questionOf(ranking("speed", "comfort"), { ...approval, id: "other" }),
      { results: { priorities: { decision: "approve" }, other: { decision: "approve" } } },
      turned.context,
    );
    expect([...turned.results.record().keys()]).toEqual(["other"]);
  });

  test("a type whose chunk registered no check, or none at all, is seeded no result, never any", () => {
    const set = setUpFits();
    const bare: WidgetItem = { type: "bare", id: "share", props: {} };
    const unknown: WidgetItem = { type: "unknown", id: "priorities", props: {} };
    const noFits = (type: string) =>
      type === "bare" ? { confirmsRevision: true as const } : undefined;
    fillFrom(
      questionOf(bare, unknown),
      { results: { share: { value: 50 }, priorities: { order: ["a", "b"] } } },
      { ...set.context, facts: noFits },
    );
    expect(set.results.record().size).toBe(0);
  });

  test("a Scale value still on the grid is seeded", () => {
    const { results, context } = setUpFits();
    fillFrom(
      questionOf(scale({ min: 0, max: 100, step: 5 })),
      { results: { share: { value: 35 } } },
      context,
    );
    expect(results.valueOf("share")).toEqual({ value: 35 });
  });

  test("a result the type refuses clears the one held in its place, and the others still seed", () => {
    const { results, context } = setUpFits();
    results.set("priorities", { order: ["speed", "comfort", "risk"] });
    const question = questionOf(ranking("speed", "comfort"), verdict);
    fillFrom(question, { results: { priorities: order, verdict: rejected } }, context);
    expect(results.record().has("priorities")).toBe(false);
    expect(results.valueOf("verdict")).toEqual(rejected);
  });

  test("Keep mine, on a card showing the current revision, drops a held result that revision refuses and keeps the others", () => {
    const { sent, results, board, context } = setUpFits();
    const current = { ...questionOf(ranking("speed", "comfort"), verdict), rev: 2 };
    board.edit("database", 1, () => ({ rev: 1 }));
    results.set("priorities", order);
    results.set("verdict", rejected);
    keepMine(current, context, current);
    expect(results.record().has("priorities")).toBe(false);
    expect(results.valueOf("verdict")).toEqual(rejected);
    expect(sent).toEqual([
      expect.objectContaining({ type: "act", acts: [expect.objectContaining({ keptRev: 1 })] }),
    ]);
  });

  test("Keep mine, on a card showing the earlier revision the work was made on, keeps its results", () => {
    const { results, board, context } = setUpFits();
    const earlier = questionOf(ranking("speed", "cost", "comfort"));
    const current = { ...questionOf(ranking("speed", "comfort")), rev: 2 };
    board.edit("database", 1, () => ({ rev: 1 }));
    results.set("priorities", order);
    keepMine(current, context, earlier);
    expect(results.valueOf("priorities")).toEqual(order);
  });

  test("the leave-page prompt is armed after seeding, as the draft record the page mirrors shows", () => {
    const { draft, results, board, context } = setUp();
    const document = {
      ...plainChoiceBoardDocument,
      items: [asked],
    } as typeof plainChoiceBoardDocument;
    connectDrafts(document, draft, board, results);
    expect(
      hasUnsentWork(draftRecordOf(document, draft.record(), board.get(), results.record())),
    ).toBe(false);
    fillFrom(asked, { results: { verdict: rejected } }, context);
    expect(board.work("database")).toBeDefined();
    expect(
      hasUnsentWork(draftRecordOf(document, draft.record(), board.get(), results.record())),
    ).toBe(true);
  });

  test("a board with no results store seeds nothing and does not throw", () => {
    const { draft, board } = setUp();
    expect(() =>
      fillFrom(asked, { results: { verdict: rejected } }, { draft, board }),
    ).not.toThrow();
  });
});
