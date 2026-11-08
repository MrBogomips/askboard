// The gates of an act read the revision the card shows (document-review, task 6.6; review S-1 of 6.5,
// Issue #92; view-and-widgets spec: The answer gates read the revision the card shows; design
// decision 15): after "Keep mine" the card shows the revision the work was made on, so the field
// block, the reason gate and a hidden tab's mark agree with every press ("Answer", "Accept
// recommended", "Select recommended", Submit) on that revision, and a press never refuses without a
// word what the card shows as ready, nor sends what the card shows as blocked (NFR-10, AD-10). A
// probe type stands for a type whose check follows the agent's content: its `check` reads the item's
// `label` prop, so one revision fails it and the other does not; a `toggle` stands for a type that
// requires a reason for a held `true`. No component is rendered.

import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { BoardWidgetItem, ComponentFacts } from "../catalog/port.ts";
import type { ViewDocument, ViewQuestion, WidgetItem } from "../view-document.ts";
import type { ViewMessage } from "../view-protocol.ts";
import { createRevisions, readOnlyOfBoard, shownOfBoard } from "./agent-change.ts";
import { createAnswerActs } from "./answer-acts.ts";
import { createBoardContent, withEntries } from "./board-content.ts";
import { connectDrafts, createBoardDraft } from "./board-draft.ts";
import {
  acceptRecommended,
  answer,
  answerNeedsReason,
  fillFrom,
  keepMine,
  pressAnswer,
} from "./card-acts.ts";
import type { ViewChannel } from "./channel.ts";
import { createDerivedStore } from "./derived-store.ts";
import { createDraftStore } from "./draft-store.ts";
import { answerHint, holdsBlock } from "./field-block.ts";
import {
  heldMissingReason,
  heldWithBlock,
  heldWorkOf,
  selectRecommended,
  submitPress,
  submitStateOf,
} from "./submit.ts";

const FAILS = { code: "pattern" } as const;
const DETACHED = { code: "detached", count: 1 } as const;
const REASON = { label: "question.reasonRequired", missing: "question.reasonMissing" } as const;

// A held result fails the probe's check on the revision whose item is labelled `failing`.
const factsFailing =
  (failing: string) =>
  (type: string): ComponentFacts | undefined => {
    if (type === "toggle") {
      return { fits: () => true, reason: (result) => (result === true ? REASON : undefined) };
    }
    if (type !== "text-field") return undefined;
    return {
      fits: () => true,
      check: (result, props) =>
        result !== undefined && (props as { label?: string }).label === failing ? FAILS : undefined,
    };
  };

const [first] = plainChoiceBoardDocument.items;
const OPTIONS = [{ label: "Yes", recommended: true }, { label: "No" }];

const field = (id: string, label: string, type = "text-field"): WidgetItem =>
  ({ type, id, props: { label } }) as unknown as WidgetItem;

const questionOf = (
  items: readonly WidgetItem[],
  rev: number,
  options: readonly { label: string; recommended?: boolean }[] = OPTIONS,
): ViewQuestion =>
  ({
    ...first,
    id: "plan",
    rev,
    props: { ...first.props, text: "Plan?", options, items },
  }) as unknown as ViewQuestion;
const documentOf = (question: ViewQuestion): ViewDocument =>
  ({ ...plainChoiceBoardDocument, items: [question] }) as unknown as ViewDocument;
const openState = (question: ViewQuestion): LifecycleBoardState => ({
  ask: "waiting",
  questions: [{ itemId: question.id, rev: question.rev, state: "open" }],
});

// Revision 1 labels the field "Owner", revision 2 "Owner 2": the agent's update.
const REV1 = questionOf([field("owner", "Owner")], 1);
const REV2 = questionOf([field("owner", "Owner 2")], 2);
const NONE = new Map<string, unknown>();

