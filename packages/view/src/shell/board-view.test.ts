import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { questionsOf, type ViewArea, type ViewDocument } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import {
  askPillOf,
  endedOf,
  groupsOf,
  isOpen,
  type Ladder,
  markLabel,
  markOf,
  nextAfterRemoval,
  nextOpenFrom,
  nextOpenOrder,
  openCountOf,
  postponedWarningOf,
  presentationOf,
  previousOpenFrom,
  shownQuestionOf,
  tabOpenCount,
} from "./board-view.ts";

const when = "2026-10-31T09:41:27Z";
const answeredAs = (itemId: string, extra: Record<string, unknown> = {}) => ({
  itemId,
  rev: 1,
  state: "answered",
  answer: { choice: ["x"], when, receipt: "sent", ...extra },
});
const stateOf = (ask: string, questions: unknown[]) =>
  ({ ask, questions }) as unknown as LifecycleBoardState;
const ids = ["region", "payment", "analytics", "rollout", "erp-export"];
const allOpen = stateOf(
  "waiting",
  ids.map((itemId) => ({ itemId, rev: 1, state: "open" })),
);
const noWork = new Map<string, QuestionWork>();
const none: Ladder = { flightOf: () => undefined, revisingOf: () => false };
const revisingOnly = (...revising: string[]): Ladder => ({
  flightOf: () => undefined,
  revisingOf: (id) => revising.includes(id),
});
const held = (entries: [string, QuestionWork["held"]][]) =>
  new Map(entries.map(([id, act]) => [id, { rev: 1, held: act }] as const));

describe("presentations (ask-lifecycle: Presentations, Single-question board; FR-2)", () => {
  const flat: ViewDocument = {
    ...lifecycleBoardDocument,
    items: (lifecycleBoardDocument.items as unknown as readonly ViewArea[]).flatMap(
      (area) => area.props.items,
    ) as never,
  };

  test("one question is the single-question board, whatever the ask requests", () => {
    expect(presentationOf(plainChoiceBoardDocument)).toBe("single");
    expect(presentationOf({ ...plainChoiceBoardDocument, presentation: "one-per-view" })).toBe(
      "single",
    );
  });

  test("sections by default; tabs and one question per view as requested", () => {
    expect(presentationOf({ ...lifecycleBoardDocument, presentation: undefined })).toBe("sections");
    expect(presentationOf(lifecycleBoardDocument)).toBe("tabs");
    expect(presentationOf({ ...flat, presentation: "one-per-view" })).toBe("one-per-view");
  });

  test("the question shown: the one in view, and in one question per view the first until one is", () => {
    const perView = { ...flat, presentation: "one-per-view" } as ViewDocument;
    const [first, second] = questionsOf(perView);
    expect(shownQuestionOf(perView, undefined)).toBe(first?.id);
    expect(shownQuestionOf(perView, second?.id)).toBe(second?.id);
    expect(shownQuestionOf(perView, "gone")).toBe(first?.id);
    expect(shownQuestionOf({ ...flat, presentation: undefined } as ViewDocument, undefined)).toBe(
      undefined,
    );
  });

  test("tabs without areas show as one group, with no tab strip", () => {
    expect(presentationOf({ ...flat, presentation: "tabs" })).toBe("sections");
    expect(groupsOf(flat).map(({ title, questions }) => [title, questions.length])).toEqual([
      [undefined, 5],
    ]);
  });

  test("each area is a titled group; an area with no question is hidden", () => {
    expect(groupsOf(lifecycleBoardDocument).map(({ id, title }) => [id, title])).toEqual([
      ["scope", "Scope"],
      ["delivery", "Delivery"],
    ]);
    const [scope, delivery] = lifecycleBoardDocument.items as unknown as readonly [
      ViewArea,
      ViewArea,
    ];
    const emptied = {
      ...lifecycleBoardDocument,
      items: [scope, { ...delivery, props: { ...delivery.props, items: [] } }],
    } as unknown as ViewDocument;
    expect(groupsOf(emptied).map(({ id }) => id)).toEqual(["scope"]);
  });
});

