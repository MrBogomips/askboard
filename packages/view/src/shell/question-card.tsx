// The question card (EXPERIENCE.md, Question card, Header chip, Answer, Delivery receipt and
// Question loading; DESIGN.md, Question card): view chrome around the catalog item that shows the
// question's options, in the card's order: header chip, question, the options' section label, the
// options, then the delivery receipt and "Answer". It carries the question's ID and `aria-busy`
// until all its items are ready (AD-9, SM-C2). "Answer" sends the question's answer at once,
// stamped with the time of the click, as on the single-question board (FR-22); the card is then
// read-only. Every agent string renders as text (AD-8).

import type { BoardQuestion, BoardState } from "@askboard/contract";
import { useState, useSyncExternalStore } from "react";
import { questionTextId } from "../catalog/port.ts";
import { readAnswerReply } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { type Act, answerOf, cardState, statusOf } from "./question-state.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";

export type CardContext = RenderContext & { readonly channel: ViewChannel };

const CHIP =
  "self-start rounded-md border border-border bg-muted px-1.5 py-0.5 text-badge " +
  "text-foreground-secondary";

// `button-answer` on a single-question board: the board's only primary (DESIGN.md, Answer).
const ANSWER =
  "h-7 rounded-md bg-primary px-3 text-control text-primary-foreground enabled:hover:bg-primary-hover " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50";

export const QuestionCard = ({
  question,
  state,
  context,
}: {
  readonly question: BoardQuestion;
  readonly state: BoardState;
  readonly context: CardContext;
}) => {
  const { tracker, draft, channel } = context;
  const load = useSyncExternalStore(tracker.subscribe, () => tracker.questionStatus(question.id));
  const value = useSyncExternalStore(draft.subscribe, () => draft.valueOf(question.id));
  const [act, setAct] = useState<Act>();
  const card = cardState(statusOf(state, question.id), value, act, load);
  const { header, text, multiSelect } = question.props;

  const answer = () => {
    const message = answerOf(question, value, new Date());
    setAct({ choice: message.choice, when: message.when });
    channel.send(message).then(
      (reply) => {
        const read = readAnswerReply(reply);
        if (read?.outcome === "sent") {
          setAct((current) => (current === undefined ? current : { ...current, outcome: "sent" }));
          return;
        }
        setAct(undefined);
        console.error(`askboard: the board page did not send the answer: ${read?.detail ?? "?"}`);
      },
      (error: unknown) => {
        setAct(undefined);
        console.error("askboard: the answer did not reach the board page:", error);
      },
    );
  };

  return (
    <section
      data-askboard-question={question.id}
      aria-busy={load === "loading"}
      aria-labelledby={questionTextId(question.id)}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      {header === undefined ? null : <span className={CHIP}>{header}</span>}
      <h2 id={questionTextId(question.id)} className="text-question text-foreground">
        {text}
      </h2>
      <p className="text-label text-muted-foreground uppercase">
        {multiSelect === true ? "Options" : "Options · pick one"}
      </p>
      <RenderItem item={question} context={context} disabled={card.readOnly} shown={card.shown} />
      {load === "failed" ? null : (
        <div className="flex items-center justify-end gap-3">
          {card.receipt === undefined ? null : (
            <span className="text-badge text-muted-foreground">{card.receipt}</span>
          )}
          <button type="button" disabled={!card.canAnswer} onClick={answer} className={ANSWER}>
            Answer
          </button>
        </div>
      )}
    </section>
  );
};
