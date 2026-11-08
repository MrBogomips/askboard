// What a question card sends (ask-lifecycle, design decision 6; EXPERIENCE.md, Answer, Accept
// recommended, Postpone, Decline, Explain, Follow-up thread, Agent-change notice, Reopened question
// and Interaction Primitives, Delivery): "Answer" sends the question's whole answer at once in
// immediate delivery and on the single-question board, stamped with the time of the click (FR-19,
// FR-22), as the answer view message the seams define, with the derived values its widget items
// last reported (widget-answers design decision 10); with only the open prompt's text it sends
// that note alone, and the question stays open (FR-7). In submitted delivery it marks the answer,
// or the note alone, ready for Submit, and pressing it again unmarks it (AD-20). "Accept
// recommended" selects the recommended option and acts as "Answer" (FR-3, AD-10). Postpone and
// Decline follow the delivery mode the same way, and pressed again undo: the undo of a sent one
// is a `reopen`, the undo of a held one only changes the draft, in either delivery, so a board
// answering at once never sends a held act its control shows (FR-4, AD-20). An answer, decline or
// note held over the held undo of a sent postpone or decline keeps that undo beneath it, held
// again when the act is taken back. Follow-ups, Explain's
// included, and the agent-change choices go at once in either mode (FR-10, FR-6). Work kept on an
// earlier revision by "Keep mine" answers that revision. Every command is held by the view's acts
// until the board page settles it; a refused one leaves the work in the draft.

import {
  type ChoiceOption,
  type HeldAct,
  type LifecycleQuestionStatus,
  type Locale,
  noteHoldsReason,
} from "@askboard/contract";
import { nestedItemById } from "../nested-items.ts";
import { t } from "../strings/index.ts";
import type { ViewQuestion } from "../view-document.ts";
import {
  type AnswerContent,
  readActReply,
  type ViewAct,
  type ViewMessage,
} from "../view-protocol.ts";
import type { ReadOnlyOf } from "./agent-change.ts";
import type { AnswerActs } from "./answer-acts.ts";
import {
  answerContentOf,
  type BoardDraft,
  type Delivery,
  itemIdsOf,
  type QuestionWork,
  releaseHeld,
  resultFits,
  resultIdsOf,
  valueDropped,
} from "./board-draft.ts";
import {
  cellEntryIdsOf,
  clearCellEntries,
  entriesWithCells,
  fitCellEntries,
} from "./cell-entries.ts";
import type { ViewChannel } from "./channel.ts";
import type { DerivedStore } from "./derived-store.ts";
import type { DraftStore } from "./draft-store.ts";
import { entryIdsOf } from "./entries.ts";
import { holdsBlock } from "./field-block.ts";
import { answerOf } from "./question-state.ts";
import { type FactsOf, reasonOf } from "./reason.ts";
import { asksFirst, press, type Waiting } from "./revision-confirm.ts";
import type { SizeNotices } from "./size-notices.ts";

/** Explain's ready-made follow-up (EXPERIENCE.md, Voice and Tone: Question actions). */
export const EXPLAIN = t("en-US", "question.explainText");

export type Senders = {
  readonly channel: ViewChannel;
  readonly acts: AnswerActs;
  /** The lines for a command the board page refused as too large (oversized-acts). */
  readonly notices?: SizeNotices;
};

/** What sent a command: a card's own act, or the bottom bar's Submit (oversized-acts). */
export type SentVia = "answer" | "submit";

// Sends a view message for a command the acts hold; the board page's reply settles its start. A
// command over the board's message limit comes back refused with its size: each question it named
// shows that nothing was sent, and the work and the held acts stay (oversized-acts, decision 2).
const dispatch = (
  { channel, acts, notices }: Senders,
  held: readonly ViewAct[],
  message: ViewMessage,
  via: SentVia = "answer",
) => {
  const questionIds = [...new Set(held.map((act) => act.itemId))];
  notices?.clear(questionIds);
  const key = acts.start(held);
  channel.send(message).then(
    (reply) => {
      const read = readActReply(reply);
      acts.replied(key, read);
      if (read?.outcome === "refused") {
        console.error(`askboard: the board page did not send the ${message.type}: ${read.detail}`);
        if (read.size !== undefined) notices?.refused(questionIds, read.size, via);
      }
    },
    (error: unknown) => {
      acts.drop(key);
      console.error(`askboard: the ${message.type} did not reach the board page:`, error);
    },
  );
};

/** Sends one command of acts at once, in either delivery mode; `via` marks Submit's. */
export const sendActs = (
  senders: Senders,
  acts: readonly [ViewAct, ...ViewAct[]],
  via: SentVia = "answer",
): void => dispatch(senders, acts, { type: "act", acts }, via);

