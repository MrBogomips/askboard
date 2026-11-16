// The outbox ledger's counts (answering-flow-visual, design decision 4; requirement "The outbox
// ledger"): pure. Drafts and Ready are the ladder's, Sent and Delivered the receipts', the same
// counts the completion panel reports (`receiptCountsOf`, reused). Nothing here reads `state.ask`
// or the ask pill, so the ledger claims nothing the receipts do not (NFR-10, AD-3).

import type { LifecycleBoardState } from "@askboard/contract";
import type { ViewDocument, ViewQuestion } from "../view-document.ts";
import { type FlightOf, ladderCountsOf } from "./answer-state.ts";
import type { Delivery, QuestionWork } from "./board-draft.ts";
import { receiptCountsOf } from "./completion.ts";

export type Ledger = {
  readonly drafts: number;
  /** `undefined` in "One by one" while nothing is held: drawn as "–", described by `ledger.readyOff`. */
  readonly ready: number | undefined;
  readonly sent: number;
  readonly delivered: number;
};

export const ledgerOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => FlightOf | undefined,
  revisingOf: (question: ViewQuestion) => boolean,
  delivery: Delivery,
): Ledger => {
  const { draft, ready } = ladderCountsOf(document, state, work, flightOf, revisingOf);
  const { sent, delivered } = receiptCountsOf(document, state);
  const holding = [...work.values()].some((own) => own.held !== undefined);
  return {
    drafts: draft,
    ready: delivery === "immediate" && !holding ? undefined : ready,
    sent,
    delivered,
  };
};
