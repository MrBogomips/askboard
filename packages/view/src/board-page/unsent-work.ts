// The board's unsent work (EXPERIENCE.md, Board banner: Unsent work; Interaction Primitives, Close
// and reload; F-17): whether the mirrored draft record holds any, which arms the leave-page prompt
// and the closed and discarded banners' "Copy my unsent work", and its text form, which that copy
// puts on the clipboard. Agent strings go in as text; nothing is parsed.

import type { DraftQuestion, DraftRecord } from "@askboard/contract";
import { questionsOf, type ViewDocument } from "../view-document.ts";

const filled = (text: string | undefined): text is string => text !== undefined && text !== "";

const questionHasWork = (work: DraftQuestion): boolean =>
  Object.values(work.values ?? {}).some((value) => value !== undefined) ||
  filled(work.other) ||
  Object.values(work.optionNotes ?? {}).some(filled) ||
  filled(work.note) ||
  filled(work.composer) ||
  work.held !== undefined;

/** Whether the record holds work the user has not sent. */
export const hasUnsentWork = (record: DraftRecord | undefined): boolean =>
  record !== undefined && Object.values(record.questions).some(questionHasWork);

const isLabels = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((label) => typeof label === "string");

// One question's work as lines: its choice, then each other item's value as JSON.
const valueLines = (questionId: string, work: DraftQuestion): string[] =>
  Object.entries(work.values ?? {}).flatMap(([itemId, value]) => {
    if (value === undefined) return [];
    if (itemId === questionId && isLabels(value)) {
      return value.length === 0 ? [] : [`Options: ${value.join(", ")}`];
    }
    return [`${itemId}: ${JSON.stringify(value)}`];
  });

const workLines = (questionId: string, work: DraftQuestion): string[] => [
  ...valueLines(questionId, work),
  ...(filled(work.other) ? [`Other…: ${work.other}`] : []),
  ...Object.entries(work.optionNotes ?? {})
    .filter(([, note]) => filled(note))
    .map(([label, note]) => `Note on ${label}: ${note}`),
  ...(filled(work.note) ? [`Note for the agent: ${work.note}`] : []),
  ...(filled(work.composer) ? [`Follow-up: ${work.composer}`] : []),
  ...(work.held === undefined ? [] : [`Held for Submit: ${work.held.act}`]),
];

/** The record's work as plain text, question by question in board order, under the ask's title. */
export const unsentWorkText = (document: ViewDocument, record: DraftRecord | undefined): string => {
  const sections = questionsOf(document).flatMap((question) => {
    const work =
      record !== undefined && Object.hasOwn(record.questions, question.id)
        ? record.questions[question.id]
        : undefined;
    const lines = work === undefined ? [] : workLines(question.id, work);
    return lines.length === 0 ? [] : [[question.props.text, ...lines, ""].join("\n")];
  });
  return [`${document.title}\n`, ...sections].join("\n");
};