describe("counting (EXPERIENCE.md, Counting; FR-24)", () => {
  test("open: unanswered and postponed, held postpones included; not ready, answered or declined", () => {
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "open" },
      answeredAs("payment"),
      { itemId: "analytics", rev: 1, state: "postponed" },
      {
        itemId: "rollout",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      { itemId: "erp-export", rev: 1, state: "open" },
    ]);
    expect(openCountOf(lifecycleBoardDocument, state, noWork, none)).toBe(3);
    const work = held([
      ["region", { act: "answer", order: 0 }],
      ["erp-export", { act: "postpone", order: 1 }],
    ]);
    expect(openCountOf(lifecycleBoardDocument, state, work, none)).toBe(2);
  });

  test("a tab's count is its area's", () => {
    const [scope, delivery] = lifecycleBoardDocument.items as unknown as readonly [
      ViewArea,
      ViewArea,
    ];
    const work = held([["region", { act: "answer", order: 0 }]]);
    expect(tabOpenCount(scope, allOpen, work, none)).toBe(2);
    expect(tabOpenCount(delivery, allOpen, work, none)).toBe(2);
  });

  test("the ask pill shows only what the agent has received", () => {
    expect(askPillOf(allOpen, undefined)).toEqual({ kind: "waiting", label: "Waiting" });
    const partly = stateOf("partly-answered", [
      answeredAs("region"),
      {
        itemId: "payment",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      { itemId: "analytics", rev: 1, state: "postponed" },
    ]);
    expect(askPillOf(partly, undefined)).toEqual({
      kind: "partial",
      label: "Partly answered 2/3",
    });
    const answered = stateOf("answered", [answeredAs("region"), answeredAs("payment")]);
    expect(askPillOf(answered, undefined)).toEqual({ kind: "answered", label: "Answered" });
    const withPostponed = stateOf("answered", [
      answeredAs("region"),
      { itemId: "payment", rev: 1, state: "postponed" },
    ]);
    expect(askPillOf(withPostponed, undefined).label).toBe("answered, 1 postponed");
    const both = stateOf("answered", [
      {
        itemId: "region",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      { itemId: "payment", rev: 1, state: "postponed" },
      { itemId: "analytics", rev: 1, state: "postponed" },
    ]);
    expect(askPillOf(both, undefined).label).toBe("answered, 2 postponed, 1 declined");
  });

  test("closed and discarded win", () => {
    expect(askPillOf(stateOf("closed", []), undefined)).toEqual({
      kind: "closed",
      label: "Closed",
    });
    expect(askPillOf(allOpen, "closed")).toEqual({ kind: "closed", label: "Closed" });
    expect(askPillOf(allOpen, "discarded")).toEqual({ kind: "discarded", label: "Discarded" });
    expect(askPillOf(allOpen, "moved")).toEqual({ kind: "waiting", label: "Waiting" });
  });

  test("each question's own mark: to do, ready, sent, postponed or declined", () => {
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "open" },
      answeredAs("payment"),
      { itemId: "analytics", rev: 1, state: "postponed" },
      {
        itemId: "rollout",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      { itemId: "erp-export", rev: 1, state: "open" },
    ]);
    const work = held([
      ["region", { act: "answer", order: 0 }],
      ["erp-export", { act: "decline", order: 1 }],
    ]);
    expect(ids.map((id) => markOf(id, state, work, none))).toEqual([
      "ready",
      "sent",
      "postponed",
      "declined",
      "declined",
    ]);
    expect(markOf("region", allOpen, held([["region", { act: "postpone", order: 0 }]]), none)).toBe(
      "postponed",
    );
    expect(markOf("region", allOpen, noWork, none)).toBe("todo");
  });

  test("held work shows as Submit will leave it: an undo reopens, a note alone leaves the question open, a ready revision is ready (task 6.6)", () => {
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "postponed" },
      answeredAs("payment"),
      {
        itemId: "analytics",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      { itemId: "rollout", rev: 1, state: "open" },
      { itemId: "erp-export", rev: 1, state: "postponed" },
    ]);
    const work = held([
      ["region", { act: "reopen", order: 0 }],
      ["payment", { act: "answer", order: 1 }],
      ["analytics", { act: "reopen", order: 2 }],
      ["rollout", { act: "note", order: 3 }],
      ["erp-export", { act: "note", order: 4 }],
    ]);
    expect(ids.map((id) => markOf(id, state, work, none))).toEqual([
      "todo",
      "ready",
      "todo",
      "todo",
      "postponed",
    ]);
    expect(openCountOf(lifecycleBoardDocument, state, work, none)).toBe(4);
    expect(postponedWarningOf(lifecycleBoardDocument, state, work, none)).toBe(
      "You have 1 postponed question: closing loses this ask",
    );
  });

  test("a note held over the undo of a sent postpone leaves the question unanswered, as Submit will", () => {
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "postponed" },
      ...ids.slice(1).map((itemId) => ({ itemId, rev: 1, state: "open" })),
    ]);
    const work = new Map<string, QuestionWork>([
      [
        "region",
        {
          rev: 1,
          note: "Ask ops.",
          held: { act: "note", order: 1 },
          undo: { act: "reopen", order: 0 },
        },
      ],
    ]);
    expect(markOf("region", state, work, none)).toBe("todo");
    expect(postponedWarningOf(lifecycleBoardDocument, state, work, none)).toBeUndefined();
  });

  test("the postponed warning counts the postponed questions still open", () => {
    expect(postponedWarningOf(lifecycleBoardDocument, allOpen, noWork, none)).toBeUndefined();
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "postponed" },
      ...ids.slice(1).map((itemId) => ({ itemId, rev: 1, state: "open" })),
    ]);
    expect(postponedWarningOf(lifecycleBoardDocument, state, noWork, none)).toBe(
      "You have 1 postponed question: closing loses this ask",
    );
    expect(
      postponedWarningOf(
        lifecycleBoardDocument,
        state,
        held([["payment", { act: "postpone", order: 0 }]]),
        none,
      ),
    ).toBe("You have 2 postponed questions: closing loses this ask");
  });
});

