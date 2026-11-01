// Question and ask states, derived (ask-lifecycle, design decision 3; AD-10): pure functions over a
// question's logged events and the agent's latest answer-setting action, and over the questions'
// states. Only `closed` and `discarded` are stored, on the aggregate.

import type { AnswerEvent, AskState, QuestionState } from "@askboard/contract";
import type { Entry } from "./log.ts";

/**
 * The agent's latest action that set a question's answer without an event: an answer it recorded,
 * or a reopen. `at` is the log's latest `seq` when it applied: events at or below it came before.
 */
export type AnswerMark = { readonly at: number; readonly kind: "recorded" | "reopened" };

/** The answer a question holds now: its logged event, or the one the agent recorded. */
export type CurrentAnswer =
  | { readonly kind: "logged"; readonly entry: Entry<AnswerEvent> }
  | { readonly kind: "recorded" };

export type QuestionStatus =
  | { readonly state: "open" | "postponed"; readonly answer?: undefined }
  | { readonly state: "answered" | "declined"; readonly answer: CurrentAnswer };

const OPEN: QuestionStatus = { state: "open" };
const POSTPONED: QuestionStatus = { state: "postponed" };
const RECORDED: QuestionStatus = { state: "answered", answer: { kind: "recorded" } };

/**
 * A question's state and current answer (core spec, Question states): `answered` or `declined`
 * while its latest answer, logged or recorded, says so; `postponed` while a logged postpone is not
 * undone; `open` otherwise. A reopen, the user's or the agent's, makes it `open`. Notes, follow-ups
 * and edit choices change nothing. `entries` are the question's entries in log order.
 */
export const questionStatus = (
  mark: AnswerMark | undefined,
  entries: readonly Entry[],
): QuestionStatus => {
  let status = mark?.kind === "recorded" ? RECORDED : OPEN;
  for (const entry of entries) {
    if (mark !== undefined && entry.seq <= mark.at) continue;
    const { event } = entry;
    if (event.type === "answer") {
      const answer = { kind: "logged", entry: entry as Entry<AnswerEvent> } as const;
      status = { state: event.declined ? "declined" : "answered", answer };
    } else if (event.type === "postponed") {
      status = POSTPONED;
    } else if (event.type === "reopened") {
      status = OPEN;
    }
  }
  return status;
};

export type AskFacts = {
  /** The stored state, once the ask is closed or discarded. */
  readonly stored?: "closed" | "discarded";
  /** Whether the ask has had an answer, a decline or a postpone, logged or recorded. */
  readonly acted: boolean;
  /** The states of the questions the ask holds now; deleted ones are left out. */
  readonly questions: readonly QuestionState[];
};

const SETTLED: ReadonlySet<QuestionState> = new Set(["answered", "declined", "postponed"]);
const GIVEN: ReadonlySet<QuestionState> = new Set(["answered", "declined"]);

/**
 * An ask's state (core spec, Ask states): `waiting` until its first answer, decline or postpone;
 * then `answered` while every question that is not postponed is answered or declined and at least
 * one is, and `partly-answered` otherwise: postpones alone never make it `answered`, since the state
 * never claims more than the user has given (AD-10). Nothing leads back to `waiting`. Closing and
 * discarding are stored.
 */
export const askStateOf = ({ stored, acted, questions }: AskFacts): AskState => {
  if (stored !== undefined) return stored;
  if (!acted) return "waiting";
  const answered =
    questions.every((state) => SETTLED.has(state)) && questions.some((state) => GIVEN.has(state));
  return answered ? "answered" : "partly-answered";
};