// The stores of a board whose document holds `current`, with the work made on revision 1 and the
// revisions the view has `seen`; "Keep mine" done when `kept`.
const board = (
  current: ViewQuestion,
  {
    seen,
    kept = true,
    delivery = "immediate",
    facts = factsFailing(""),
  }: {
    readonly seen: readonly ViewQuestion[];
    readonly kept?: boolean;
    readonly delivery?: "immediate" | "submitted";
    readonly facts?: (type: string) => ComponentFacts | undefined;
  },
) => {
  const sent: ViewMessage[] = [];
  const channel: ViewChannel = {
    send: async (message) => {
      sent.push(message);
      return { outcome: "sent", actionId: "AAAAAAAAAAAAAAAAAAAAAA" };
    },
    onUpdate: () => () => {},
    onTheme: () => () => {},
  };
  const draft = createDraftStore();
  const results = createDraftStore();
  const entries = createDraftStore();
  const work = createBoardDraft(delivery);
  connectDrafts(documentOf(current), draft, work, results, entries);
  const revisions = createRevisions();
  for (const question of seen) revisions.record(documentOf(question));
  const context = {
    channel,
    acts: createAnswerActs(),
    draft,
    results,
    entries,
    board: work,
    derived: createDerivedStore(),
    delivery,
    facts,
    revisions,
  };
  draft.set("plan", ["Yes"]);
  results.set("owner", "anything");
  work.edit("plan", 1, () => ({ rev: 1 }));
  const shownOf = shownOfBoard(work, revisions);
  if (kept) keepMine(current, context, shownOf(current), readOnlyOfBoard(work, revisions)(current));
  sent.length = 0;
  return { sent, draft, results, entries, board: work, revisions, context, shownOf };
};

type Stores = ReturnType<typeof board>;

const held = (stores: Stores, question: ViewQuestion) => {
  stores.board.edit("plan", question.rev, (work) => ({
    ...work,
    held: { act: "answer", order: 0 },
  }));
};

const inputsOf = (stores: Stores, question: ViewQuestion, facts: Stores["context"]["facts"]) => ({
  document: documentOf(question),
  board: stores.board.get(),
  delivery: "submitted" as const,
  connection: undefined,
  lock: undefined,
  pending: () => false,
  sending: () => false,
  entries: stores.entries.record(),
  results: stores.results.record(),
  facts,
});

const pressOf = (
  stores: Stores,
  question: ViewQuestion,
  facts: Stores["context"]["facts"],
  shownOf?: Stores["shownOf"],
) =>
  submitPress(
    documentOf(question),
    stores.board.get(),
    stores.draft.record(),
    new Date(),
    () => undefined,
    {
      results: stores.results.record(),
      entries: stores.entries.record(),
      state: openState(question),
      facts,
      ...(shownOf === undefined ? {} : { shownOf }),
    },
  );

describe("the card and the presses read one revision after Keep mine (review S-1 of 6.5, #92)", () => {
  // Revision 2 fails the probe's check; revision 1, which the card shows, passes it.
  const facts = factsFailing("Owner 2");

  test("the card's reading: the shown revision does not block and gives no hint, the current one would", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts });
    expect(stores.shownOf(REV2)).toBe(REV1);
    expect(holdsBlock(REV1, NONE, stores.results.record(), facts)).toBe(false);
    expect(answerHint(REV1, NONE, stores.results.record(), "en-US", facts)).toBeUndefined();
    expect(holdsBlock(REV2, NONE, stores.results.record(), facts)).toBe(true);
  });

  test("Answer sends the answer naming revision 1, with the results the user held", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts });
    expect(answer(REV2, { ...stores.context, shownOf: stores.shownOf })).toBeUndefined();
    expect(stores.sent).toHaveLength(1);
    expect(stores.sent[0]).toMatchObject({
      type: "answer",
      rev: 1,
      results: { owner: "anything" },
    });
  });

  test("Accept recommended and the card's own press send it too", () => {
    const accepted = board(REV2, { seen: [REV1, REV2], facts });
    acceptRecommended(REV2, { ...accepted.context, shownOf: accepted.shownOf });
    expect(accepted.sent).toHaveLength(1);
    expect(accepted.sent[0]).toMatchObject({ type: "answer", rev: 1 });
    const pressed = board(REV2, { seen: [REV1, REV2], facts });
    const outcome = pressAnswer(
      REV2,
      { ...pressed.context, shownOf: pressed.shownOf },
      { itemId: "plan", rev: 2, state: "open" },
      () => {},
    );
    expect(outcome.kind).toBe("done");
    expect(pressed.sent).toHaveLength(1);
  });

  test("Select recommended marks the question ready for Submit", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts, delivery: "submitted" });
    stores.draft.set("plan", undefined);
    const count = selectRecommended(
      documentOf(REV2),
      openState(REV2),
      { ...stores.context, shownOf: stores.shownOf },
      () => false,
    );
    expect(count).toBe(1);
    expect(stores.board.work("plan")?.held).toMatchObject({ act: "answer", byRecommended: true });
  });

  test("Submit stays enabled and sends the held answer naming revision 1", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts, delivery: "submitted" });
    held(stores, REV2);
    const inputs = inputsOf(stores, REV2, facts);
    expect(submitStateOf({ ...inputs, shownOf: stores.shownOf }).disabled).toBe(false);
    const works = heldWorkOf(documentOf(REV2), stores.board.get());
    const blocked = (shownOf?: Stores["shownOf"]) =>
      heldWithBlock(
        documentOf(REV2),
        works,
        NONE,
        stores.results.record(),
        facts,
        undefined,
        shownOf,
      );
    expect(blocked(stores.shownOf)).toBeUndefined();
    const pressed = pressOf(stores, REV2, facts, stores.shownOf);
    expect(pressed.kind).toBe("send");
    expect(pressed.kind === "send" ? pressed.acts[0] : undefined).toMatchObject({
      type: "answer",
      rev: 1,
    });
  });

  test("with the gates reading the current revision the same press sends nothing, which is the fault", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts });
    answer(REV2, stores.context);
    expect(stores.sent).toEqual([]);
  });
});