describe("the ladder on every surface (answering-flow-guidance, decision 1; EXPERIENCE.md, Counting)", () => {
  const delivered = (itemId: string) => answeredAs(itemId, { receipt: "delivered" });
  const state = stateOf("partly-answered", [
    delivered("region"),
    answeredAs("payment"),
    { itemId: "analytics", rev: 1, state: "open" },
    { itemId: "rollout", rev: 1, state: "open" },
    { itemId: "erp-export", rev: 1, state: "postponed" },
  ]);

  test("the receipt of the logged answer is the state: Sent is not Delivered", () => {
    expect(markOf("region", state, noWork, none)).toBe("delivered");
    expect(markOf("payment", state, noWork, none)).toBe("sent");
  });

  test("a command that queued is Not sent yet, a settled or unsettled one is not", () => {
    const queued: Ladder = { ...none, flightOf: () => ({ outcome: "queued" }) };
    const sending: Ladder = { ...none, flightOf: () => ({ outcome: undefined }) };
    const sent: Ladder = { ...none, flightOf: () => ({ outcome: "sent" }) };
    expect(markOf("analytics", state, noWork, queued)).toBe("not-sent-yet");
    expect(markOf("analytics", state, noWork, sending)).toBe("todo");
    expect(markOf("analytics", state, noWork, sent)).toBe("todo");
  });

  test("answer work on an open question is a draft; none is to do", () => {
    expect(markOf("analytics", state, noWork, revisingOnly("analytics"))).toBe("draft");
    expect(markOf("analytics", state, noWork, none)).toBe("todo");
  });

  test("an answered question under revision reads Draft, never Delivered or Sent", () => {
    const own = revisingOnly("region", "payment");
    expect(markOf("region", state, noWork, own)).toBe("draft");
    expect(markOf("payment", state, noWork, own)).toBe("draft");
  });

  test("a held answer is Ready whatever the receipt, a held act over a revision decides first", () => {
    const work = held([["region", { act: "answer", order: 0 }]]);
    expect(markOf("region", state, work, revisingOnly("region"))).toBe("ready");
  });

  test("the count to do is to do, draft and postponed; a revision and a ready question are not counted", () => {
    const own = revisingOnly("region", "analytics");
    // region: a revision (draft, not counted); analytics: a first draft (counted); rollout: to do;
    // erp-export: postponed (counted); payment: sent.
    expect(openCountOf(lifecycleBoardDocument, state, noWork, own)).toBe(3);
    const ready = held([["rollout", { act: "answer", order: 0 }]]);
    expect(openCountOf(lifecycleBoardDocument, state, ready, own)).toBe(2);
  });

  test("a reopened question being edited is a first draft: it reads Draft and counts as to do", () => {
    const declined = stateOf("partly-answered", [
      {
        itemId: "region",
        rev: 1,
        state: "declined",
        answer: { declined: true, when, receipt: "sent" },
      },
      answeredAs("payment"),
      ...["analytics", "rollout", "erp-export"].map((itemId) => ({
        itemId,
        rev: 1,
        state: "open",
      })),
    ]);
    const own = revisingOnly("region", "payment");
    // A revision with no undo is not counted: three to do (analytics, rollout, erp-export).
    expect(isOpen("region", declined, noWork, own)).toBe(false);
    expect(openCountOf(lifecycleBoardDocument, declined, noWork, own)).toBe(3);
    // The undo held (a decline's reopen), the option selected: a first draft, one more to do.
    const reopened = held([["region", { act: "reopen", order: 0 }]]);
    expect(markOf("region", declined, reopened, own)).toBe("draft");
    expect(isOpen("region", declined, reopened, own)).toBe(true);
    expect(openCountOf(lifecycleBoardDocument, declined, reopened, own)).toBe(4);
    // The same for a logged answer and a held undo beneath another work (`undone`).
    const undone = new Map<string, QuestionWork>([
      ["payment", { rev: 1, undo: { act: "reopen", order: 0 } }],
    ]);
    expect(markOf("payment", declined, undone, own)).toBe("draft");
    expect(isOpen("payment", declined, undone, own)).toBe(true);
    expect(openCountOf(lifecycleBoardDocument, declined, undone, own)).toBe(4);
  });

  test("a reopen on its way keeps the edited question to do", () => {
    const reopening: Ladder = {
      flightOf: (id) => (id === "payment" ? { outcome: "sent", act: "reopen" } : undefined),
      revisingOf: (id) => id === "payment",
    };
    expect(markOf("payment", state, noWork, reopening)).toBe("draft");
    expect(isOpen("payment", state, noWork, reopening)).toBe(true);
  });

  test("a revision is never a next-question target; a first draft is", () => {
    const own = revisingOnly("region", "analytics");
    expect(nextOpenOrder(lifecycleBoardDocument, state, noWork, own, new Set())).toEqual([
      "analytics",
      "rollout",
      "erp-export",
    ]);
    expect(isOpen("region", state, noWork, own)).toBe(false);
    expect(isOpen("analytics", state, noWork, own)).toBe(true);
  });

  test("a tab's count follows the same rule", () => {
    const [scope, delivery] = lifecycleBoardDocument.items as unknown as readonly [
      ViewArea,
      ViewArea,
    ];
    // Scope holds region (a revision, not counted), payment (sent) and analytics (a first draft).
    const own = revisingOnly("region", "analytics");
    expect(tabOpenCount(scope, state, noWork, own)).toBe(1);
    expect(tabOpenCount(delivery, state, noWork, own)).toBe(2);
  });

  test("each state has its label in both languages, the receipt's words for the three it gave", () => {
    const states = [
      "todo",
      "draft",
      "ready",
      "not-sent-yet",
      "sent",
      "delivered",
      "postponed",
      "declined",
    ] as const;
    expect(states.map((mark) => markLabel(mark))).toEqual([
      "To do",
      "Draft",
      "Ready, not sent",
      "Not sent yet",
      "Sent",
      "Delivered to the agent",
      "Postponed",
      "Declined",
    ]);
    expect(states.map((mark) => markLabel(mark, "it-IT"))).toEqual([
      "Da fare",
      "Bozza",
      "Pronta, non inviata",
      "Non ancora inviata",
      "Inviata",
      "Consegnata all'agente",
      "Rimandata",
      "Rifiutata",
    ]);
  });
});

