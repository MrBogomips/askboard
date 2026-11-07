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
import { AlertDialog } from "radix-ui";
import { Fragment, useRef, useState, useSyncExternalStore } from "react";
import type { ChoiceExtras } from "../catalog/choice/props.ts";
import { type Rendered, renderedOf } from "../catalog/components.ts";
import { questionTextId, type ReasonStrings, useLanguage, useStrings } from "../catalog/port.ts";
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
  answerNeedsReason,
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
import { ContextColumn } from "./context-column.tsx";
import { couldSplit, layoutOf } from "./context-layout.ts";
import { QuestionMarker } from "./markers.tsx";
import type { OpenedSnapshot } from "./opened-snapshot.ts";
import { ActionsRow } from "./question-actions.tsx";
import {
  type CardState,
  cardActions,
  cardState,
  contentOf,
  shownFor,
  shownResultFor,
  statusOf,
} from "./question-state.ts";
import { reasonAskedAfter, reasonOf } from "./reason.ts";
import { type RenderContext, RenderItem } from "./renderer.tsx";
import {
  asksFirst,
  type Confirmation,
  confirmationOf,
  type FocusTarget,
  press,
  settleConfirmation,
} from "./revision-confirm.ts";
import type { Store } from "./store.ts";
import {
  BUTTON_LINK,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CHIP,
  DIALOG,
  FIELD_ERROR,
  FOCUS_RING,
  SECTION_LABEL,
  TEXT_FIELD,
  TEXT_FIELD_INVALID,
} from "./styles.ts";
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
  /** Set when the page is an opened Snapshot: every card is read-only and offers no act. */
  readonly opened?: OpenedSnapshot | undefined;
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

// What the card follows while the board has no results store.
const NO_SUBSCRIPTION = () => () => {};
const NO_RECORD: ReadonlyMap<string, unknown> = new Map();

const noteFieldId = (questionId: string) => `${questionId}:note`;

const focusHeadingOf = (questionId: string) => () =>
  document.getElementById(questionTextId(questionId))?.focus();

// What the card shows, from the stores it follows: its loading, its work, its commands and the
// agent's changes under the work.
const useCard = ({ question, state, lock, context }: CardProps) => {
  const { tracker, draft, results, acts, board, kept, revisions } = context;
  const language = useLanguage();
  const load = useSyncExternalStore(tracker.subscribe, () => tracker.questionStatus(question.id));
  const values = useSyncExternalStore(draft.subscribe, draft.record);
  const heldResults = useSyncExternalStore(
    results?.subscribe ?? NO_SUBSCRIPTION,
    () => results?.record() ?? NO_RECORD,
  );
  const work = useSyncExternalStore(board.subscribe, () => board.work(question.id));
  const keptChoices = useSyncExternalStore(kept.subscribe, kept.get);
  const flight = useSyncExternalStore(acts.subscribe, () => acts.of(question.id, CARD_ACTS));
  const followUp = useSyncExternalStore(acts.subscribe, () => acts.of(question.id, ["follow-up"]));
  const choosing = useSyncExternalStore(acts.subscribe, () =>
    acts.of(question.id, ["edit-choice"]),
  );
  const placement = useSyncExternalStore(board.subscribe, () =>
    board.effectivePlacement(question.id),
  );
  const status = statusOf(state, question.id);
  const pending = changePending(question, work, keptChoices);
  // The revision the card works on: the one the work was made on, while it is earlier.
  const shown = workingQuestion(question, work, revisions);
  const heldAct = work?.held?.act;
  const card = cardState({
    status,
    draft: answerContentOf(shown, values, work, heldResults),
    flight,
    load,
    lock,
    ready: heldAct === "answer" || heldAct === "note",
    editing: hasAnswerWork(shown, values, work, heldResults),
    pending,
    language,
  });
  const actions = cardActions({
    status,
    held: heldAct,
    undone: work?.undo !== undefined,
    sending: flight !== undefined,
    load,
    lock,
    pending,
    explaining: explainPending(status?.thread, followUp?.acts ?? [], language),
  });
  return {
    load,
    values,
    results: heldResults,
    work,
    status,
    pending,
    shown,
    card,
    actions,
    followUp,
    choosing,
    placement,
  };
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
}) => {
  const text = useStrings();
  return (
    <div className="flex items-center justify-between gap-md">
      <p className={SECTION_LABEL}>
        {text(question.props.multiSelect === true ? "question.options" : "question.optionsPickOne")}
      </p>
      {question.props.options?.some((option) => option.recommended === true) !== true ? null : (
        <button type="button" className={BUTTON_LINK} disabled={disabled} onClick={onAccept}>
          {text("question.acceptRecommended")}
        </button>
      )}
    </div>
  );
};