/** Submit's one command: every act it holds, marked as Submit's so that a refusal says so. */
export const sendSubmit = (senders: Senders, acts: readonly ViewAct[]): void => {
  const [first, ...rest] = acts;
  if (first !== undefined) sendActs(senders, [first, ...rest], "submit");
};

/** The order a newly held act takes: after every act held so far, undos beneath included (AD-20). */
export const nextHeldOrder = (board: BoardDraft): number =>
  [...board.get().questions.values()].reduce(
    (last, work) => Math.max(last, (work.held?.order ?? -1) + 1, (work.undo?.order ?? -1) + 1),
    0,
  );

export type AnswerContext = Senders & {
  readonly draft: DraftStore;
  /** The results the widget items hold, beside the draft record (widget-registry, design decision 9). */
  readonly results?: DraftStore;
  /** The entries the fields hold, beside the draft record (atoms, design decision 3). */
  readonly entries?: DraftStore;
  /** The cell entries the Tables hold, beside the draft record (table-widget, design decision 8). */
  readonly cellEntries?: DraftStore;
  readonly board: BoardDraft;
  /** The derived values each widget item last reported (widget-answers design decision 10). */
  readonly derived: DerivedStore;
  /** The delivery the question answers in: immediate on a single-question board. */
  readonly delivery: Delivery;
  /** The facts of each widget type: whether an item's result requires a reason, and its field check. */
  readonly facts?: FactsOf;
  /**
   * The items of a question the card makes read-only on a revision the board cannot show
   * (`readOnlyItemsOf`); the field block skips them (document-review, design decision 15). None:
   * no item is read-only.
   */
  readonly readOnlyOf?: ReadOnlyOf;
};

/** What "Answer" gave: nothing to report, or that the answer lacks the reason it requires. */
export type AnswerOutcome = "needs-reason" | undefined;

/**
 * The answer with the derived values every computing item of the question last reported (widget-
 * answers design decision 10, FR-12), changed or not, in the order of the question's `itemIds`; no
 * `derived` field when none reported any. They never make an answer: an answer with no choice,
 * value, result or "Other…" text carries none.
 */