describe("the next-open jump (EXPERIENCE.md, Next-open jump)", () => {
  test("new questions first, then open ones in board order", () => {
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "open" },
      answeredAs("payment"),
      { itemId: "analytics", rev: 1, state: "postponed" },
      { itemId: "rollout", rev: 1, state: "open" },
      { itemId: "erp-export", rev: 1, state: "open" },
    ]);
    expect(
      nextOpenOrder(lifecycleBoardDocument, state, noWork, none, new Set(["rollout"])),
    ).toEqual(["rollout", "region", "analytics", "erp-export"]);
    const work = held([["region", { act: "answer", order: 0 }]]);
    expect(nextOpenOrder(lifecycleBoardDocument, state, work, none, new Set())).toEqual([
      "analytics",
      "rollout",
      "erp-export",
    ]);
  });
});

describe("the jump from the question in view (EXPERIENCE.md, Question navigator)", () => {
  const state = stateOf("partly-answered", [
    answeredAs("region"),
    { itemId: "payment", rev: 1, state: "open" },
    answeredAs("analytics"),
    answeredAs("rollout"),
    { itemId: "erp-export", rev: 1, state: "open" },
  ]);

  test("forward from the question in view, wrapping to the start (question 4 of 5: 5, then 2)", () => {
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, none, new Set(), "rollout")).toBe(
      "erp-export",
    );
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, none, new Set(), "erp-export")).toBe(
      "payment",
    );
  });

  test("an unseen question the agent added first; the first open one when none is in view", () => {
    expect(
      nextOpenFrom(lifecycleBoardDocument, state, noWork, none, new Set(["erp-export"]), "region"),
    ).toBe("erp-export");
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, none, new Set(), undefined)).toBe(
      "payment",
    );
  });

  test("none open, or only the one in view: nowhere to go", () => {
    const done = stateOf(
      "answered",
      ids.map((id) => answeredAs(id)),
    );
    expect(
      nextOpenFrom(lifecycleBoardDocument, done, noWork, none, new Set(), "region"),
    ).toBeUndefined();
    const one = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "open" },
      ...ids.slice(1).map((id) => answeredAs(id)),
    ]);
    expect(
      nextOpenFrom(lifecycleBoardDocument, one, noWork, none, new Set(), "region"),
    ).toBeUndefined();
  });
});