// The open prompt (FR-7): one field per question, its text leaving only with an act. While a held
// result requires a reason, its label says so and a press of "Answer" without one shows the field
// error under it (approval-scale-ranking, design decision 6).
const OpenPrompt = ({
  questionId,
  note,
  readOnly,
  reason,
  error,
  onChange,
}: {
  readonly questionId: string;
  readonly note: string;
  readonly readOnly: boolean;
  /** The strings of the reason the answer requires, if it requires one. */
  readonly reason: ReasonStrings | undefined;
  /** Whether the field error shows. */
  readonly error: boolean;
  readonly onChange: (text: string) => void;
}) => {
  const text = useStrings();
  const errorId = `${noteFieldId(questionId)}:error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={noteFieldId(questionId)} className="text-body text-foreground-secondary">
        {text(reason?.label ?? "question.note")}
      </label>
      <textarea
        id={noteFieldId(questionId)}
        value={note}
        readOnly={readOnly}
        maxLength={NOTE_MAX_CHARS}
        rows={2}
        aria-required={reason !== undefined}
        aria-invalid={error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={error ? `${TEXT_FIELD} ${TEXT_FIELD_INVALID}` : TEXT_FIELD}
      />
      {error && reason !== undefined ? (
        <p id={errorId} className={FIELD_ERROR}>
          {text(reason.missing)}
        </p>
      ) : null}
    </div>
  );
};

export const QuestionCard = (props: CardProps) => {
  const { question, state, lock, delivery, single, context, level = 2 } = props;
  const Heading = level === 3 ? "h3" : "h2";
  const language = useLanguage();
  const text = useStrings();
  const {
    load,
    values,
    results,
    work,
    status,
    pending,
    shown,
    card,
    actions,
    followUp,
    choosing,
    placement,
  } = useCard(props);
  const section = useRef<HTMLElement>(null);
  useInView(section, question.id, context.attention);
  // The reason the answer requires, if any, and whether a press of "Answer" asked for it.
  const reason = reasonOf(shown, results, card.shown);
  const [reasonAsked, setReasonAsked] = useState(false);
  const noteText = card.shown?.note ?? work?.note ?? "";
  const reasonError = reasonAskedAfter(reasonAsked, reason, noteText);
  // Stored cleared as soon as the note holds a reason or no pair applies: deleting the text later
  // does not bring the error back, only a press that asks does.
  if (reasonAsked && !reasonError) setReasonAsked(false);
  // "Answer" sent nothing for want of the reason: the error shows and focus goes to the prompt.
  const asking = (outcome: "needs-reason" | undefined) => {
    if (outcome === undefined) return;
    setReasonAsked(true);
    document.getElementById(noteFieldId(question.id))?.focus();
  };
  const { header, text: questionText } = shown.props;
  const mark = markOf(question.id, state, context.board.get().questions);
  // An answer or decline names the revision the work was made on; the other acts the current one.
  const acting: AnswerContext = { ...context, delivery };
  const focusHeading = focusHeadingOf(question.id);
  // "Answer" and Decline on a verdict the agent has received wait for the user's confirmation, in
  // a modal dialog (design decision 6): confirming acts as the button does, Cancel changes nothing.
  // The dialog has no trigger, so Radix restores no focus: the confirmation keeps the control
  // pressed, and `onCloseAutoFocus` gives focus to what the user's choice named.
  const [waiting, setWaiting] = useState<Confirmation<HTMLElement> | undefined>();
  const afterClose = useRef<FocusTarget<HTMLElement> | undefined>(undefined);
  const chosen = useRef(false);
  const ask = (act: "answer" | "decline", control: HTMLElement | undefined, run: () => void) => {
    const next = press(asksFirst(act, question, status, work?.held?.act), run);
    chosen.current = false;
    setWaiting(confirmationOf(act, next, control));
    return next === undefined;
  };
  const onAnswer = (control: HTMLElement) => {
    if (answerNeedsReason(question, acting)) return asking("needs-reason");
    ask("answer", control, () => asking(answer(question, acting)));
  };
  const onDecline = (control: HTMLElement | undefined) =>
    ask("decline", control, () => decline(question, status?.state, acting));
  const focusAfterClose = () => {
    const target = afterClose.current;
    afterClose.current = undefined;
    if (target?.to === "heading") focusHeading();
    else if (target?.control.isConnected === true) target.control.focus();
  };
  // The first edit of an answered question starts the revision from its latest answer, once per
  // gesture: a gesture that clears the choice and then chooses "Other…" seeds only before the first.
  // It seeds no widget value: an item the revision leaves alone shows its answer's value through
  // the board (molecules, design decision 11); it seeds the widgets' results, which an answer
  // carries only while the draft holds them (approval-scale-ranking, design decision 6).
  const seeding = useRef(false);
  const revise = () => {
    if (status?.state !== "answered" || seeding.current) return;
    const held = context.results?.record();
    if (hasAnswerWork(shown, context.draft.record(), context.board.work(question.id), held)) return;
    seeding.current = true;
    queueMicrotask(() => {
      seeding.current = false;
    });
    fillFrom(shown, contentOf(status.answer), context);
  };
  const extras = extrasOf(shown, card, work, context.board, revise);
  const opened = context.opened !== undefined;
  const readOnly = opened || card.readOnly;
  const usable = !opened && status !== undefined && load === "visible" && lock === undefined;
  const reopened = status?.state === "open" || status?.state === "postponed" ? status : undefined;
  const layout = layoutOf(renderedOf(shown));
  const placeable = couldSplit(layout.context);
  const split = placeable && placement === "beside";
  const headingOf = (
    <Heading
      id={questionTextId(question.id)}
      tabIndex={-1}
      className={`text-question text-foreground ${FOCUS_RING}`}
    >
      {questionText}
    </Heading>
  );
  const itemsOf = (list: readonly Rendered[]) =>
    list.map(({ item, component }) => (
      <Fragment key={item.id}>
        {item === shown ? (
          <OptionsLabel
            question={shown}
            disabled={readOnly || pending}
            onAccept={() => {
              revise();
              asking(acceptRecommended(shown, acting));
            }}
          />
        ) : null}
        <RenderItem
          item={item}
          component={component}
          questionId={question.id}
          itemIds={itemIdsOf(question)}
          context={context}
          disabled={readOnly}
          shown={shownFor(card.shown, question.id, item.id)}
          shownResult={shownResultFor(card.shown, question.id, item.id)}
          onBeforeChange={revise}
          {...(item === shown ? { extras } : {})}
        />
      </Fragment>
    ));
  const contextColumn = (
    <ContextColumn
      questionId={question.id}
      placement={split ? "beside" : "inline"}
      placeable={placeable}
      onPlace={(next) => context.board.setPlacement(question.id, next)}
    >
      {itemsOf(layout.context)}
    </ContextColumn>
  );
  return (
    <section
      ref={section}
      data-askboard-question={question.id}
      aria-busy={load === "loading"}
      aria-labelledby={questionTextId(question.id)}
      className="flex flex-col gap-md rounded-lg border border-border bg-card p-lg"
    >
      {pending ? (
        <ChangeNotice
          question={question}
          earlier={
            work === undefined ? undefined : context.revisions.question(question.id, work.rev)
          }
          stake={changesLabel(changeCountOf(shown, values, work, results), language)}
          busy={!usable || choosing !== undefined}
          onReload={() => reloadQuestion(question, acting)}
          onKeep={() => keepMine(question, acting)}
        />
      ) : null}
      {reopened?.previous === undefined ? null : (
        <ReopenedNotice
          previous={reopened.previous}
          disabled={readOnly || pending}
          onStart={() => {
            const previous = reopened.previous;
            if (previous !== undefined) fillFrom(question, contentOf(previous), context);
          }}
        />
      )}
      {header === undefined && mark === "unanswered" ? null : (
        <div className="flex items-center gap-sm">
          {mark === "unanswered" ? null : <QuestionMarker mark={mark} />}
          {header === undefined ? null : <span className={CHIP}>{header}</span>}
        </div>
      )}
      {split ? (
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            {headingOf}
            {itemsOf(layout.main)}
          </div>
          {contextColumn}
        </div>
      ) : (
        <>
          {headingOf}
          {layout.context.length === 0 ? null : contextColumn}
          {itemsOf(layout.main)}
        </>
      )}
      {itemsOf(layout.below)}
      {load === "failed" ? null : (
        <>
          <OpenPrompt
            questionId={question.id}
            note={noteText}
            readOnly={readOnly}
            reason={reason}
            error={reasonError}
            onChange={(note) => {
              revise();
              context.board.edit(question.id, question.rev, ({ note: _, ...rest }) =>
                note === "" ? rest : { ...rest, note },
              );
            }}
          />
          <ActionsRow
            opened={opened}
            card={card}
            actions={actions}
            locked={lock !== undefined}
            single={single}
            submitted={!single && delivery === "submitted"}
            onAnswer={onAnswer}
            onPostpone={() => postpone(question, status?.state, acting)}
            onExplain={() => explain(question, acting, language)}
            onDecline={onDecline}
            focusHeading={focusHeading}
          />
          <Thread
            questionId={question.id}
            thread={status?.thread}
            composer={work?.composer ?? ""}
            usable={usable}
            readOnly={opened}
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
      <AlertDialog.Root
        open={waiting !== undefined}
        onOpenChange={(open) => {
          if (open) return;
          // The confirming button has settled it already; Cancel and Escape arrive here.
          if (chosen.current) chosen.current = false;
          else afterClose.current = settleConfirmation(waiting, false);
          setWaiting(undefined);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-30 bg-foreground/30" />
          <AlertDialog.Content
            className={DIALOG}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusAfterClose();
            }}
          >
            <AlertDialog.Title className="text-body-lg font-semibold">
              {text("revision.confirmTitle")}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body text-foreground-secondary">
              {text("revision.confirmBody")}
            </AlertDialog.Description>
            <div className="mt-sm flex justify-end gap-sm">
              <AlertDialog.Cancel className={BUTTON_SECONDARY}>
                {text("revision.confirmCancel")}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={BUTTON_PRIMARY}
                onClick={() => {
                  chosen.current = true;
                  afterClose.current = settleConfirmation(waiting, true);
                  setWaiting(undefined);
                }}
              >
                {text("revision.confirmSend")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
};
