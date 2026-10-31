// What a question card sends (ask-lifecycle, design decision 6; EXPERIENCE.md, Answer, Accept
// recommended, Postpone, Decline, Explain, Follow-up thread, Agent-change notice, Reopened question
// and Interaction Primitives, Delivery): "Answer" sends the question's whole answer at once in
// immediate delivery and on the single-question board, stamped with the time of the click (FR-19,
// FR-22), as the answer view message the seams define; with only the open prompt's text it sends
// that note alone, and the question stays open (FR-7). In submitted delivery it marks the answer,
// or the note alone, ready for Submit, and pressing it again unmarks it (AD-20). "Accept
// recommended" selects the recommended option and acts as "Answer" (FR-3, AD-10). Postpone and
// Decline follow the delivery mode the same way, and pressed again undo: the undo of a sent one
// is a `reopen`, the undo of a held one only changes the draft (FR-4). Follow-ups, Explain's
// included, and the agent-change choices go at once in either mode (FR-10, FR-6). Work kept on an
// earlier revision by "Keep mine" answers that revision. Every command is held by the view's acts
// until the board page settles it; a refused one leaves the work in the draft.

import type { ChoiceOption, HeldAct, LifecycleQuestionStatus } from "@askboard/contract";
import type { ViewQuestion } from "../view-document.ts";
import {
  type AnswerContent,
  readActReply,
  type ViewAct,
  type ViewMessage,
} from "../view-protocol.ts";
import type { AnswerActs } from "./answer-acts.ts";
import {
  answerContentOf,
  type BoardDraft,
  type Delivery,
  itemIdsOf,
  type QuestionWork,
} from "./board-draft.ts";
import type { ViewChannel } from "./channel.ts";
import type { DraftStore } from "./draft-store.ts";
import { answerOf } from "./question-state.ts";

/** Explain's ready-made follow-up (EXPERIENCE.md, Voice and Tone: Question actions). */
export const EXPLAIN = "Why are you asking, and what changes with each option?";

export type Senders = {
  readonly channel: ViewChannel;
  readonly acts: AnswerActs;
};

// Sends a view message for a command the acts hold; the board page's reply settles its start.
const dispatch = ({ channel, acts }: Senders, held: readonly ViewAct[], message: ViewMessage) => {
  const key = acts.start(held);
  channel.send(message).then(
    (reply) => {
      const read = readActReply(reply);
      acts.replied(key, read);
      if (read?.outcome === "refused") {
        console.error(`askboard: the board page did not send the ${message.type}: ${read.detail}`);
      }
    },
    (error: unknown) => {
      acts.drop(key);
      console.error(`askboard: the ${message.type} did not reach the board page:`, error);
    },
  );
};

/** Sends one command of acts at once, in either delivery mode. */
export const sendActs = (senders: Senders, acts: readonly [ViewAct, ...ViewAct[]]): void =>
  dispatch(senders, acts, { type: "act", acts });

/** The order a newly held act takes: after every act held so far (AD-20). */
export const nextHeldOrder = (board: BoardDraft): number =>
  [...board.get().questions.values()].reduce(
    (last, work) => Math.max(last, (work.held?.order ?? -1) + 1),
    0,
  );

export type AnswerContext = Senders & {
  readonly draft: DraftStore;
  readonly board: BoardDraft;
  /** The delivery the question answers in: immediate on a single-question board. */
  readonly delivery: Delivery;
};

/** The act types a card's command holds the card for; follow-ups and edit choices do not. */
export const CARD_ACTS: readonly ViewAct["type"][] = [
  "answer",
  "decline",
  "postpone",
  "reopen",
  "note",
];

/** The question's state as the board last heard it, which Postpone and Decline undo. */
export type QuestionPhase = LifecycleQuestionStatus["state"] | undefined;

/** The revision an answer or decline names: the one the work was made on, kept by "Keep mine". */
export const revisionFor = (question: ViewQuestion, work: QuestionWork | undefined): number =>
  Math.min(work?.rev ?? question.rev, question.rev);

