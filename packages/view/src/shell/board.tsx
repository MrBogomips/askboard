// The single-question board in the view (EXPERIENCE.md, Presentations): the header and the
// question card, with no outline navigator, counts, delivery switch or Submit. It renders from the
// board document and what the board page last sent: the board state, the lock, which makes the
// board read-only while it moved and once it is discarded (AD-21), and the answers it holds.

import type { BoardState } from "@askboard/contract";
import { useSyncExternalStore } from "react";
import type { ViewDocument } from "../view-document.ts";
import type { PendingAnswer, ViewLock } from "../view-protocol.ts";
import { BoardHeader } from "./board-header.tsx";
import { type CardContext, QuestionCard } from "./question-card.tsx";
import type { Store } from "./store.ts";

/** What the board page last told the view. */
export type BoardView = {
  readonly state: BoardState;
  readonly lock?: ViewLock | undefined;
  readonly pending?: readonly PendingAnswer[] | undefined;
};

export const Board = ({
  document,
  view,
  context,
}: {
  readonly document: ViewDocument;
  readonly view: Store<BoardView>;
  readonly context: CardContext;
}) => {
  const { state, lock, pending } = useSyncExternalStore(view.subscribe, view.get);
  return (
    <div className="flex min-h-screen flex-col">
      <BoardHeader title={document.title} ask={lock === "discarded" ? "discarded" : state.ask} />
      <main className="flex flex-col gap-4 p-4">
        {document.items.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            state={state}
            locked={lock !== undefined}
            held={pending?.find((answer) => answer.itemId === question.id)}
            context={context}
          />
        ))}
      </main>
    </div>
  );
};
