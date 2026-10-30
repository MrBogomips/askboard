// The single-question board in the view (EXPERIENCE.md, Presentations): the header and the
// question card, with no outline navigator, counts, delivery switch or Submit. It renders from the
// board document and the board state, which the board page replaces after boot.

import type { BoardDocument, BoardState } from "@askboard/contract";
import { useSyncExternalStore } from "react";
import { BoardHeader } from "./board-header.tsx";
import { type CardContext, QuestionCard } from "./question-card.tsx";
import type { Store } from "./store.ts";

export const Board = ({
  document,
  state,
  context,
}: {
  readonly document: BoardDocument;
  readonly state: Store<BoardState>;
  readonly context: CardContext;
}) => {
  const current = useSyncExternalStore(state.subscribe, state.get);
  return (
    <div className="flex min-h-screen flex-col">
      <BoardHeader title={document.title} ask={current.ask} />
      <main className="flex flex-col gap-4 p-4">
        {document.items.map((question) => (
          <QuestionCard key={question.id} question={question} state={current} context={context} />
        ))}
      </main>
    </div>
  );
};