const withoutHeld = ({ held: _, ...work }: QuestionWork): QuestionWork => work;

// Holds the act for Submit, or, when that act is held already, takes it back.
const toggleHeld = (question: ViewQuestion, context: AnswerContext, act: HeldAct["act"]): void => {
  const { board } = context;
  const order = nextHeldOrder(board);
  board.edit(question.id, question.rev, (current) =>
    current.held?.act === act ? withoutHeld(current) : { ...current, held: { act, order } },
  );
};

// Takes back what is held, if anything is.
const unhold = (question: ViewQuestion, board: BoardDraft): void => {
  if (board.work(question.id)?.held !== undefined) {
    board.edit(question.id, question.rev, withoutHeld);
  }
};

const now = () => new Date().toISOString();

/** "Answer": sends, marks ready or unmarks, or sends or holds the note alone (FR-7, FR-22). */
export const answer = (question: ViewQuestion, context: AnswerContext): void => {
  const { draft, board, delivery } = context;
  const work = board.work(question.id);
  const content = answerContentOf(question, draft.record(), work);
  const answers =
    content.choice !== undefined || content.values !== undefined || content.other !== undefined;
  if (!answers) {
    if (content.note === undefined) return;
    if (delivery === "submitted") {
      toggleHeld(question, context, "note");
      return;
    }
    sendActs(context, [
      { type: "note", itemId: question.id, rev: question.rev, note: content.note, when: now() },
    ]);
    return;
  }
  if (delivery === "submitted") {
    toggleHeld(question, context, "answer");
    return;
  }
  const rev = revisionFor(question, work);
  const message = answerOf({ ...question, rev }, content, new Date());
  const { type: _, ...fields } = message;
  dispatch(context, [{ type: "answer", ...fields }], message);
};

/**
 * Postpone, pressed on an open question, or pressed again to undo (FR-4): sent at once in
 * immediate delivery, its undo as a `reopen`; held in submitted delivery, where taking back a held
 * postpone or undo only changes the draft, and the undo of a sent postpone is held as a `reopen`.
 */
export const postpone = (
  question: ViewQuestion,
  phase: QuestionPhase,
  context: AnswerContext,
): void => {
  const held = context.board.work(question.id)?.held?.act;
  if (context.delivery === "submitted") {
    if (held === "postpone" || held === "reopen") unhold(question, context.board);
    else toggleHeld(question, context, phase === "postponed" ? "reopen" : "postpone");
    return;
  }
  sendActs(context, [
    phase === "postponed"
      ? { type: "reopen", itemId: question.id }
      : { type: "postpone", itemId: question.id, rev: question.rev },
  ]);
};

/**
 * Decline, under "More" (FR-4): it closes the question as declined, with the open prompt's text as
 * the reason, and follows the delivery mode; chosen again, it undoes, as Postpone does.
 */
export const decline = (
  question: ViewQuestion,
  phase: QuestionPhase,
  context: AnswerContext,
): void => {
  const { board } = context;
  const work = board.work(question.id);
  const held = work?.held?.act;
  if (context.delivery === "submitted") {
    if (held === "decline" || held === "reopen") unhold(question, board);
    else toggleHeld(question, context, phase === "declined" ? "reopen" : "decline");
    return;
  }
  if (phase === "declined") {
    sendActs(context, [{ type: "reopen", itemId: question.id }]);
    return;
  }
  const note = work?.note;
  sendActs(context, [
    {
      type: "decline",
      itemId: question.id,
      rev: revisionFor(question, work),
      ...(note === undefined || note === "" ? {} : { note }),
      when: now(),
    },
  ]);
};

const followUp = (question: ViewQuestion, text: string): ViewAct => ({
  type: "follow-up",
  itemId: question.id,
  rev: question.rev,
  text,
  when: now(),
});

