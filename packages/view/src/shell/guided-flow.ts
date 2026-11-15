// What the card hands `afterAnswerOf` and what the board records for the status messages
// (answering-flow-guidance, design decisions 3 and 7), as pure functions of the board document, the
// state and the work: the question the board moves to, its title and place, the area just finished.

import type { LifecycleBoardState } from "@askboard/contract";
import { areaOf, questionsOf, type ViewDocument } from "../view-document.ts";
import type { AfterAnswerInputs } from "./after-answer.ts";
import type { QuestionWork } from "./board-draft.ts";
import { isOpen, type Ladder, markOf, nextOpenFrom } from "./board-view.ts";
import type { SentRecord } from "./flow-messages.ts";

type Work = ReadonlyMap<string, QuestionWork>;

/**
 * The question the board moves to after the acted one: `nextOpenFrom`'s target, kept only when it is
 * to do or a first draft. A postponed target is left out, so a board with only postponed questions
 * left gives no move: completion's (decision 3).
 */
export const nextOfFlow = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
  unseen: ReadonlySet<string>,
  acted: string,
): AfterAnswerInputs["next"] => {
  const id = nextOpenFrom(document, state, work, ladder, unseen, acted);
  if (id === undefined || markOf(id, state, work, ladder) === "postponed") return undefined;
  return { id, newFromAgent: unseen.has(id) };
};

/** A question's title (its header chip, else its text) and its place among the board's questions. */
export type FlowTarget = { readonly title: string; readonly n: number; readonly m: number };

export const flowTargetOf = (document: ViewDocument, id: string): FlowTarget | undefined => {
  const questions = questionsOf(document);
  const at = questions.findIndex((question) => question.id === id);
  const question = questions[at];
  if (question === undefined) return undefined;
  const { header, text } = question.props;
  return { title: header ?? text, n: at + 1, m: questions.length };
};

/**
 * The area of the acted question, the questions to do it still has once this one is acted on, and the
 * area of the target; none on a board without areas.
 */
export const areaInputOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: Work,
  ladder: Ladder,
  acted: string,
  target: string | undefined,
): AfterAnswerInputs["area"] => {
  const area = areaOf(document, acted);
  if (area === undefined) return undefined;
  const left = area.props.items.filter(
    (question) => question.id !== acted && isOpen(question.id, state, work, ladder),
  ).length;
  const targetArea = target === undefined ? undefined : areaOf(document, target);
  return {
    acted: { id: area.id, title: area.props.title },
    left,
    ...(targetArea === undefined ? {} : { targetId: targetArea.id }),
  };
};

/** The acts held for Submit, of any kind, each question's once (decision 3). */
export const heldActsOf = (work: Work): number =>
  [...work.values()].filter((each) => each.held !== undefined).length;

/** The footer of the card whose answer the board stayed on (setting "Stay here", decision 3). */
export type Footer = {
  /** The question whose card shows it. */
  readonly from: string;
  /** The question "Continue" moves to. */
  readonly target: string;
  /** The target's title: agent text, shown as text only. */
  readonly title: string;
  readonly newFromAgent: boolean;
  /** The target's area title, when it is in another area than the acted question. */
  readonly area?: string;
};

/** What the board recorded at the act for the messages its command says once it is sent. */
export type SentRecords = {
  set(questionId: string, record: SentRecord): void;
  /** The record of the first of these questions that has one; every one of them is forgotten. */
  take(questionIds: readonly string[]): SentRecord | undefined;
};

export const createSentRecords = (): SentRecords => {
  const records = new Map<string, SentRecord>();
  return {
    set: (questionId, record) => {
      records.set(questionId, record);
    },
    take: (questionIds) => {
      const found = questionIds.map((id) => records.get(id)).find((each) => each !== undefined);
      for (const id of questionIds) records.delete(id);
      return found;
    },
  };
};
