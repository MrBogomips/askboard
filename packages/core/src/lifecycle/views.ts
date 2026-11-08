// What ask-core shows of an ask's questions (ask-lifecycle, design decision 3): per question its
// revision, state, current and previous answer and thread, for `board-host` (AD-12); and an item's
// full value for `fetch` (FR-20). Nothing here reads the draft record (AD-20).

import type {
  AnswerEvent,
  ClosedReason,
  FetchAnswer,
  FetchItem,
  LifecycleBoardDocument,
  QuestionProps,
  QuestionState,
  ThreadReply,
} from "@askboard/contract";
import type { Entry } from "./log.ts";
import type { AnswerContent, AreaRecord, BoardModel, QuestionRecord } from "./model.ts";
import type { CurrentAnswer, QuestionStatus } from "./states.ts";

/** An answer as the board shows it: its content, who and when, and how it reached the agent. */
export type AnswerView = AnswerContent & {
  readonly declined?: true;
  readonly who: string;
  readonly when: string;
  /** The agent recorded it (FR-19); it has no event. */
  readonly recorded?: true;
  /** Its event's cursor, when it is logged. */
  readonly cursor?: string;
  /** Whether `received` has passed its event; a recorded answer is the agent's own, so it has. */
  readonly delivered: boolean;
  /** The full values of the widget items it changed, by expanded item ID (AD-20); none without. */
  readonly values?: Readonly<Record<string, unknown>>;
  /** The results its widget items gave, by expanded item ID (AD-20); none without. */
  readonly results?: Readonly<Record<string, unknown>>;
  /**
   * The IDs of the question and of its items, at any depth, whose props equal those of the revision
   * this answer names (reopen-start-from-answer); none when nothing does. Never logged, never in
   * `fetch` or `collect`.
   */
  readonly unchanged?: readonly string[];
};

/** The widget content kept for each answer event, by cursor (AD-20). */
export type KeptValues = ReadonlyMap<
  string,
  { readonly values: unknown; readonly results?: unknown }
>;

/** A follow-up the user wrote, with the agent's replies under it (FR-10). */
export type ThreadView = {
  readonly cursor: string;
  readonly who: string;
  readonly when: string;
  readonly text: string;
  readonly replies: readonly ThreadReply[];
};

export type LifecycleQuestionView = {
  readonly itemId: string;
  readonly rev: number;
  readonly state: QuestionState;
  readonly answer?: AnswerView;
  /** The answer before the agent's latest reopen. */
  readonly previous?: AnswerView;
  readonly thread: readonly ThreadView[];
};

/**
 * What `board-host` shows of an ask (AD-12): its board document, state and questions, and why it
 * closed; a discarded ask is a tombstone and shows nothing (AD-21).
 */
export type LifecycleBoardView =
  | { readonly askId: string; readonly state: "discarded" }
  | {
      readonly askId: string;
      readonly state: "waiting" | "partly-answered" | "answered" | "closed";
      readonly document: LifecycleBoardDocument;
      readonly questions: readonly LifecycleQuestionView[];
      readonly closed?: ClosedReason;
    };

const CONTENT = ["choice", "other", "optionNotes", "note"] as const;

/** An answer event's content fields, as a fetch result or the board holds them. */
const eventContent = (event: AnswerEvent): AnswerContent & { readonly declined?: true } => {
  const content: Record<string, unknown> = {};
  for (const field of CONTENT) if (event[field] !== undefined) content[field] = event[field];
  if (event.declined) content.declined = true;
  return content;
};

/** The answer a question holds now, in full, as `fetch` returns it (FR-20). */
export const fullAnswer = (
  question: QuestionRecord,
  current: CurrentAnswer | undefined,
): FetchAnswer | undefined => {
  if (current === undefined) return undefined;
  if (current.kind === "recorded") {
    const recorded = question.recorded;
    if (recorded === undefined) return undefined;
    const { who, when } = recorded;
    return { ...recorded.content, who, when, recorded: true };
  }
  const { event } = current.entry;
  return { ...eventContent(event), who: event.who, when: event.when, cursor: event.cursor };
};

