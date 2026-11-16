import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import { type Completion, completionOf, receiptCountsOf, shownCompletionOf } from "./completion.ts";

// The completion panel's model (answering-flow-guidance, design decision 6; requirements
// "Completion", "Completion with postponed questions" and "All ready, nothing sent").
type Receipt = "sent" | "delivered";
type Spec = "open" | "postponed" | `answered:${Receipt}` | `declined:${Receipt}`;

const statusOf = (itemId: string, spec: Spec): LifecycleQuestionStatus => {
  if (spec === "open" || spec === "postponed") return { itemId, rev: 1, state: spec };
  const [state, receipt] = spec.split(":") as ["answered" | "declined", Receipt];
  return {
    itemId,
    rev: 1,
    state,
    answer: {
      when: "2026-11-15T10:00:00Z",
      receipt,
      ...(state === "declined" ? { declined: true } : {}),
    },
  } as LifecycleQuestionStatus;
};

type Board = {
  readonly specs: readonly Spec[];
  readonly work?: Readonly<Record<string, QuestionWork>>;
  readonly flights?: readonly string[];
  readonly revising?: readonly string[];
  readonly ask?: string;
};

const ID = (n: number) => `q${n + 1}`;
const completion = (
  { specs, work = {}, flights = [], revising = [], ask = "partly-answered" }: Board,
  delivery: "immediate" | "submitted" = "immediate",
) => {
  const document = {
    items: specs.map((_, n) => ({ type: "question", id: ID(n), rev: 1, props: { text: ID(n) } })),
  } as unknown as ViewDocument;
  const state = {
    ask,
    questions: specs.map((spec, n) => statusOf(ID(n), spec)),
  } as unknown as LifecycleBoardState;
  return completionOf(
    document,
    state,
    new Map(Object.entries(work)),
    (id) => (flights.includes(id) ? { outcome: "sent" } : undefined),
    (question: ViewQuestion) => revising.includes(question.id),
    delivery,
  );
};
const held = (act: "answer" | "decline" | "postpone" | "note", order = 1): QuestionWork => ({
  rev: 1,
  held: { act, order },
});

describe("none", () => {
  test("while a question is to do, or a draft", () => {
    expect(completion({ specs: ["answered:sent", "open"] })).toEqual({ kind: "none" });
    expect(completion({ specs: ["answered:sent", "open"], revising: ["q2"] })).toEqual({
      kind: "none",
    });
  });

  test("while any act is in flight", () => {
    expect(completion({ specs: ["answered:sent", "answered:sent"], flights: ["q2"] })).toEqual({
      kind: "none",
    });
  });

  test("a board of one question has no panel", () => {
    expect(completion({ specs: ["answered:sent"] })).toEqual({ kind: "none" });
  });

  test("immediate delivery holding an act is no panel either", () => {
    expect(completion({ specs: ["answered:sent", "open"], work: { q2: held("answer") } })).toEqual({
      kind: "none",
    });
  });
});

describe("send-all", () => {
  test("All together, nothing to do, answers held: the count of the held answers", () => {
    expect(
      completion(
        {
          specs: ["open", "open", "answered:sent"],
          work: { q1: held("answer", 1), q2: held("answer", 2) },
        },
        "submitted",
      ),
    ).toEqual({ kind: "send-all", count: 2 });
  });

  test("a held decline or postpone alone also waits for Send, with no answer to count", () => {
    expect(
      completion({ specs: ["open", "answered:sent"], work: { q1: held("decline") } }, "submitted"),
    ).toEqual({ kind: "send-all", count: 0 });
  });

  test("held answers beat postponed questions that remain", () => {
    expect(
      completion({ specs: ["open", "postponed"], work: { q1: held("answer") } }, "submitted"),
    ).toEqual({ kind: "send-all", count: 1 });
  });
});

describe("postponed", () => {
  test("only postponed questions left, nothing held: their count and the first", () => {
    expect(
      completion({ specs: ["answered:sent", "postponed", "declined:sent", "postponed"] }),
    ).toEqual({ kind: "postponed", count: 2, first: "q2" });
  });

  test("a held postpone is held work, not a postponed question yet", () => {
    expect(
      completion({ specs: ["answered:sent", "open"], work: { q2: held("postpone") } }, "submitted"),
    ).toEqual({ kind: "send-all", count: 0 });
  });
});

