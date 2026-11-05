// The question card (EXPERIENCE.md, Question card, Header chip, Answer, Delivery receipt, Question
// loading, Postpone, More, Decline, Explain, Follow-up thread, Agent-change notice and Reopened
// question; DESIGN.md, Question card): view chrome around the catalog items that show the
// question, in the card's order: the notices, the question's marker and header chip, the question,
// the options' section label with "Accept recommended" and the options, if it has any, then each
// widget item at the card's full width (design decision 7), then the open prompt, the question
// actions (Postpone and "More" with Explain and Decline; the delivery receipt and "Answer") and the
// follow-up thread (ask-lifecycle, design decision 6). It carries the question's ID and `aria-busy`
// until all its items are ready (AD-9, SM-C2). Choosing, typing and noting only fill the draft; the
// acts go as `card-acts.ts` says. An answered question stays editable while the ask is open: the
// first edit starts a revision from the latest answer (task 6.7). Work made on a revision the agent
// has since changed stays on that revision, under the agent-change notice, until the user chooses;
// "Keep mine" keeps the card on it, and the answer names it (FR-6). The card is read-only while its
// command is sent and on a locked board, whose draft stays visible and selectable (AD-21, FR-6,
// F-17). Every agent string renders as text (AD-8).

import { type LifecycleBoardState, NOTE_MAX_CHARS } from "@askboard/contract";
import { Fragment, useRef, useSyncExternalStore } from "react";
import type { ChoiceExtras } from "../catalog/choice/props.ts";
import { renderedOf } from "../catalog/components.ts";
import { questionTextId } from "../catalog/port.ts";
import type { ViewQuestion } from "../view-document.ts";
import type { ViewLock } from "../view-protocol.ts";
import {
  changeCountOf,
  changePending,
  changesLabel,
  type KeptChoices,
  type Revisions,
  workingQuestion,
} from "./agent-change.ts";
import type { AnswerActs } from "./answer-acts.ts";
import { type Attention, useInView } from "./attention.ts";
import {
  answerContentOf,
  type BoardDraft,
  type Delivery,
  hasAnswerWork,
  itemIdsOf,
  type QuestionWork,
} from "./board-draft.ts";
import { markOf } from "./board-view.ts";
import {
  type AnswerContext,
  acceptRecommended,
  answer,
  CARD_ACTS,
  decline,
  explain,
  fillFrom,
  keepMine,
  postpone,
  reloadQuestion,
  sendFollowUp,
} from "./card-acts.ts";
import { ChangeNotice, ReopenedNotice } from "./change-notice.tsx";
import type { ViewChannel } from "./channel.ts";
import { QuestionMarker } from "./markers.tsx";
import { ActionsRow } from "./question-actions.tsx";
import {
  type CardState,
  cardActions,
  cardState,
  contentOf,
  shownFor,
  statusOf,
} from "./question-state.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";
import type { Store } from "./store.ts";
import { BUTTON_LINK, CHIP, FOCUS_RING, SECTION_LABEL, TEXT_FIELD } from "./styles.ts";
import { Thread, type ThreadRequests } from "./thread.tsx";
import { explainPending } from "./thread-text.ts";

export type CardContext = RenderContext & {
  readonly channel: ViewChannel;
  readonly acts: AnswerActs;
  readonly board: BoardDraft;
  readonly attention: Attention;
  /** Each question's revisions the view has seen (task 6.7). */
  readonly revisions: Revisions;
  /** "Keep mine" choices the board page settled as done (task 6.7). */
  readonly kept: Store<KeptChoices>;
  /** Requests to open a question's thread at its latest reply (task 6.5). */
  readonly threads: ThreadRequests;
};

type CardProps = {
  readonly question: ViewQuestion;
  readonly state: LifecycleBoardState;
  readonly lock: ViewLock | undefined;
  /** The board's delivery mode: immediate on a single-question board. */
  readonly delivery: Delivery;
  /** The single-question board, whose "Answer" is its only primary. */
  readonly single: boolean;
  /** The question's heading level: 3 under an area's heading. */
  readonly level?: 2 | 3;
  readonly context: CardContext;
};

const NOTE_LABEL = "Note for the agent (optional)";

const noteFieldId = (questionId: string) => `${questionId}:note`;

const focusHeadingOf = (questionId: string) => () =>
  document.getElementById(questionTextId(questionId))?.focus();

