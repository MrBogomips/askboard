// The question card (EXPERIENCE.md, Question card, Header chip, Answer, Delivery receipt and
// Question loading; DESIGN.md, Question card): view chrome around the catalog items that show the
// question, in the card's order: header chip, question, the options' section label and the
// options, if it has any, then each widget item at the card's full width (design decision 7),
// then the delivery receipt and "Answer". It carries the question's ID and `aria-busy` until all
// its items are ready (AD-9, SM-C2). "Answer" sends the question's answer at once, its choice and
// each changed widget item's full value, stamped with the time of the click, as on the
// single-question board (FR-22, AD-20); the card is then read-only, at "not sent yet" while the
// board page holds the answer for a reconnect, until the answer is logged, or open again if the
// board page drops it (`answer-acts.ts`). A locked board's card is read-only (AD-21). Every agent
// string renders as text (AD-8).

import type { BoardState } from "@askboard/contract";
import { Fragment, useSyncExternalStore } from "react";
import { renderedOf } from "../catalog/components.ts";
import { questionTextId } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import { type AnswerContent, type PendingAnswer, readAnswerReply } from "../view-protocol.ts";
import type { AnswerActs } from "./answer-acts.ts";
import type { ViewChannel } from "./channel.ts";
import {
  answerOf,
  type CardState,
  cardState,
  draftAnswerOf,
  shownFor,
  statusOf,
} from "./question-state.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";

export type CardContext = RenderContext & {
  readonly channel: ViewChannel;
  readonly acts: AnswerActs;
};

const CHIP =
  "self-start rounded-md border border-border bg-muted px-1.5 py-0.5 text-badge " +
  "text-foreground-secondary";

// `button-answer` on a single-question board: the board's only primary (DESIGN.md, Answer).
const ANSWER =
  "h-7 rounded-md bg-primary px-3 text-control text-primary-foreground enabled:hover:bg-primary-hover " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50";

type CardProps = {
  readonly question: ViewQuestion;
  readonly state: BoardState;
  readonly locked: boolean;
  /** The answer the board page holds for this question, if any. */
  readonly held: PendingAnswer | undefined;
  readonly context: CardContext;
};

// What the card shows, from the stores it follows: its loading, its draft answer and its act.
const useCard = ({ question, state, locked, held, context }: CardProps) => {
  const { tracker, draft, acts } = context;
  const load = useSyncExternalStore(tracker.subscribe, () => tracker.questionStatus(question.id));
  const answer = draftAnswerOf(question, useSyncExternalStore(draft.subscribe, draft.record));
  const act = useSyncExternalStore(acts.subscribe, () => acts.of(question.id));
  const card = cardState(statusOf(state, question.id), answer, act, load, locked, held);
  return { load, answer, card };
};

// Sends the answer at once, stamped with the click's time; the act follows the board page's reply.
const sendAnswer = (
  question: ViewQuestion,
  answer: AnswerContent,
  { channel, acts }: CardContext,
): void => {
  const message = answerOf(question, answer, new Date());
  acts.start(question.id, message, message.when);
  channel.send(message).then(
    (reply) => {
      const read = readAnswerReply(reply);
      if (read?.outcome === "sent" || read?.outcome === "queued") {
        acts.replied(question.id, message.when, read.outcome);
        return;
      }
      acts.drop(question.id, message.when);
      const detail = read?.outcome === "refused" ? read.detail : "no reply";
      console.error(`askboard: the board page did not send the answer: ${detail}`);
    },
    (error: unknown) => {
      acts.drop(question.id, message.when);
      console.error("askboard: the answer did not reach the board page:", error);
    },
  );
};

const AnswerRow = ({
  card,
  onAnswer,
}: {
  readonly card: CardState;
  readonly onAnswer: () => void;
}) => (
  <div className="flex items-center justify-end gap-3">
    {card.receipt === undefined ? null : (
      <span className="text-badge text-muted-foreground">{card.receipt}</span>
    )}
    <button type="button" disabled={!card.canAnswer} onClick={onAnswer} className={ANSWER}>
      Answer
    </button>
  </div>
);

// The options' section label, above the options of a question that has any.
const OptionsLabel = ({ multiSelect }: { readonly multiSelect: boolean | undefined }) => (
  <p className="text-label text-muted-foreground uppercase">
    {multiSelect === true ? "Options" : "Options · pick one"}
  </p>
);

export const QuestionCard = (props: CardProps) => {
  const { question, context } = props;
  const { load, answer, card } = useCard(props);
  const { header, text, multiSelect } = question.props;
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
      {renderedOf(question).map(({ item, component }) => (
        <Fragment key={item.id}>
          {item === question ? <OptionsLabel multiSelect={multiSelect} /> : null}
          <RenderItem
            item={item}
            component={component}
            questionId={question.id}
            context={context}
            disabled={card.readOnly}
            shown={shownFor(card.shown, question.id, item.id)}
          />
        </Fragment>
      ))}
      {load === "failed" ? null : (
        <AnswerRow card={card} onAnswer={() => sendAnswer(question, answer, context)} />
      )}
    </section>
  );
};
