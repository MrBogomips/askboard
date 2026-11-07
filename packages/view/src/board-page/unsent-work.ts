// The board's unsent work (EXPERIENCE.md, Board banner: Unsent work; Interaction Primitives, Close
// and reload; F-17): whether the mirrored draft record holds any, which arms the leave-page prompt
// and the closed and discarded banners' "Copy my unsent work", and its text form, which that copy
// puts on the clipboard. Agent strings go in as text; nothing is parsed.

import type { DraftQuestion, DraftRecord, Locale } from "@askboard/contract";
import { t } from "../strings/index.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";

const filled = (text: string | undefined): text is string => text !== undefined && text !== "";

const questionHasWork = (work: DraftQuestion): boolean =>
  Object.values(work.values ?? {}).some((value) => value !== undefined) ||
  Object.values(work.results ?? {}).some((value) => value !== undefined) ||
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
const valueLines = (questionId: string, work: DraftQuestion, language: Locale): string[] =>
  Object.entries(work.values ?? {}).flatMap(([itemId, value]) => {
    if (value === undefined) return [];
    if (itemId === questionId && isLabels(value)) {
      return value.length === 0
        ? []
        : [t(language, "unsent.options", { labels: value.join(", ") })];
    }
    return [`${itemId}: ${JSON.stringify(value)}`];
  });

// Each held result as JSON under its item's ID, as a widget's edited value is.
const resultLines = (work: DraftQuestion): string[] =>
  Object.entries(work.results ?? {}).flatMap(([itemId, result]) =>
    result === undefined ? [] : [`${itemId}: ${JSON.stringify(result)}`],
  );

const workLines = (questionId: string, work: DraftQuestion, language: Locale): string[] => [
  ...valueLines(questionId, work, language),
  ...resultLines(work),
  ...(filled(work.other) ? [t(language, "unsent.other", { text: work.other })] : []),
  ...Object.entries(work.optionNotes ?? {})
    .filter(([, note]) => filled(note))
    .map(([label, note]) => t(language, "unsent.optionNote", { label, note })),
  ...(filled(work.note) ? [t(language, "unsent.note", { note: work.note })] : []),
  ...(filled(work.composer) ? [t(language, "unsent.followUp", { text: work.composer })] : []),
  ...(work.held === undefined ? [] : [t(language, "unsent.held", { act: work.held.act })]),
];

/** The record's work as plain text, question by question in board order, under the ask's title. */
export const unsentWorkText = (
  document: ViewDocument,
  record: DraftRecord | undefined,
  language: Locale = "en-US",
): string => {
  const sections = questionsOf(document).flatMap((question) => {
    const work =
      record !== undefined && Object.hasOwn(record.questions, question.id)
        ? record.questions[question.id]
        : undefined;
    const lines = work === undefined ? [] : workLines(question.id, work, language);
    return lines.length === 0 ? [] : [[question.props.text, ...lines, ""].join("\n")];
  });
  return [`${document.title}\n`, ...sections].join("\n");
};