// What the card shows, from the stores it follows: its loading, its work, its commands and the
// agent's changes under the work.
const useCard = ({ question, state, lock, context }: CardProps) => {
  const { tracker, draft, acts, board, kept, revisions } = context;
  const load = useSyncExternalStore(tracker.subscribe, () => tracker.questionStatus(question.id));
  const values = useSyncExternalStore(draft.subscribe, draft.record);
  const work = useSyncExternalStore(board.subscribe, () => board.work(question.id));
  const keptChoices = useSyncExternalStore(kept.subscribe, kept.get);
  const flight = useSyncExternalStore(acts.subscribe, () => acts.of(question.id, CARD_ACTS));
  const followUp = useSyncExternalStore(acts.subscribe, () => acts.of(question.id, ["follow-up"]));
  const choosing = useSyncExternalStore(acts.subscribe, () =>
    acts.of(question.id, ["edit-choice"]),
  );
  const status = statusOf(state, question.id);
  const pending = changePending(question, work, keptChoices);
  // The revision the card works on: the one the work was made on, while it is earlier.
  const shown = workingQuestion(question, work, revisions);
  const held = work?.held?.act;
  const card = cardState({
    status,
    draft: answerContentOf(shown, values, work),
    flight,
    load,
    lock,
    ready: held === "answer" || held === "note",
    editing: hasAnswerWork(shown, values, work),
    pending,
  });
  const actions = cardActions({
    status,
    held,
    undone: work?.undo !== undefined,
    sending: flight !== undefined,
    load,
    lock,
    pending,
    explaining: explainPending(status?.thread, followUp?.acts ?? []),
  });
  return { load, values, work, status, pending, shown, card, actions, followUp, choosing };
};

// Choice's extras: the shown answer's or the draft's "Other…" text and option notes, with the
// setters into the draft, which first start a revision on an answered question.
const extrasOf = (
  question: ViewQuestion,
  card: CardState,
  work: QuestionWork | undefined,
  board: BoardDraft,
  revise: () => void,
): ChoiceExtras => {
  const { id, rev } = question;
  const from =
    card.shown !== undefined
      ? { other: card.shown.other, optionNotes: card.shown.optionNotes ?? {} }
      : { other: work?.other, optionNotes: work?.optionNotes ?? {} };
  return {
    ...from,
    onOtherChange: (other) => {
      revise();
      board.edit(id, rev, ({ other: _, ...rest }) =>
        other === undefined ? rest : { ...rest, other },
      );
    },
    onOptionNoteChange: (label, note) => {
      revise();
      board.edit(id, rev, ({ optionNotes = {}, ...rest }) => {
        const kept = Object.entries(optionNotes).filter(([each]) => each !== label);
        const notes = Object.fromEntries(note === undefined ? kept : [...kept, [label, note]]);
        return Object.keys(notes).length === 0 ? rest : { ...rest, optionNotes: notes };
      });
    },
  };
};