/** Explain: its ready-made follow-up, at once in either delivery mode (FR-10). */
export const explain = (question: ViewQuestion, context: Senders): void =>
  sendActs(context, [followUp(question, EXPLAIN)]);

/** "Send" in the thread's composer: its text as a follow-up, at once in either mode (FR-10). */
export const sendFollowUp = (question: ViewQuestion, context: AnswerContext): void => {
  const text = context.board.work(question.id)?.composer;
  if (text === undefined || text === "") return;
  sendActs(context, [followUp(question, text)]);
};

/** Drops the question's draft: its items' values and its work, its revision included. */
export const dropWork = (
  question: ViewQuestion,
  { draft, board }: Pick<AnswerContext, "draft" | "board">,
): void => {
  for (const itemId of itemIdsOf(question)) draft.set(itemId, undefined);
  board.forget(question.id);
};

/** "Reload, losing my work": the choice at once, and the question's draft goes (FR-6). */
export const reloadQuestion = (question: ViewQuestion, context: AnswerContext): void => {
  sendActs(context, [
    { type: "edit-choice", itemId: question.id, rev: question.rev, edit: "reload" },
  ]);
  dropWork(question, context);
};

/** "Keep mine": an `ignore` keeping the revision the work was made on, at once (FR-6). */
export const keepMine = (question: ViewQuestion, context: AnswerContext): void => {
  const work = context.board.work(question.id);
  if (work === undefined || work.rev >= question.rev) return;
  sendActs(context, [
    {
      type: "edit-choice",
      itemId: question.id,
      rev: question.rev,
      edit: "ignore",
      keptRev: work.rev,
    },
  ]);
};

/**
 * Fills the question's draft from an answer, as far as the question's revision offers it: its
 * labels, "Other…" text where it is offered, the notes on its labels, and the note, in place of
 * those of the draft; the composer's text stays. Nothing is sent (AD-10): "Start from my previous
 * answer", and the start of a revision.
 */
export const fillFrom = (
  question: ViewQuestion,
  content: AnswerContent,
  { draft, board }: Pick<AnswerContext, "draft" | "board">,
): void => {
  const labels = new Set((question.props.options ?? []).map((option) => option.label));
  const choice = (content.choice ?? []).filter((label) => labels.has(label));
  const notes = Object.entries(content.optionNotes ?? {}).filter(([label]) => labels.has(label));
  const other = question.props.allowOther === true ? content.other : undefined;
  draft.set(question.id, choice.length === 0 ? undefined : choice);
  board.edit(question.id, question.rev, ({ other: _o, optionNotes: _n, note: _t, ...rest }) => ({
    ...rest,
    ...(other === undefined ? {} : { other }),
    ...(notes.length === 0 ? {} : { optionNotes: Object.fromEntries(notes) }),
    ...(content.note === undefined ? {} : { note: content.note }),
  }));
};

/** The question's recommended option, if the agent marked one (FR-3). */
export const recommendedOf = (question: ViewQuestion): ChoiceOption | undefined =>
  question.props.options?.find((option) => option.recommended === true);

/**
 * "Accept recommended": selects the recommended option, as the only one on a single choice (which
 * clears "Other…") or beside the others on a multiple one, and acts as "Answer" (L186).
 */
export const acceptRecommended = (question: ViewQuestion, context: AnswerContext): void => {
  const recommended = recommendedOf(question);
  if (recommended === undefined) return;
  const { draft, board } = context;
  if (question.props.multiSelect === true) {
    const chosen = draft.valueOf(question.id);
    const labels = new Set(Array.isArray(chosen) ? chosen : []);
    labels.add(recommended.label);
    const options = question.props.options ?? [];
    draft.set(
      question.id,
      options.map((option) => option.label).filter((label) => labels.has(label)),
    );
  } else {
    draft.set(question.id, [recommended.label]);
    board.clear(question.id, ["other"]);
  }
  const held = board.work(question.id)?.held;
  if (held?.act === "answer") board.clear(question.id, ["held"]);
  answer(question, context);
};