export const withDerived = (
  answer: AnswerContent,
  reported: DerivedStore["reported"],
  itemIds: readonly string[],
): AnswerContent => {
  if (
    answer.choice === undefined &&
    answer.values === undefined &&
    answer.results === undefined &&
    answer.other === undefined
  ) {
    return answer;
  }
  const entries = itemIds.flatMap((itemId) => Object.entries(reported(itemId) ?? {}));
  return entries.length === 0 ? answer : { ...answer, derived: Object.fromEntries(entries) };
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

/**
 * Whether an answer of this work names an earlier revision than the question's current one, as
 * after "Keep mine". The board computes derived values on the current revision only, so such an
 * answer carries none (keep-mine-shown-revision, design decision 7; NFR-10, AD-10).
 */
export const namesEarlierRevision = (
  question: ViewQuestion,
  work: QuestionWork | undefined,
): boolean => revisionFor(question, work) < question.rev;

// The acts that carry the question's content, which a held undo of a sent postpone or decline
// stays beneath (AD-20).
const OVER_UNDO: ReadonlySet<HeldAct["act"]> = new Set(["answer", "decline", "note"]);

// Holds the act for Submit, or, when that act is held already, takes it back. An answer, decline
// or note held over the undo of a sent postpone or decline keeps that undo beneath it, held again
// when the act is taken back.
const toggleHeld = (question: ViewQuestion, context: AnswerContext, act: HeldAct["act"]): void => {
  const { board } = context;
  const order = nextHeldOrder(board);
  board.edit(question.id, question.rev, (current) => {
    if (current.held?.act === act) return releaseHeld(current);
    const beneath = current.held?.act === "reopen" ? current.held : current.undo;
    const undo = OVER_UNDO.has(act) ? beneath : undefined;
    const { undo: _, ...rest } = current;
    return { ...rest, ...(undo === undefined ? {} : { undo }), held: { act, order } };
  });
};

// Takes back what is held, if anything is.
const unhold = (question: ViewQuestion, board: BoardDraft): void => {
  if (board.work(question.id)?.held !== undefined) {
    board.edit(question.id, question.rev, releaseHeld);
  }
};

// Whether the undo of the sent postpone or decline is held, alone or beneath a later act.
const holdsUndo = (work: QuestionWork | undefined): boolean =>
  work?.held?.act === "reopen" || work?.undo !== undefined;

// Takes back the held undo of a sent postpone or decline; an act held over it stays.
const takeBackUndo = (question: ViewQuestion, board: BoardDraft): void =>
  board.edit(question.id, question.rev, (current) => {
    if (current.held?.act === "reopen") return releaseHeld(current);
    const { undo: _, ...rest } = current;
    return rest;
  });

const now = () => new Date().toISOString();

// Whether a held result requires a reason the note does not give; in submitted delivery an answer
// marked ready is unmarked whatever the note says, since the press only takes the mark back. Where
// the card answers at once the press sends, so a mark excuses nothing.
const reasonGate = (
  question: ViewQuestion,
  {
    results,
    board,
    facts,
    delivery,
  }: Pick<AnswerContext, "results" | "board" | "facts" | "delivery">,
  content: AnswerContent,
): AnswerOutcome => {
  const requires = reasonOf(question, results?.record() ?? new Map(), undefined, facts);
  const marked = delivery === "submitted" && board.work(question.id)?.held?.act === "answer";
  return requires !== undefined && !noteHoldsReason(content.note) && !marked
    ? "needs-reason"
    : undefined;
};

/**
 * Whether "Answer" would send nothing for want of the reason a held result requires, which the
 * card shows as the field error: the same check "Answer" makes, before a confirmation asks.
 */
export const answerNeedsReason = (
  question: ViewQuestion,
  context: Pick<AnswerContext, "draft" | "results" | "board" | "facts" | "delivery">,
): boolean => {
  const { draft, results, board } = context;
  const content = answerContentOf(
    question,
    draft.record(),
    board.work(question.id),
    results?.record(),
  );
  return reasonGate(question, context, content) === "needs-reason";
};

/**
 * Whether a field of the question blocks "Answer", by the entries and the results the user holds
 * and the facts of each type (`fieldBlock`), apart from the items the card makes read-only: the one
 * check the press, "Accept recommended" and the card's state make.
 */
export const blockedBy = (
  question: ViewQuestion,
  context: Pick<AnswerContext, "results" | "entries" | "cellEntries" | "facts" | "readOnlyOf">,
): boolean =>
  holdsBlock(
    question,
    entriesWithCells(context.entries?.record(), context.cellEntries?.record()),
    context.results?.record() ?? new Map(),
    context.facts,
    context.readOnlyOf?.(question),
  );

/**
 * "Answer": sends, marks ready or unmarks, or sends or holds the note alone (FR-7, FR-22). While a
 * held result requires a reason (approval-scale-ranking, design decision 6) and the note holds no
 * character but white space, it sends and marks nothing and says so, so that the card shows the
 * field error and moves focus to the prompt; unmarking an answer marked ready is never refused.
 */
export const answer = (question: ViewQuestion, context: AnswerContext): AnswerOutcome => {
  const { draft, results, board, derived, delivery } = context;
  // A field blocks (an entry, a value that fails its check, an empty required field): the answer
  // would leave it out or send what it refuses, so nothing is sent, marked or held (atoms, design
  // decision 3; form-widget, design decision 5; NFR-10).
  if (blockedBy(question, context)) return undefined;
  const work = board.work(question.id);
  const held = answerContentOf(question, draft.record(), work, results?.record());
  const content = namesEarlierRevision(question, work)
    ? held
    : withDerived(held, derived.reported, itemIdsOf(question));
  const answers =
    content.choice !== undefined ||
    content.values !== undefined ||
    content.results !== undefined ||
    content.other !== undefined;
  if (!answers) {
    if (content.note === undefined) return undefined;
    if (delivery === "submitted") {
      toggleHeld(question, context, "note");
      return undefined;
    }
    sendActs(context, [
      { type: "note", itemId: question.id, rev: question.rev, note: content.note, when: now() },
    ]);
    return undefined;
  }
  if (reasonGate(question, context, content) === "needs-reason") return "needs-reason";
  if (delivery === "submitted") {
    toggleHeld(question, context, "answer");
    return undefined;
  }
  const rev = revisionFor(question, work);
  const message = answerOf({ ...question, rev }, content, new Date());
  const { type: _, ...fields } = message;
  dispatch(context, [{ type: "answer", ...fields }], message);
  return undefined;
};

/**
 * Postpone, pressed on an open question, or pressed again to undo (FR-4): sent at once in
 * immediate delivery, its undo as a `reopen`; held in submitted delivery, where the undo of a sent
 * postpone is held as a `reopen`. Pressed on a held postpone or a held undo, which it shows as
 * such, it takes that back, in either delivery, and only the draft changes (AD-20): a board that
 * answers at once, the single-question board the agent's deletes left, never sends what it shows
 * as held. An act held over the undo stays.
 */
export const postpone = (
  question: ViewQuestion,
  phase: QuestionPhase,
  context: AnswerContext,
): void => {
  const { board } = context;
  const work = board.work(question.id);
  const held = work?.held?.act;
  if (held === "postpone" || held === "reopen") {
    unhold(question, board);
    return;
  }
  if (phase === "postponed" && holdsUndo(work)) {
    takeBackUndo(question, board);
    return;
  }
  if (context.delivery === "submitted") {
    toggleHeld(question, context, phase === "postponed" ? "reopen" : "postpone");
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
 * the reason, and follows the delivery mode; chosen again, it undoes, as Postpone does. Chosen on
 * a held decline, or on the held undo of a sent decline, it takes that back, in either delivery,
 * and only the draft changes (AD-20). On the held undo of a sent postpone it holds a decline over
 * that undo, which the core takes on a postponed question; taken back, the undo is held again.
 */
export const decline = (
  question: ViewQuestion,
  phase: QuestionPhase,
  context: AnswerContext,
): void => {
  const { board } = context;
  const work = board.work(question.id);
  const held = work?.held?.act;
  if (held === "decline") {
    unhold(question, board);
    return;
  }
  if (phase === "declined" && holdsUndo(work)) {
    takeBackUndo(question, board);
    return;
  }
  if (context.delivery === "submitted") {
    toggleHeld(question, context, phase === "declined" ? "reopen" : "decline");
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
export const explain = (
  question: ViewQuestion,
  context: Senders,
  language: Locale = "en-US",
): void => sendActs(context, [followUp(question, t(language, "question.explainText"))]);

/** "Send" in the thread's composer: its text as a follow-up, at once in either mode (FR-10). */
export const sendFollowUp = (question: ViewQuestion, context: AnswerContext): void => {
  const text = context.board.work(question.id)?.composer;
  if (text === undefined || text === "") return;
  sendActs(context, [followUp(question, text)]);
};

/** Drops the question's draft: its items' values and results and its work, its revision included. */
export const dropWork = (
  question: ViewQuestion,
  {
    draft,
    results,
    entries,
    cellEntries,
    board,
  }: Pick<AnswerContext, "draft" | "results" | "entries" | "cellEntries" | "board">,
): void => {
  for (const itemId of itemIdsOf(question)) draft.set(itemId, undefined);
  for (const itemId of resultIdsOf(question)) results?.set(itemId, undefined);
  for (const itemId of entryIdsOf(question)) entries?.set(itemId, undefined);
  clearCellEntries(question, cellEntries);
  board.forget(question.id);
};

const NO_READ_ONLY: ReadonlySet<string> = new Set();

/** "Reload, losing my work": the choice at once, and the question's draft goes (FR-6). */
export const reloadQuestion = (question: ViewQuestion, context: AnswerContext): void => {
  sendActs(context, [
    { type: "edit-choice", itemId: question.id, rev: question.rev, edit: "reload" },
  ]);
  dropWork(question, context);
};

/**
 * "Keep mine": an `ignore` keeping the revision the work was made on, at once (FR-6). `shown` is
 * the revision the card shows, the one the work was made on when the page has seen it, else the
 * current one: a result the draft holds that `shown` refuses, as when the page was reloaded after
 * the agent's change and shows the new props, is dropped, and its item shows as untouched
 * (approval-scale-ranking, pre-PR reviews, "A draft holds only results its items accept").
 * `readOnlyItems` are the items the card makes read-only (`readOnlyItemsOf`): the cell entries a
 * Table among them holds are dropped, since the user can no longer correct them and a held entry
 * blocks "Answer" (table-widget, review 8.3c; keep-mine-shown-revision, decision 3).
 */
export const keepMine = (
  question: ViewQuestion,
  context: AnswerContext,
  shown: ViewQuestion = question,
  readOnlyItems: ReadonlySet<string> = NO_READ_ONLY,
): void => {
  const work = context.board.work(question.id);
  if (work === undefined || work.rev >= question.rev) return;
  const { results, facts, draft, cellEntries } = context;
  const dropped = new Set<string>();
  for (const itemId of resultIdsOf(shown)) {
    const held = results?.valueOf(itemId);
    if (held !== undefined && !resultFits(shown, itemId, held, facts))
      results?.set(itemId, undefined);
    // A widget's value the card does not show on the revision the work was made on is dropped too
    // (security review X-2): an answer sends what its widgets show.
    const value = draft.valueOf(itemId);
    if (value !== undefined && valueDropped(shown, work.rev, itemId, value, facts)) {
      draft.set(itemId, undefined);
      dropped.add(itemId);
    }
  }
  // A Table's cell entries go with a value dropped (review S-1); otherwise they stay only for input
  // cells of the value it holds, the draft's where that was kept, else the props the card shows:
  // none is left that no cell shows (review U-1).
  for (const itemId of cellEntryIdsOf(shown)) {
    const held = cellEntries?.valueOf(itemId);
    if (!(held instanceof Map)) continue;
    if (dropped.has(itemId) || readOnlyItems.has(itemId)) {
      cellEntries?.set(itemId, undefined);
      continue;
    }
    const props = draft.valueOf(itemId) ?? nestedItemById(shown.props.items, itemId)?.props;
    cellEntries?.set(itemId, fitCellEntries(held, props));
  }
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
 * labels, "Other…" text where it is offered, the notes on its labels, the note, and the results of
 * the widget items it holds (approval-scale-ranking, design decision 6), in place of those of the
 * draft; the composer's text stays. Nothing is sent (AD-10): "Start from my previous answer", and
 * the start of a revision.
 */
export const fillFrom = (
  question: ViewQuestion,
  content: AnswerContent,
  {
    draft,
    results,
    entries,
    cellEntries,
    board,
    facts,
  }: Pick<AnswerContext, "draft" | "results" | "entries" | "cellEntries" | "board" | "facts">,
): void => {
  const labels = new Set((question.props.options ?? []).map((option) => option.label));
  const choice = (content.choice ?? []).filter((label) => labels.has(label));
  const notes = Object.entries(content.optionNotes ?? {}).filter(([label]) => labels.has(label));
  const other = question.props.allowOther === true ? content.other : undefined;
  draft.set(question.id, choice.length === 0 ? undefined : choice);
  // Each widget item the revision holds takes the answer's result for it, as an own property, or
  // none; an item the revision no longer holds, a key that names none and a result the item's type
  // refuses against its current props seed nothing, and the item shows as untouched.
  for (const itemId of resultIdsOf(question)) {
    const given = content.results;
    const result = given !== undefined && Object.hasOwn(given, itemId) ? given[itemId] : undefined;
    results?.set(itemId, resultFits(question, itemId, result, facts) ? result : undefined);
  }
  // The start of a revision, or "Start from my previous answer", replaces the draft: text a field
  // could not read goes, as a result of the answer takes the item's place.
  for (const itemId of entryIdsOf(question)) entries?.set(itemId, undefined);
  clearCellEntries(question, cellEntries);
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
 * The selection of "Accept recommended": the recommended option, as the only one on a single choice
 * (which clears "Other…") or beside the others on a multiple one; an answer marked ready is
 * unmarked, since the selection changes it. It acts as nothing else: the press goes on through
 * `pressAnswer`, as a press of "Answer" does.
 */
export const selectRecommendedOption = (question: ViewQuestion, context: AnswerContext): void => {
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
};

/**
 * "Accept recommended" with no confirmation: the selection, then "Answer". The card goes through
 * `pressAnswer` instead, so that the reason check and the confirmation come between (L186).
 */
export const acceptRecommended = (
  question: ViewQuestion,
  context: AnswerContext,
): AnswerOutcome => {
  if (recommendedOf(question) === undefined || blockedBy(question, context)) return undefined;
  selectRecommendedOption(question, context);
  return answer(question, context);
};

/** What a press of "Answer" made of itself, for the card to show. */
export type AnswerPress =
  /** Nothing was sent or marked for want of the reason: the field error and the prompt. */
  | { readonly kind: "needs-reason" }
  /** The act waits for the user's confirmation. */
  | { readonly kind: "waiting"; readonly waiting: Waiting }
  /** The act ran now. */
  | { readonly kind: "done" };

/**
 * A press of "Answer", or of "Accept recommended" once it has selected: the reason check first,
 * before anything asks (F-63, AD-10), then the confirmation a received verdict needs, then the act
 * itself, whose outcome `onOutcome` hears each time it runs, at once or on confirming.
 */
export const pressAnswer = (
  question: ViewQuestion,
  context: AnswerContext,
  status: LifecycleQuestionStatus | undefined,
  onOutcome: (outcome: AnswerOutcome) => void,
): AnswerPress => {
  if (answerNeedsReason(question, context)) return { kind: "needs-reason" };
  // The held act excuses the confirmation only where the press takes it back: in submitted delivery.
  const held =
    context.delivery === "submitted" ? context.board.work(question.id)?.held?.act : undefined;
  const waiting = press(asksFirst("answer", question, status, held, context.facts), () =>
    onOutcome(answer(question, context)),
  );
  return waiting === undefined ? { kind: "done" } : { kind: "waiting", waiting };
};
