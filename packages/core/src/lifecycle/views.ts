// What ask-core shows of an ask's questions (ask-lifecycle, design decision 3): per question its
// revision, state, current and previous answer and thread, for `board-host` (AD-12); and an item's
// full value for `fetch` (FR-20). Nothing here reads the draft record (AD-20).

import type {
  AnswerEvent,
  ClosedReason,
  FetchAnswer,
  LifecycleBoardDocument,
  QuestionState,
  ThreadReply,
} from "@askboard/contract";
import type { Entry } from "./log.ts";
import type { AnswerContent, QuestionRecord } from "./model.ts";
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
};

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

const answerView = (answer: FetchAnswer, received: number): AnswerView => {
  const delivered = "cursor" in answer ? seqOf(answer.cursor) <= received : true;
  return { ...answer, delivered };
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

/** One question as `board-host` shows it, its answers marked delivered once `received` passes. */
export const questionView = (
  { question, entries, status }: QuestionFacts,
  received: number,
): LifecycleQuestionView => {
  const answer = fullAnswer(question, status.answer);
  return {
    itemId: question.id,
    rev: question.rev,
    state: status.state,
    ...(answer === undefined ? {} : { answer: answerView(answer, received) }),
    ...(question.previous === undefined
      ? {}
      : { previous: answerView(question.previous, received) }),
    thread: threadOf(question, entries),
  };
};