describe("the converse: a check failing only on the shown revision stops every press, and the card says so", () => {
  const facts = factsFailing("Owner");

  test("the card's hint names the field and blocks", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts });
    expect(holdsBlock(REV1, NONE, stores.results.record(), facts)).toBe(true);
    expect(answerHint(REV1, NONE, stores.results.record(), "en-US", facts)).toBe(
      "Correct Owner first.",
    );
  });

  test("Answer, Accept recommended and the card's press send nothing", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts });
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(answer(REV2, context)).toBeUndefined();
    expect(acceptRecommended(REV2, context)).toBeUndefined();
    expect(stores.sent).toEqual([]);
    expect(stores.board.work("plan")?.held).toBeUndefined();
  });

  test("Select recommended marks nothing, and Submit is disabled and refuses to send", () => {
    const stores = board(REV2, { seen: [REV1, REV2], facts, delivery: "submitted" });
    stores.draft.set("plan", undefined);
    selectRecommended(
      documentOf(REV2),
      openState(REV2),
      { ...stores.context, shownOf: stores.shownOf },
      () => false,
    );
    expect(stores.board.work("plan")?.held).toBeUndefined();
    held(stores, REV2);
    const inputs = inputsOf(stores, REV2, facts);
    expect(submitStateOf({ ...inputs, shownOf: stores.shownOf }).disabled).toBe(true);
    expect(pressOf(stores, REV2, facts, stores.shownOf).kind).toBe("field-block");
  });
});

describe("with revision 1 unseen (a reload) every reader reads revision 2, as before", () => {
  const facts = factsFailing("Owner 2");

  test("the shown revision is the current one and the press blocks", () => {
    const stores = board(REV2, { seen: [REV2], facts, kept: false });
    expect(stores.shownOf(REV2)).toBe(REV2);
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(answer(REV2, context)).toBeUndefined();
    expect(acceptRecommended(REV2, context)).toBeUndefined();
    expect(stores.sent).toEqual([]);
  });

  test("Submit is disabled and refuses to send", () => {
    const stores = board(REV2, { seen: [REV2], facts, kept: false, delivery: "submitted" });
    held(stores, REV2);
    expect(
      submitStateOf({ ...inputsOf(stores, REV2, facts), shownOf: stores.shownOf }).disabled,
    ).toBe(true);
    expect(pressOf(stores, REV2, facts, stores.shownOf).kind).toBe("field-block");
  });
});

