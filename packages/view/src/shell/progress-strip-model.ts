// The progress strip's model (answering-flow-visual, design decision 5; requirement "The progress
// strip"): pure. One segment per question in board order, grouped by area, each with its ladder
// state, number, chip and new mark; and where the strip scrolls so a segment is in its box.

import type { LifecycleBoardState } from "@askboard/contract";
import { areaOf, questionsOf, type ViewDocument, type ViewQuestion } from "../view-document.ts";
import {
  type AnswerState,
  type AnswerStateInputs,
  answerStateOf,
  type FlightOf,
} from "./answer-state.ts";
import type { QuestionWork } from "./board-draft.ts";
import { cutTitle } from "./flow-messages.ts";

export type Segment = {
  readonly questionId: string;
  readonly state: AnswerState;
  /** The question's short number; none when the map holds none (a board past the maximum). */
  readonly number: number | undefined;
  /** The question's header chip, else its text: agent text, shown as data (AD-8). */
  readonly chip: string;
  /** The agent added the question and the user has not seen it. */
  readonly isNew: boolean;
};

/** The segments of one area; a board without areas is one group with no `areaId`. */
export type SegmentGroup = {
  readonly areaId?: string;
  readonly segments: readonly Segment[];
};

export const stripOf = (
  document: ViewDocument,
  state: LifecycleBoardState,
  work: ReadonlyMap<string, QuestionWork>,
  flightOf: (questionId: string) => FlightOf | undefined,
  revisingOf: (question: ViewQuestion) => boolean,
  unseen: ReadonlySet<string>,
  numbers: ReadonlyMap<string, number>,
): readonly SegmentGroup[] => {
  const statuses = new Map(
    state.questions.map((status) => [status.itemId, status] as const).reverse(),
  );
  const segmentOf = (question: ViewQuestion): Segment => {
    const own = work.get(question.id);
    const inputs: AnswerStateInputs = {
      status: statuses.get(question.id),
      held: own?.held?.act,
      undone: own?.undo !== undefined,
      flight: flightOf(question.id),
      revising: revisingOf(question),
    };
    const { header, text } = question.props;
    return {
      questionId: question.id,
      state: answerStateOf(inputs),
      number: numbers.get(question.id),
      chip: cutTitle(header ?? text),
      isNew: unseen.has(question.id),
    };
  };
  // Questions of one area, or of no area, that follow one another share a group.
  const groups: { areaId?: string; segments: Segment[] }[] = [];
  for (const question of questionsOf(document)) {
    const areaId = areaOf(document, question.id)?.id;
    const last = groups.at(-1);
    if (last !== undefined && last.areaId === areaId) last.segments.push(segmentOf(question));
    else
      groups.push({ ...(areaId === undefined ? {} : { areaId }), segments: [segmentOf(question)] });
  }
  return groups;
};

/** A strip's scrolling box: how far it has scrolled and how wide it shows. */
export type StripBox = { readonly scrollLeft: number; readonly clientWidth: number };
/** A segment's place in the strip's scrolled content. */
export type SegmentBox = { readonly offsetLeft: number; readonly offsetWidth: number };

/**
 * The strip's `scrollLeft` that brings the segment into its box: the same value while the segment
 * is wholly visible, else the least movement that shows it. Set on the strip, never through
 * `scrollIntoView`, which could scroll the page.
 */
export const stripScrollLeft = (strip: StripBox, segment: SegmentBox): number => {
  const left = segment.offsetLeft;
  const right = left + segment.offsetWidth;
  if (left < strip.scrollLeft) return Math.max(0, left);
  if (right > strip.scrollLeft + strip.clientWidth) return Math.max(0, right - strip.clientWidth);
  return strip.scrollLeft;
};