const seqOf = (cursor: string): number => Number(cursor.slice(cursor.indexOf(".") + 1));

// A kept part of an answer's widget content, as a field of the view when it holds anything.
const keptPart = (part: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof part === "object" && part !== null && Object.keys(part).length > 0
    ? (part as Readonly<Record<string, unknown>>)
    : undefined;

const answerView = (
  answer: FetchAnswer,
  received: number,
  kept: KeptValues,
  unchanged: readonly string[] | undefined,
): AnswerView => {
  const delivered = "cursor" in answer ? seqOf(answer.cursor) <= received : true;
  const held = "cursor" in answer ? kept.get(answer.cursor) : undefined;
  const values = keptPart(held?.values);
  const results = keptPart(held?.results);
  return {
    ...answer,
    delivered,
    ...(values === undefined ? {} : { values }),
    ...(results === undefined ? {} : { results }),
    ...(unchanged === undefined || unchanged.length === 0 ? {} : { unchanged: [...unchanged] }),
  };
};

const threadOf = (question: QuestionRecord, entries: readonly Entry[]): ThreadView[] =>
  entries.flatMap(({ event }) =>
    event.type === "follow-up"
      ? [
          {
            cursor: event.cursor,
            who: event.who,
            when: event.when,
            text: event.text,
            replies: question.replies.get(event.cursor) ?? [],
          },
        ]
      : [],
  );

export type QuestionFacts = {
  readonly question: QuestionRecord;
  readonly entries: readonly Entry[];
  readonly status: QuestionStatus;
};

// The revision the current answer names: its event's, or the current one for a recorded answer.
const currentRevOf = (question: QuestionRecord, current: CurrentAnswer): number =>
  current.kind === "logged" ? current.entry.event.rev : question.rev;

/**
 * One question as `board-host` shows it, its answers marked delivered once `received` passes, each
 * with what its revision shares with the current one (`model` compares, once per pair).
 */
export const questionView = (
  { question, entries, status }: QuestionFacts,
  received: number,
  kept: KeptValues = new Map(),
  model?: BoardModel,
): LifecycleQuestionView => {
  const answer = fullAnswer(question, status.answer);
  const unchangedAt = (rev: number | undefined) =>
    rev === undefined ? undefined : model?.unchangedSince(question, rev);
  const current =
    answer === undefined || status.answer === undefined
      ? undefined
      : answerView(answer, received, kept, unchangedAt(currentRevOf(question, status.answer)));
  return {
    itemId: question.id,
    rev: question.rev,
    state: status.state,
    ...(current === undefined ? {} : { answer: current }),
    ...(question.previous === undefined
      ? {}
      : {
          previous: answerView(
            question.previous,
            received,
            kept,
            unchangedAt(question.previousRev),
          ),
        }),
    thread: threadOf(question, entries),
  };
};

/** A question's full value (FR-20): its revision, props, state, and answers in full. */
export const questionValue = (
  { question, status }: QuestionFacts,
  model: BoardModel,
): FetchItem => {
  const answer = fullAnswer(question, status.answer);
  return {
    ...model.boardQuestion(question),
    state: status.state,
    ...(answer === undefined ? {} : { answer }),
    ...(question.previous === undefined ? {} : { previous: question.previous }),
  };
};

/** A revision ask-core keeps of a question, with its props, frozen (AD-20). */
export type KeptRevision = { readonly rev: number; readonly props: QuestionProps };

/** The revisions ask-core keeps of one question, by ascending revision (AD-20). */
export type KeptRevisions = {
  readonly itemId: string;
  readonly revisions: readonly KeptRevision[];
};

/** A question's kept revisions, read: new lists over the frozen props, so nothing read changes it. */
export const keptRevisionsOf = (question: QuestionRecord): KeptRevisions => ({
  itemId: question.id,
  revisions: [...question.revs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rev, props]) => ({ rev, props })),
});

/** An area's full value: its title and its questions, with their revisions and props. */
export const areaValue = (area: AreaRecord, model: BoardModel): FetchItem => ({
  type: "area",
  id: area.id,
  props: { title: area.title, items: model.areaQuestions(area) },
});