describe("a hidden tab's mark follows the shown revision's items", () => {
  const boardOf = (question: ViewQuestion) =>
    createBoardContent(() => ({
      document: documentOf(question),
      state: { ask: "waiting", questions: [] } as never,
    }))(new Map());
  const results = new Map<string, unknown>([["owner", "anything"]]);
  const itemsOf = (question: ViewQuestion) => question.props.items as unknown as BoardWidgetItem[];

  test("an item failing only on the current revision is not marked while the card shows the earlier one", () => {
    const facts = factsFailing("Owner 2");
    const current = boardOf(REV2);
    expect([...(withEntries(current, new Map(), results, facts).entries ?? [])]).toEqual(["owner"]);
    expect(withEntries(current, new Map(), results, facts, undefined, itemsOf(REV1))).toBe(current);
  });

  test("an item failing only on the shown revision is marked, though the current one passes it", () => {
    const facts = factsFailing("Owner");
    const current = boardOf(REV2);
    expect(withEntries(current, new Map(), results, facts)).toBe(current);
    const marked = withEntries(current, new Map(), results, facts, undefined, itemsOf(REV1));
    expect([...(marked.entries ?? [])]).toEqual(["owner"]);
  });

  test("an item the current revision no longer holds is marked by the shown revision's props", () => {
    const facts = factsFailing("Owner");
    const gone = questionOf([], 2);
    const current = boardOf(gone);
    expect(withEntries(current, new Map(), results, facts)).toBe(current);
    const marked = withEntries(current, new Map(), results, facts, undefined, itemsOf(REV1));
    expect([...(marked.entries ?? [])]).toEqual(["owner"]);
  });
});

describe("the reason gate reads the shown revision (revision 2 removed the item that requires one)", () => {
  // Revision 1 holds a Toggle whose held `true` requires a reason; revision 2 holds none.
  const WITH_TOGGLE = questionOf([field("flag", "Flag", "toggle")], 1);
  const WITHOUT = questionOf([], 2);
  const facts = factsFailing("");
  const setUp = (delivery: "immediate" | "submitted" = "immediate") => {
    const stores = board(WITHOUT, { seen: [WITH_TOGGLE, WITHOUT], facts, delivery, kept: false });
    stores.results.set("owner", undefined);
    stores.results.set("flag", true);
    return stores;
  };

  test("the card needs a reason; the press asks for it too and sends nothing", () => {
    const stores = setUp();
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(answerNeedsReason(WITHOUT, context)).toBe(true);
    expect(answer(WITHOUT, context)).toBe("needs-reason");
    expect(stores.sent).toEqual([]);
    expect(pressAnswer(WITHOUT, context, undefined, () => {})).toEqual({ kind: "needs-reason" });
  });

  test("Submit's last check names the question and sends nothing", () => {
    const stores = setUp("submitted");
    held(stores, WITHOUT);
    const works = heldWorkOf(documentOf(WITHOUT), stores.board.get());
    const missing = (shownOf?: Stores["shownOf"]) =>
      heldMissingReason(
        documentOf(WITHOUT),
        works,
        stores.draft.record(),
        stores.results.record(),
        facts,
        shownOf,
      );
    expect(missing()).toBeUndefined();
    expect(missing(stores.shownOf)?.id).toBe("plan");
    expect(pressOf(stores, WITHOUT, facts, stores.shownOf)).toEqual({
      kind: "needs-reason",
      questionId: "plan",
    });
  });
});

describe("the reworded scenario: annotations held on a revision whose text no longer places them", () => {
  // "Start from my previous answer" put an answer's result back on the current revision, whose
  // document no longer holds its quote: the probe's check gives `detached` for it.
  const facts = (type: string): ComponentFacts | undefined =>
    type === "text-field"
      ? { fits: () => true, check: (result) => (result === "gone" ? DETACHED : undefined) }
      : undefined;
  const question = questionOf([field("owner", "Owner")], 2);
  const seeded = (delivery: "immediate" | "submitted" = "immediate") => {
    const stores = board(question, { seen: [question], facts, kept: false, delivery });
    stores.results.set("owner", undefined);
    fillFrom(question, { results: { owner: "gone" } } as never, stores.context);
    stores.board.edit("plan", 2, (work) => ({ ...work, rev: 2 }));
    return stores;
  };

  test("every reader blocks and the hint asks to delete the detached comments", () => {
    const stores = seeded();
    expect(stores.results.valueOf("owner")).toBe("gone");
    expect(holdsBlock(question, NONE, stores.results.record(), facts)).toBe(true);
    expect(answerHint(question, NONE, stores.results.record(), "en-US", facts)).toBe(
      "Delete the detached comments in the document first.",
    );
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(answer(question, context)).toBeUndefined();
    expect(acceptRecommended(question, context)).toBeUndefined();
    expect(stores.sent).toEqual([]);
  });

  test("Submit refuses it and Select recommended marks nothing, until the comments are deleted", () => {
    const stores = seeded("submitted");
    held(stores, question);
    const shownOf = stores.shownOf;
    expect(pressOf(stores, question, facts, shownOf).kind).toBe("field-block");
    stores.results.set("owner", undefined);
    expect(pressOf(stores, question, facts, shownOf).kind).toBe("send");
  });
});

