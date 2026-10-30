// The question card (EXPERIENCE.md, Question card and Question loading; DESIGN.md, Question card):
// view chrome around the catalog item that shows the question's options. It carries the question's
// ID and shows its loading state (`aria-busy`) until all its items are ready (AD-9, SM-C2).

import type { BoardQuestion } from "@askboard/contract";
import { useSyncExternalStore } from "react";
import { type RenderContext, RenderItem } from "./renderer.tsx";

export const QuestionCard = ({
  question,
  context,
}: {
  readonly question: BoardQuestion;
  readonly context: RenderContext;
}) => {
  const { tracker } = context;
  const status = useSyncExternalStore(tracker.subscribe, () => tracker.questionStatus(question.id));
  return (
    <section
      data-askboard-question={question.id}
      aria-busy={status === "loading"}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <RenderItem item={question} context={context} disabled={status !== "visible"} />
    </section>
  );
};
