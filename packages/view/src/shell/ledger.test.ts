import { describe, expect, test } from "bun:test";
import type { LifecycleBoardState, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import type { QuestionWork } from "./board-draft.ts";
import { completionOf } from "./completion.ts";
import { ledgerOf } from "./ledger.ts";

// The outbox ledger (answering-flow-visual, design decision 4).
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
const held = (act: "answer" | "decline" | "postpone" | "note"): QuestionWork => ({
  rev: 1,
  held: { act, order: 1 },
});

const parts = ({
  specs,
  work = {},
  flights = [],
  revising = [],
  ask = "partly-answered",
}: Board) => ({
  document: {
    items: specs.map((_, n) => ({ type: "question", id: ID(n), rev: 1, props: { text: ID(n) } })),
  } as unknown as ViewDocument,
  state: {
    ask,
    questions: specs.map((spec, n) => statusOf(ID(n), spec)),
  } as unknown as LifecycleBoardState,
  work: new Map(Object.entries(work)),
  flightOf: (id: string) => (flights.includes(id) ? ({ outcome: "sent" } as const) : undefined),
  revisingOf: (question: ViewQuestion) => revising.includes(question.id),
});

const ledger = (board: Board, delivery: "immediate" | "submitted" = "submitted") => {
  const p = parts(board);
  return ledgerOf(p.document, p.state, p.work, p.flightOf, p.revisingOf, delivery);
};

describe("the cells", () => {
  test("every ladder state lands in its cell", () => {
    expect(
      ledger({
        specs: ["open", "open", "open", "answered:sent", "answered:delivered", "postponed"],
        work: { q1: held("answer") },
        revising: ["q2"],
      }),
    ).toEqual({ drafts: 1, ready: 1, sent: 2, delivered: 1 });
  });

  test("a decline counts in Sent, and in Delivered once its receipt says so", () => {
    expect(ledger({ specs: ["declined:sent", "declined:delivered", "open"] })).toMatchObject({
      sent: 2,
      delivered: 1,
    });
  });

  test("a question being revised counts in Drafts and in Sent", () => {
    expect(ledger({ specs: ["answered:sent", "open"], revising: ["q1"] })).toMatchObject({
      drafts: 1,
      sent: 1,
    });
  });

  test("Delivered is the receipts', never the ask's state", () => {
    expect(ledger({ specs: ["answered:sent", "answered:sent"], ask: "answered" })).toMatchObject({
      sent: 2,
      delivered: 0,
    });
  });
});

describe("Ready", () => {
  test("undefined in One by one with nothing held", () => {
    expect(ledger({ specs: ["open", "open"] }, "immediate").ready).toBeUndefined();
  });

  test("a number in One by one once something is held, and in All together always", () => {
    expect(ledger({ specs: ["open"], work: { q1: held("postpone") } }, "immediate").ready).toBe(0);
    expect(ledger({ specs: ["open"], work: { q1: held("answer") } }, "immediate").ready).toBe(1);
    expect(ledger({ specs: ["open"] }, "submitted").ready).toBe(0);
  });
});

describe("the panel's counts", () => {
  test("Sent and Delivered equal completionOf's done counts over the same boards", () => {
    const boards: Board[] = [
      { specs: ["answered:sent", "answered:delivered", "declined:sent"] },
      { specs: ["answered:delivered", "declined:delivered"] },
      { specs: ["answered:sent", "answered:sent"], ask: "answered" },
    ];
    for (const board of boards) {
      const p = parts(board);
      const completion = completionOf(
        p.document,
        p.state,
        p.work,
        p.flightOf,
        p.revisingOf,
        "submitted",
      );
      const { sent, delivered } = ledger(board);
      expect(completion).toEqual({ kind: "done", sent, delivered });
    }
  });
});
