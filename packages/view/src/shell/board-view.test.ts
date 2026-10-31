import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState } from "@askboard/contract";
import { lifecycleBoardDocument, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ViewArea, ViewDocument } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import {
  askPillOf,
  groupsOf,
  markOf,
  nextAfterRemoval,
  nextOpenFrom,
  nextOpenOrder,
  openCountOf,
  postponedWarningOf,
  presentationOf,
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
    expect(openCountOf(lifecycleBoardDocument, state, noWork)).toBe(3);
    const work = held([
      ["region", { act: "answer", order: 0 }],
      ["erp-export", { act: "postpone", order: 1 }],
    ]);
    expect(openCountOf(lifecycleBoardDocument, state, work)).toBe(2);
  });

  test("a tab's count is its area's", () => {
    const [scope, delivery] = lifecycleBoardDocument.items as unknown as readonly [
      ViewArea,
      ViewArea,
    ];
    const work = held([["region", { act: "answer", order: 0 }]]);
    expect(tabOpenCount(scope, allOpen, work)).toBe(2);
    expect(tabOpenCount(delivery, allOpen, work)).toBe(2);
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

  test("each question's own mark: unanswered, ready, answered, postponed or declined", () => {
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
    expect(ids.map((id) => markOf(id, state, work))).toEqual([
      "ready",
      "answered",
      "postponed",
      "declined",
      "declined",
    ]);
    expect(markOf("region", allOpen, held([["region", { act: "postpone", order: 0 }]]))).toBe(
      "postponed",
    );
    expect(markOf("region", allOpen, noWork)).toBe("unanswered");
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
    expect(ids.map((id) => markOf(id, state, work))).toEqual([
      "unanswered",
      "ready",
      "unanswered",
      "unanswered",
      "postponed",
    ]);
    expect(openCountOf(lifecycleBoardDocument, state, work)).toBe(4);
    expect(postponedWarningOf(lifecycleBoardDocument, state, work)).toBe(
      "You have 1 postponed question: closing loses this ask",
    );
  });

  test("the postponed warning counts the postponed questions still open", () => {
    expect(postponedWarningOf(lifecycleBoardDocument, allOpen, noWork)).toBeUndefined();
    const state = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "postponed" },
      ...ids.slice(1).map((itemId) => ({ itemId, rev: 1, state: "open" })),
    ]);
    expect(postponedWarningOf(lifecycleBoardDocument, state, noWork)).toBe(
      "You have 1 postponed question: closing loses this ask",
    );
    expect(
      postponedWarningOf(
        lifecycleBoardDocument,
        state,
        held([["payment", { act: "postpone", order: 0 }]]),
      ),
    ).toBe("You have 2 postponed questions: closing loses this ask");
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
    expect(nextOpenOrder(lifecycleBoardDocument, state, noWork, new Set(["rollout"]))).toEqual([
      "rollout",
      "region",
      "analytics",
      "erp-export",
    ]);
    const work = held([["region", { act: "answer", order: 0 }]]);
    expect(nextOpenOrder(lifecycleBoardDocument, state, work, new Set())).toEqual([
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
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, new Set(), "rollout")).toBe(
      "erp-export",
    );
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, new Set(), "erp-export")).toBe(
      "payment",
    );
  });

  test("an unseen question the agent added first; the first open one when none is in view", () => {
    expect(
      nextOpenFrom(lifecycleBoardDocument, state, noWork, new Set(["erp-export"]), "region"),
    ).toBe("erp-export");
    expect(nextOpenFrom(lifecycleBoardDocument, state, noWork, new Set(), undefined)).toBe(
      "payment",
    );
  });

  test("none open, or only the one in view: nowhere to go", () => {
    const done = stateOf(
      "answered",
      ids.map((id) => answeredAs(id)),
    );
    expect(nextOpenFrom(lifecycleBoardDocument, done, noWork, new Set(), "region")).toBeUndefined();
    const one = stateOf("partly-answered", [
      { itemId: "region", rev: 1, state: "open" },
      ...ids.slice(1).map((id) => answeredAs(id)),
    ]);
    expect(nextOpenFrom(lifecycleBoardDocument, one, noWork, new Set(), "region")).toBeUndefined();
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
