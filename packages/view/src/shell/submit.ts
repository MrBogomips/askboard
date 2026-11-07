// Submitted delivery's board-wide acts (ask-lifecycle, design decision 6; EXPERIENCE.md, Submit,
// Select recommended and Mode-switch confirmation; AD-20, FR-3, FR-22): Submit sends every act
// held for it (ready answers, the selections "Select recommended" made that the user left in place,
// postpones, declines, undoes of sent ones and notes alone) as one command, in the order the user
// produced them; it waits while nothing is held, while the connection is lost, on a locked board,
// while a held question's command is on its way, and while an agent-change notice sits on a question
// with held work. "Select recommended" only selects, and in submitted delivery holds each selection
// for Submit. Pure functions of the board document, the drafts and the board's state.

import {
  type HeldAct,
  type LifecycleBoardState,
  type Locale,
  noteHoldsReason,
} from "@askboard/contract";
import { t } from "../strings/index.ts";
import { questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import type { ViewAct, ViewLock } from "../view-protocol.ts";
import {
  answerContentOf,
  type BoardDraft,
  type BoardDraftState,
  type Delivery,
  itemIdsOf,
  type QuestionWork,
} from "./board-draft.ts";
import {
  type AnswerContext,
  answerNeedsReason,
  nextHeldOrder,
  recommendedOf,
  revisionFor,
  withDerived,
} from "./card-acts.ts";
import type { DerivedStore } from "./derived-store.ts";
import type { DraftRecord, DraftStore } from "./draft-store.ts";
import { contentOf } from "./question-state.ts";
import { type FactsOf, reasonOf } from "./reason.ts";
import { questionsToConfirm } from "./revision-confirm.ts";

/** A question with an act held for Submit, and the work that carries it. */
export type HeldWork = {
  readonly question: ViewQuestion;
  readonly work: QuestionWork & { readonly held: HeldAct };
};

const isHeld = (work: QuestionWork | undefined): work is HeldWork["work"] =>
  work?.held !== undefined;

/** The board's questions with a held act, in the order the user produced the acts. */
export const heldWorkOf = (document: ViewDocument, board: BoardDraftState): readonly HeldWork[] =>
  questionsOf(document)
    .flatMap((question) => {
      const work = board.questions.get(question.id);
      return isHeld(work) ? [{ question, work }] : [];
    })
    .sort((a, b) => a.work.held.order - b.work.held.order);

const filled = (text: string | undefined): text is string => text !== undefined && text !== "";

// One held act as the view act it sends, if it carries what its act needs: an answer with the
// derived values its widget items last reported (widget-answers design decision 10).
const actOf = (
  { question, work }: HeldWork,
  values: DraftRecord,
  when: string,
  reported: DerivedStore["reported"],
  results?: DraftRecord,
): ViewAct[] => {
  const itemId = question.id;
  switch (work.held.act) {
    case "answer": {
      const content = withDerived(
        answerContentOf(question, values, work, results),
        reported,
        itemIdsOf(question),
      );
      if (
        content.choice === undefined &&
        content.values === undefined &&
        content.results === undefined &&
        !filled(content.other)
      ) {
        return [];
      }
      const rev = revisionFor(question, work);
      return [{ type: "answer", itemId, rev, ...contentOf(content), when }];
    }
    case "decline": {
      const rev = revisionFor(question, work);
      return [
        { type: "decline", itemId, rev, ...(filled(work.note) ? { note: work.note } : {}), when },
      ];
    }
    case "postpone":
      return [{ type: "postpone", itemId, rev: question.rev }];
    case "reopen":
      return [{ type: "reopen", itemId }];
    case "note":
      return filled(work.note)
        ? [{ type: "note", itemId, rev: question.rev, note: work.note, when }]
        : [];
  }
};

// The held undo of a sent postpone beneath a note alone, as its reopen at the undo's place: a note
// leaves a postponed question postponed, so the undo must go too. An answer or a decline held over
// an undo goes alone, since the core takes either on a postponed or declined question and either
// closes it (AD-20).
const undoOf = ({ question, work }: HeldWork): readonly Ordered[] =>
  work.held.act === "note" && work.undo !== undefined
    ? [{ order: work.undo.order, acts: [{ type: "reopen", itemId: question.id }] }]
    : [];

type Ordered = { readonly order: number; readonly acts: readonly ViewAct[] };

/**
 * What Submit sends: each held act, in the order the user produced them, stamped with the time of
 * the click (FR-19); each answer with the derived values `reported` gives its widget items, and
 * with the `results` the widget items hold, which go with the held answer as values do.
 */
export const submitActsOf = (
  held: readonly HeldWork[],
  values: DraftRecord,
  at: Date,
  reported: DerivedStore["reported"],
  results?: DraftRecord,
): ViewAct[] => {
  const when = at.toISOString();
  return held
    .flatMap((each): Ordered[] => [
      ...undoOf(each),
      { order: each.work.held.order, acts: actOf(each, values, when, reported, results) },
    ])
    .sort((a, b) => a.order - b.order)
    .flatMap(({ acts }) => acts);
};

export type SubmitInputs = {
  readonly document: ViewDocument;
  readonly board: BoardDraftState;
  readonly delivery: Delivery;
  readonly connection: "lost" | undefined;
  readonly lock: ViewLock | undefined;
  /** Whether an agent-change notice sits on the question. */
  readonly pending: (questionId: string) => boolean;
  /** Whether a command holding an act on the question is on its way. */
  readonly sending: (questionId: string) => boolean;
};

export type SubmitState = {
  /** How many acts are held. */
  readonly held: number;
  /** The held questions an agent-change notice sits on, in board order. */
  readonly blocked: readonly string[];
  readonly disabled: boolean;
};

/** Whether Submit can go, and what stops it (EXPERIENCE.md, Submit). */
export const submitStateOf = (inputs: SubmitInputs): SubmitState => {
  const held = heldWorkOf(inputs.document, inputs.board);
  const ids = held.map(({ question }) => question.id);
  const blocked = questionsOf(inputs.document)
    .map((question) => question.id)
    .filter((id) => ids.includes(id) && inputs.pending(id));
  const disabled =
    inputs.delivery !== "submitted" ||
    held.length === 0 ||
    inputs.connection === "lost" ||
    inputs.lock !== undefined ||
    blocked.length > 0 ||
    ids.some(inputs.sending);
  return { held: held.length, blocked, disabled };
};

/** The bar's count of agent-change notices on held work, which jumps to the first. */
export const updatesLabel = (count: number, language: Locale = "en-US"): string =>
  t(language, "bar.updates", { count });

/** Whether any question has a recommended option: "Select recommended" shows only then. */
export const hasRecommendation = (document: ViewDocument): boolean =>
  questionsOf(document).some((question) => recommendedOf(question) !== undefined);

// Whether the user has chosen something on the question: an option, or "Other…".
const hasChoice = (question: ViewQuestion, values: DraftRecord, work: QuestionWork | undefined) => {
  const chosen = values.get(question.id);
  return (Array.isArray(chosen) && chosen.length > 0) || work?.other !== undefined;
};

/**
 * "Select recommended": the recommended option on every question that is open (not answered,
 * declined or postponed), holds no act but a note, and where the user has chosen nothing, unless
 * `skip` says the question cannot take it now. In submitted delivery each selection is held for
 * Submit, marked as made by it, unless a held result requires a reason the note lacks: that
 * question keeps its selection and is not marked ready, as "Answer" would refuse it; nothing is
 * sent (AD-10). Returns how many it selected, marked or not.
 */
export const selectRecommended = (
  document: ViewDocument,
  state: LifecycleBoardState,
  {
    draft,
    results,
    board,
    facts,
  }: {
    readonly draft: DraftStore;
    readonly results?: DraftStore | undefined;
    readonly board: BoardDraft;
    readonly facts?: AnswerContext["facts"];
  },
  skip: (questionId: string) => boolean,
): number => {
  let count = 0;
  for (const question of questionsOf(document)) {
    const recommended = recommendedOf(question);
    const status = state.questions.find((each) => each.itemId === question.id)?.state;
    const work = board.work(question.id);
    const held = work?.held?.act;
    if (recommended === undefined || status !== "open" || skip(question.id)) continue;
    if ((held !== undefined && held !== "note") || hasChoice(question, draft.record(), work)) {
      continue;
    }
    draft.set(question.id, [recommended.label]);
    const lacksReason = answerNeedsReason(question, {
      draft,
      results,
      board,
      facts,
      delivery: board.get().delivery,
    });
    if (board.get().delivery === "submitted" && !lacksReason) {
      const order = nextHeldOrder(board);
      board.edit(question.id, question.rev, (current) => ({
        ...current,
        held: { act: "answer", order, byRecommended: true },
      }));
    }
    count += 1;
  }
  return count;
};

/**
 * The first question, in board order, whose held answer lacks the reason a held result of its own
 * requires: a note holding a character other than white space. A held answer is a marked one; the
 * mark does not excuse it here, since the note may have lost its text since (design decision 6).
 */
export const heldMissingReason = (
  document: ViewDocument,
  held: readonly HeldWork[],
  values: DraftRecord,
  results: DraftRecord | undefined,
  facts?: FactsOf,
): ViewQuestion | undefined => {
  for (const question of questionsOf(document)) {
    const entry = held.find((each) => each.question.id === question.id);
    if (entry === undefined || entry.work.held.act !== "answer") continue;
    const content = answerContentOf(question, values, entry.work, results);
    if (
      reasonOf(question, results ?? new Map(), undefined, facts) !== undefined &&
      !noteHoldsReason(content.note)
    ) {
      return question;
    }
  }
  return undefined;
};

/** What a press of Submit comes to: a question whose reason is missing, the acts to send, or the acts and the questions to ask about first. */
export type SubmitPress =
  | { readonly kind: "needs-reason"; readonly questionId: string }
  | { readonly kind: "send"; readonly acts: ViewAct[] }
  | {
      readonly kind: "confirm";
      readonly acts: ViewAct[];
      /** The questions whose received verdict the acts replace, in board order. */
      readonly questions: readonly ViewQuestion[];
    };

/**
 * A press of Submit (design decision 6): the last reason check over every held answer comes
 * before anything else; one that fails sends nothing and leaves every act held, naming the
 * question the board goes to. Then, when a held answer or decline would replace a received
 * verdict, the questions to ask about with the acts; otherwise the one command, every held act in
 * the order the user produced them.
 */
export const submitPress = (
  document: ViewDocument,
  board: BoardDraftState,
  values: DraftRecord,
  at: Date,
  reported: DerivedStore["reported"],
  options: {
    /** The board's state, for the receipts of the answers the held acts would replace. */
    readonly state: LifecycleBoardState;
    readonly results?: DraftRecord | undefined;
    readonly facts?: FactsOf | undefined;
  },
): SubmitPress => {
  const { results, facts, state } = options;
  const held = heldWorkOf(document, board);
  const missing = heldMissingReason(document, held, values, results, facts);
  if (missing !== undefined) return { kind: "needs-reason", questionId: missing.id };
  const acts = submitActsOf(held, values, at, reported, results);
  const questions = state === undefined ? [] : questionsToConfirm(document, held, state, facts);
  return questions.length === 0 ? { kind: "send", acts } : { kind: "confirm", acts, questions };
};

/** What the confirmation's Submit comes to, once pressed again against the held work as it is. */
export type ConfirmedPress =
  | { readonly kind: "blocked" }
  | { readonly kind: "needs-reason"; readonly questionId: string }
  | { readonly kind: "ask"; readonly questions: readonly ViewQuestion[] }
  | { readonly kind: "send"; readonly acts: ViewAct[] };

/**
 * The confirmation's Submit (design decision 6): `now` is the press made again, against the held
 * work as it is when the user confirms, not as it was when the dialog opened. Nothing is sent when
 * Submit has been disabled meanwhile (a notice, a lost connection, a lock, a command on its way),
 * or when a held answer now lacks its reason; when the press now asks about other questions than
 * the dialog listed, it asks again with the new list; otherwise the acts are the press's now.
 */
export const confirmedPress = (
  asked: readonly ViewQuestion[],
  disabled: boolean,
  now: SubmitPress,
): ConfirmedPress => {
  if (disabled) return { kind: "blocked" };
  if (now.kind === "needs-reason") return now;
  if (now.kind === "send") return now;
  const same =
    now.questions.length === asked.length &&
    now.questions.every((question, index) => question.id === asked[index]?.id);
  return same ? { kind: "send", acts: now.acts } : { kind: "ask", questions: now.questions };
};