describe("one question per view when the agent deletes the question in view (F-55; task 6.7)", () => {
  test("it moves on to the next question still on the board, else to the one before", () => {
    const before = ["q1", "q2", "q3", "q4"];
    expect(nextAfterRemoval(before, ["q1", "q3", "q4"], "q2")).toBe("q3");
    expect(nextAfterRemoval(before, ["q1", "q4"], "q2")).toBe("q4");
    expect(nextAfterRemoval(before, ["q1", "q2", "q3"], "q4")).toBe("q3");
    expect(nextAfterRemoval(before, [], "q4")).toBeUndefined();
  });
});

describe("an ended ask", () => {
  // Review F-18: a closed or discarded ask looks closed; a board moved to another tab is only locked.
  test("is a closed or a discarded lock, nothing else", () => {
    expect(endedOf("closed")).toBe(true);
    expect(endedOf("discarded")).toBe(true);
    expect(endedOf("moved")).toBe(false);
    expect(endedOf(undefined)).toBe(false);
  });
});

describe("previousOpenFrom (board-keys, design decision 3; mirrors nextOpenFrom)", () => {
  // Open: region, payment and rollout (1, 2 and 4 of ids' first four); the rest answered.
  const state = stateOf("partly-answered", [
    { itemId: "region", rev: 1, state: "open" },
    { itemId: "payment", rev: 1, state: "open" },
    answeredAs("analytics"),
    { itemId: "rollout", rev: 1, state: "open" },
    answeredAs("erp-export"),
  ]);
  const from = (current: string | undefined, s = state) =>
    previousOpenFrom(lifecycleBoardDocument, s, noWork, none, current);

  test("from question 4 with 1, 2 and 4 open, the question 2", () => {
    expect(from("rollout")).toBe("payment");
  });

  test("from a question that is not open, the open one before it", () => {
    expect(from("erp-export")).toBe("rollout");
    expect(from("analytics")).toBe("payment");
  });

  test("from the first open question, wrapping to the last", () => {
    expect(from("region")).toBe("rollout");
  });

  test("with no question in view, the last open question", () => {
    expect(from(undefined)).toBe("rollout");
  });

  test("never the question in view, and none when no other is open", () => {
    const one = stateOf("partly-answered", [
      { itemId: "payment", rev: 1, state: "open" },
      ...ids.filter((id) => id !== "payment").map((id) => answeredAs(id)),
    ]);
    expect(from("payment", one)).toBeUndefined();
    const done = stateOf(
      "answered",
      ids.map((id) => answeredAs(id)),
    );
    expect(from("region", done)).toBeUndefined();
    expect(from(undefined, done)).toBeUndefined();
  });

  test("the order is the board's: unseen questions get no priority, unlike the jump forward", () => {
    // Forward, an unseen question the agent added comes first; backward, only board order counts.
    const unseen = new Set(["rollout"]);
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, none, unseen, "payment")).toBe(
      "rollout",
    );
    expect(previousOpenFrom(lifecycleBoardDocument, state, noWork, none, "rollout")).toBe(
      "payment",
    );
    expect(previousOpenFrom(lifecycleBoardDocument, state, noWork, none, "payment")).toBe("region");
  });
});