// The options' section label, with "Accept recommended" at its right end on a question that has a
// recommendation (DESIGN.md, Accept recommended).
const OptionsLabel = ({
  question,
  disabled,
  onAccept,
}: {
  readonly question: ViewQuestion;
  readonly disabled: boolean;
  readonly onAccept: () => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <p className={SECTION_LABEL}>
      {question.props.multiSelect === true ? "Options" : "Options · pick one"}
    </p>
    {question.props.options?.some((option) => option.recommended === true) !== true ? null : (
      <button type="button" className={BUTTON_LINK} disabled={disabled} onClick={onAccept}>
        Accept recommended
      </button>
    )}
  </div>
);

// The open prompt (FR-7): one field per question, its text leaving only with an act.
const OpenPrompt = ({
  questionId,
  note,
  readOnly,
  onChange,
}: {
  readonly questionId: string;
  readonly note: string;
  readonly readOnly: boolean;
  readonly onChange: (text: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={noteFieldId(questionId)} className="text-body text-foreground-secondary">
      {NOTE_LABEL}
    </label>
    <textarea
      id={noteFieldId(questionId)}
      value={note}
      readOnly={readOnly}
      maxLength={NOTE_MAX_CHARS}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
      className={TEXT_FIELD}
    />
  </div>
);

export const QuestionCard = (props: CardProps) => {
  const { question, state, lock, delivery, single, context, level = 2 } = props;
  const Heading = level === 3 ? "h3" : "h2";
  const { load, values, work, status, pending, shown, card, actions, followUp, choosing } =
    useCard(props);
  const section = useRef<HTMLElement>(null);
  useInView(section, question.id, context.attention);
  const { header, text } = shown.props;
  const mark = markOf(question.id, state, context.board.get().questions);
  // An answer or decline names the revision the work was made on; the other acts the current one.
  const acting: AnswerContext = { ...context, delivery };
  const focusHeading = focusHeadingOf(question.id);
  // The first edit of an answered question starts the revision from its latest answer, once per
  // gesture: a gesture that clears the choice and then chooses "Other…" seeds only before the first.
  // It seeds no widget value: an item the revision leaves alone shows its answer's value through
  // the board (molecules, design decision 11).
  const seeding = useRef(false);
  const revise = () => {
    if (status?.state !== "answered" || seeding.current) return;
    if (hasAnswerWork(shown, context.draft.record(), context.board.work(question.id))) return;
    seeding.current = true;
    queueMicrotask(() => {
      seeding.current = false;
    });
    fillFrom(shown, contentOf(status.answer), context);
  };
  const extras = extrasOf(shown, card, work, context.board, revise);
  const usable = status !== undefined && load === "visible" && lock === undefined;
  const reopened = status?.state === "open" || status?.state === "postponed" ? status : undefined;
  return (
    <section
      ref={section}
      data-askboard-question={question.id}
      aria-busy={load === "loading"}
      aria-labelledby={questionTextId(question.id)}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      {pending ? (
        <ChangeNotice
          question={question}
          earlier={
            work === undefined ? undefined : context.revisions.question(question.id, work.rev)
          }
          stake={changesLabel(changeCountOf(shown, values, work))}
          busy={!usable || choosing !== undefined}
          onReload={() => reloadQuestion(question, acting)}
          onKeep={() => keepMine(question, acting)}
        />
      ) : null}
      {reopened?.previous === undefined ? null : (
        <ReopenedNotice
          previous={reopened.previous}
          disabled={card.readOnly || pending}
          onStart={() => {
            const previous = reopened.previous;
            if (previous !== undefined) fillFrom(question, contentOf(previous), context);
          }}
        />
      )}
      {header === undefined && mark === "unanswered" ? null : (
        <div className="flex items-center gap-2">
          {mark === "unanswered" ? null : <QuestionMarker mark={mark} />}
          {header === undefined ? null : <span className={CHIP}>{header}</span>}
        </div>
      )}
      <Heading
        id={questionTextId(question.id)}
        tabIndex={-1}
        className={`text-question text-foreground ${FOCUS_RING}`}
      >
        {text}
      </Heading>
      {renderedOf(shown).map(({ item, component }) => (
        <Fragment key={item.id}>
          {item === shown ? (
            <OptionsLabel
              question={shown}
              disabled={card.readOnly || pending}
              onAccept={() => {
                revise();
                acceptRecommended(shown, acting);
              }}
            />
          ) : null}
          <RenderItem
            item={item}
            component={component}
            questionId={question.id}
            itemIds={itemIdsOf(question)}
            context={context}
            disabled={card.readOnly}
            shown={shownFor(card.shown, question.id, item.id)}
            onBeforeChange={revise}
            {...(item === shown ? { extras } : {})}
          />
        </Fragment>
      ))}
      {load === "failed" ? null : (
        <>
          <OpenPrompt
            questionId={question.id}
            note={card.shown?.note ?? work?.note ?? ""}
            readOnly={card.readOnly}
            onChange={(note) => {
              revise();
              context.board.edit(question.id, question.rev, ({ note: _, ...rest }) =>
                note === "" ? rest : { ...rest, note },
              );
            }}
          />
          <ActionsRow
            card={card}
            actions={actions}
            locked={lock !== undefined}
            single={single}
            submitted={!single && delivery === "submitted"}
            onAnswer={() => answer(question, acting)}
            onPostpone={() => postpone(question, status?.state, acting)}
            onExplain={() => explain(question, acting)}
            onDecline={() => decline(question, status?.state, acting)}
            focusHeading={focusHeading}
          />
          <Thread
            questionId={question.id}
            thread={status?.thread}
            composer={work?.composer ?? ""}
            usable={usable}
            sending={followUp !== undefined}
            onComposerChange={(composer) =>
              context.board.edit(question.id, question.rev, ({ composer: _, ...rest }) =>
                composer === "" ? rest : { ...rest, composer },
              )
            }
            onSend={() => sendFollowUp(question, acting)}
            requests={context.threads}
          />
        </>
      )}
    </section>
  );
};