describe("an act sends what the card shows, an item a later revision removed included (task 6.10, #93)", () => {
  // Revision 1 holds the items `a` and `b`; revision 2 removes `b`. The user held a result on each
  // and a value on `b`, then kept their work: the card shows revision 1.
  const WITH_B = questionOf([field("a", "A"), field("b", "B")], 1);
  const WITHOUT_B = questionOf([field("a", "A")], 2);
  const facts = factsFailing("");
  const setUp = (delivery: "immediate" | "submitted" = "immediate") => {
    const stores = board(WITHOUT_B, { seen: [WITH_B, WITHOUT_B], facts, delivery });
    stores.results.set("owner", undefined);
    stores.results.set("a", "A");
    stores.results.set("b", "B");
    stores.draft.set("b", { size: 3 });
    return stores;
  };
  const SENT = {
    type: "answer",
    rev: 1,
    results: { a: "A", b: "B" },
    values: { b: { size: 3 } },
  };

  test("Answer sends the results and the value of both items, naming revision 1", () => {
    const stores = setUp();
    expect(stores.shownOf(WITHOUT_B)).toBe(WITH_B);
    answer(WITHOUT_B, { ...stores.context, shownOf: stores.shownOf });
    expect(stores.sent).toHaveLength(1);
    expect(stores.sent[0]).toMatchObject(SENT);
  });

  test("Accept recommended sends them too", () => {
    const stores = setUp();
    acceptRecommended(WITHOUT_B, { ...stores.context, shownOf: stores.shownOf });
    expect(stores.sent).toHaveLength(1);
    expect(stores.sent[0]).toMatchObject(SENT);
  });

  test("Select recommended marks the question and Submit sends them", () => {
    const stores = setUp("submitted");
    stores.draft.set("plan", undefined);
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(
      selectRecommended(documentOf(WITHOUT_B), openState(WITHOUT_B), context, () => false),
    ).toBe(1);
    const pressed = pressOf(stores, WITHOUT_B, facts, stores.shownOf);
    expect(pressed.kind).toBe("send");
    expect(pressed.kind === "send" ? pressed.acts[0] : undefined).toMatchObject({
      type: "answer",
      rev: 1,
      results: { a: "A", b: "B" },
    });
  });

  test("Submit's held answer carries both results and the value", () => {
    const stores = setUp("submitted");
    held(stores, WITHOUT_B);
    const pressed = pressOf(stores, WITHOUT_B, facts, stores.shownOf);
    expect(pressed.kind).toBe("send");
    expect(pressed.kind === "send" ? pressed.acts[0] : undefined).toMatchObject(SENT);
  });

  test("an entry held on the removed item blocks every press, as the card says", () => {
    const withNumber = questionOf([field("a", "A"), field("b", "B", "number-field")], 1);
    const stores = board(WITHOUT_B, { seen: [withNumber, WITHOUT_B], facts });
    stores.results.set("owner", undefined);
    stores.entries.set("b", "12x");
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(holdsBlock(withNumber, stores.entries.record(), stores.results.record(), facts)).toBe(
      true,
    );
    expect(answer(WITHOUT_B, context)).toBeUndefined();
    expect(acceptRecommended(WITHOUT_B, context)).toBeUndefined();
    expect(stores.sent).toEqual([]);
  });

  test("with the work not kept (a reload) the removed item's work is not sent", () => {
    const stores = board(WITHOUT_B, { seen: [WITHOUT_B], facts, kept: false });
    stores.results.set("owner", undefined);
    stores.results.set("a", "A");
    stores.results.set("b", "B");
    answer(WITHOUT_B, { ...stores.context, shownOf: stores.shownOf });
    expect(stores.sent[0]).toMatchObject({ results: { a: "A" } });
    expect((stores.sent[0] as { results: object }).results).not.toHaveProperty("b");
  });
});