describe("a revision keeps the panel", () => {
  test("in One by one, a revision in progress keeps done with the logged receipts' counts", () => {
    expect(
      completion({
        specs: ["answered:sent", "answered:delivered", "declined:delivered"],
        revising: ["q2", "q3"],
      }),
    ).toEqual({ kind: "done", sent: 3, delivered: 2 });
  });

  test("a first draft gives none", () => {
    expect(completion({ specs: ["answered:sent", "open", "postponed"], revising: ["q2"] })).toEqual(
      { kind: "none" },
    );
  });

  test("a reopened question being edited gives none: a reopen on its way, or one held", () => {
    // The same board without the reopen keeps the panel (positive case first).
    expect(completion({ specs: ["answered:sent", "answered:sent"], revising: ["q2"] }).kind).toBe(
      "done",
    );
    // A reopen flight: the first rule (any act in flight) already gives none.
    expect(
      completion({ specs: ["answered:sent", "answered:sent"], flights: ["q2"], revising: ["q2"] }),
    ).toEqual({ kind: "none" });
    // A reopen held in All together, the question being edited: a first draft, no panel.
    expect(
      completion(
        {
          specs: ["answered:sent", "declined:sent"],
          work: { q2: { rev: 1, held: { act: "reopen", order: 1 } } },
          revising: ["q2"],
        },
        "submitted",
      ),
    ).toEqual({ kind: "none" });
  });

  test("a held revision in All together gives send-all", () => {
    expect(
      completion(
        {
          specs: ["answered:sent", "answered:delivered"],
          work: { q2: held("answer") },
          revising: ["q2"],
        },
        "submitted",
      ),
    ).toEqual({ kind: "send-all", count: 1 });
  });
});

describe("receiptCountsOf", () => {
  const countsOf = (specs: readonly Spec[]) => {
    const document = {
      items: specs.map((_, n) => ({ type: "question", id: ID(n), rev: 1, props: { text: "x" } })),
    } as unknown as ViewDocument;
    const state = {
      ask: "answered",
      questions: specs.map((spec, n) => statusOf(ID(n), spec)),
    } as unknown as LifecycleBoardState;
    return receiptCountsOf(document, state);
  };

  test("counts the logged receipts, declines and revisions included, open ones not", () => {
    expect(
      countsOf(["answered:sent", "answered:delivered", "declined:delivered", "open", "postponed"]),
    ).toEqual({ sent: 3, delivered: 2 });
  });

  test("a board with nothing logged counts zeros", () => {
    expect(countsOf(["open", "open"])).toEqual({ sent: 0, delivered: 0 });
  });
});

describe("done", () => {
  test("counts sent and delivered from the receipts: delivered ones are sent too", () => {
    expect(
      completion({
        specs: ["answered:sent", "answered:delivered", "answered:delivered"],
      }),
    ).toEqual({ kind: "done", sent: 3, delivered: 2 });
  });

  test("a decline is counted by its receipt", () => {
    expect(
      completion({ specs: ["answered:delivered", "declined:sent", "declined:delivered"] }),
    ).toEqual({ kind: "done", sent: 3, delivered: 2 });
  });

  test("a revision counts its latest receipt", () => {
    expect(completion({ specs: ["answered:sent", "answered:delivered"] })).toEqual({
      kind: "done",
      sent: 2,
      delivered: 1,
    });
  });

  test("never reads the ask: an ask answered with every receipt sent delivers none", () => {
    expect(completion({ specs: ["answered:sent", "answered:sent"], ask: "answered" })).toEqual({
      kind: "done",
      sent: 2,
      delivered: 0,
    });
  });

  test("a held note keeps the panel back", () => {
    expect(
      completion(
        { specs: ["answered:sent", "answered:sent"], work: { q1: held("note") } },
        "submitted",
      ),
    ).toEqual({ kind: "send-all", count: 0 });
  });

  test("a question the state does not hold is to do", () => {
    const document = {
      items: [1, 2].map((n) => ({ type: "question", id: `q${n}`, rev: 1, props: { text: "x" } })),
    } as unknown as ViewDocument;
    const state = {
      ask: "partly-answered",
      questions: [statusOf("q1", "answered:sent")],
    } as unknown as LifecycleBoardState;
    expect(
      completionOf(
        document,
        state,
        new Map(),
        () => undefined,
        () => false,
        "immediate",
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("shownCompletionOf", () => {
  const done: Completion = { kind: "done", sent: 2, delivered: 0 };
  const allReady: Completion = { kind: "send-all", count: 2 };

  test("an open board shows what the receipts say", () => {
    expect(shownCompletionOf(done, { locked: false, snapshot: false })).toBe(done);
    expect(shownCompletionOf(allReady, { locked: false, snapshot: false })).toBe(allReady);
  });

  test("a locked board and an opened Snapshot show none", () => {
    expect(shownCompletionOf(done, { locked: true, snapshot: false })).toEqual({ kind: "none" });
    expect(shownCompletionOf(done, { locked: false, snapshot: true })).toEqual({ kind: "none" });
    expect(shownCompletionOf(allReady, { locked: true, snapshot: true })).toEqual({ kind: "none" });
  });
});