describe("Select recommended picks the option the card shows as recommended (task 6.11, #93)", () => {
  // Revision 1 recommends "Yes"; revision 2 recommends a new option "Maybe". The user held a result,
  // chose nothing, and kept their work: the card shows revision 1, which has no "Maybe".
  const ITEMS = [field("a", "A")];
  const FIRST = questionOf(ITEMS, 1);
  const SECOND = questionOf(ITEMS, 2, [
    { label: "Yes" },
    { label: "No" },
    { label: "Maybe", recommended: true },
  ]);
  const facts = factsFailing("");
  const setUp = (delivery: "immediate" | "submitted" = "submitted") => {
    const stores = board(SECOND, { seen: [FIRST, SECOND], facts, delivery });
    stores.results.set("owner", undefined);
    stores.results.set("a", "A");
    stores.draft.set("plan", undefined);
    return stores;
  };

  test("the board's Select recommended selects revision 1's option, and Submit sends it naming revision 1", () => {
    const stores = setUp();
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(selectRecommended(documentOf(SECOND), openState(SECOND), context, () => false)).toBe(1);
    expect(stores.draft.valueOf("plan")).toEqual(["Yes"]);
    expect(stores.board.work("plan")?.held).toMatchObject({ act: "answer", byRecommended: true });
    const pressed = pressOf(stores, SECOND, facts, stores.shownOf);
    expect(pressed.kind).toBe("send");
    expect(pressed.kind === "send" ? pressed.acts[0] : undefined).toMatchObject({
      type: "answer",
      rev: 1,
      choice: ["Yes"],
    });
  });

  test("Accept recommended picks it too, and the answer names revision 1", () => {
    const stores = setUp("immediate");
    acceptRecommended(SECOND, { ...stores.context, shownOf: stores.shownOf });
    expect(stores.draft.valueOf("plan")).toEqual(["Yes"]);
    expect(stores.sent).toHaveLength(1);
    expect(stores.sent[0]).toMatchObject({ type: "answer", rev: 1, choice: ["Yes"] });
  });

  test("a recommendation moved to another label revision 1 also offers does not move the pick", () => {
    const moved = questionOf(ITEMS, 2, [{ label: "Yes" }, { label: "No", recommended: true }]);
    const stores = board(moved, { seen: [FIRST, moved], facts, delivery: "submitted" });
    stores.results.set("owner", undefined);
    stores.results.set("a", "A");
    stores.draft.set("plan", undefined);
    const context = { ...stores.context, shownOf: stores.shownOf };
    selectRecommended(documentOf(moved), openState(moved), context, () => false);
    expect(stores.draft.valueOf("plan")).toEqual(["Yes"]);
  });

  test("a revision the card shows without a recommendation selects nothing and marks nothing", () => {
    const plain = questionOf(ITEMS, 1, [{ label: "Yes" }, { label: "No" }]);
    const stores = board(SECOND, { seen: [plain, SECOND], facts, delivery: "submitted" });
    stores.results.set("owner", undefined);
    stores.results.set("a", "A");
    stores.draft.set("plan", undefined);
    const context = { ...stores.context, shownOf: stores.shownOf };
    expect(selectRecommended(documentOf(SECOND), openState(SECOND), context, () => false)).toBe(0);
    expect(stores.draft.valueOf("plan")).toBeUndefined();
    expect(stores.board.work("plan")?.held).toBeUndefined();
    expect(acceptRecommended(SECOND, context)).toBeUndefined();
    expect(stores.sent).toEqual([]);
  });

  test("with revision 1 unseen (a reload) the current revision's option is the pick", () => {
    const stores = board(SECOND, { seen: [SECOND], facts, kept: false, delivery: "submitted" });
    stores.draft.set("plan", undefined);
    const context = { ...stores.context, shownOf: stores.shownOf };
    selectRecommended(documentOf(SECOND), openState(SECOND), context, () => false);
    expect(stores.draft.valueOf("plan")).toEqual(["Maybe"]);
  });
});
