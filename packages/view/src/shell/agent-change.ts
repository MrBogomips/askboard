// Agent changes under the user's unsent work (ask-lifecycle, design decision 6; EXPERIENCE.md,
// Agent-change notice; FR-6, AD-20): a question the agent changed while the user held work made on
// an earlier revision raises the notice, until the user chooses. "Reload, losing my work" drops
// the work; "Keep mine" keeps working on the earlier revision, which the answer then names, and
// settles the notice for the revision it was made about. The view remembers each revision it has
// seen, so that the card keeps showing the revision the work was made on, and "Show the agent's
// change" can mark what changed; a revision the view never saw (as after a reload) shows unmarked.
// Pure functions and two small in-memory stores; nothing here is sent or mirrored.

import type { ChoiceOption, Locale } from "@askboard/contract";
import { t } from "../strings/index.ts";
import {
  questionsOf,
  type ViewDocument,
  type ViewQuestion,
  type ViewQuestionProps,
} from "../view-document.ts";
import { itemIdsOf, type QuestionWork } from "./board-draft.ts";
import type { DraftRecord } from "./draft-store.ts";

/** "Keep mine", once done: the revision it was about, and the one it kept. */
export type KeptChoice = { readonly rev: number; readonly keptRev: number };

export type KeptChoices = ReadonlyMap<string, KeptChoice>;

/**
 * Whether the notice sits on the question: its work was made on an earlier revision, and the
 * user has not kept it for this one.
 */
export const changePending = (
  question: ViewQuestion,
  work: QuestionWork | undefined,
  kept: KeptChoices,
): boolean => {
  if (work === undefined || work.rev >= question.rev) return false;
  const choice = kept.get(question.id);
  return choice?.rev !== question.rev || choice.keptRev !== work.rev;
};

/** How many changes the user made on the question: what the notice says is at stake. */
export const changeCountOf = (
  question: ViewQuestion,
  values: DraftRecord,
  work: QuestionWork | undefined,
): number => {
  const items = itemIdsOf(question).filter((itemId) => values.get(itemId) !== undefined).length;
  const notes = Object.values(work?.optionNotes ?? {}).filter((note) => note !== "").length;
  const texts = [work?.other, work?.note, work?.composer].filter(
    (text) => text !== undefined && text !== "",
  ).length;
  return items + notes + texts;
};

/** The notice's count (EXPERIENCE.md, Voice and Tone: "Your 17 changes on this question"). */
export const changesLabel = (count: number, language: Locale = "en-US"): string =>
  t(language, "change.yourChanges", { count });

/** Each question's revisions the view has seen, by revision. */
export type Revisions = {
  /** Remembers every question of the document at its revision. */
  record(document: ViewDocument): void;
  question(questionId: string, rev: number): ViewQuestion | undefined;
};

export const createRevisions = (): Revisions => {
  const seen = new Map<string, Map<number, ViewQuestion>>();
  return {
    record: (document) => {
      for (const question of questionsOf(document)) {
        const revs = seen.get(question.id) ?? new Map<number, ViewQuestion>();
        if (!revs.has(question.rev)) revs.set(question.rev, question);
        seen.set(question.id, revs);
      }
    },
    question: (questionId, rev) => seen.get(questionId)?.get(rev),
  };
};

/**
 * The question as the card shows it: at the revision the work was made on while that is earlier
 * than the current one and the view has seen it, so the work stays on what it was made on; else
 * the current revision.
 */
export const workingQuestion = (
  question: ViewQuestion,
  work: QuestionWork | undefined,
  revisions: Revisions,
): ViewQuestion =>
  work !== undefined && work.rev < question.rev
    ? (revisions.question(question.id, work.rev) ?? question)
    : question;

/** A text field of the new revision, with the earlier text when it changed. */
export type FieldChange = {
  readonly now?: string;
  readonly before?: string;
  readonly changed: boolean;
};

export type OptionChange = {
  readonly label: string;
  /** Added, removed, changed in a field, or the same, against the earlier revision. */
  readonly change: "added" | "removed" | "changed" | "same";
  readonly description: FieldChange;
  readonly annotation: FieldChange;
  readonly preview: FieldChange;
  readonly recommended: boolean;
};

export type RevisionDiff = {
  readonly header: FieldChange;
  readonly text: FieldChange;
  readonly options: readonly OptionChange[];
};

const field = (now: string | undefined, before: string | undefined, known: boolean) => {
  const changed = known && now !== before;
  return {
    ...(now === undefined ? {} : { now }),
    ...(changed && before !== undefined ? { before } : {}),
    changed,
  };
};

const optionChange = (
  option: ChoiceOption,
  earlier: ChoiceOption | undefined,
  known: boolean,
): OptionChange => {
  const fields = {
    description: field(option.description, earlier?.description, known && earlier !== undefined),
    annotation: field(option.annotation, earlier?.annotation, known && earlier !== undefined),
    preview: field(option.preview, earlier?.preview, known && earlier !== undefined),
  };
  const recommended = option.recommended === true;
  const moved =
    Object.values(fields).some((each) => each.changed) ||
    recommended !== (earlier?.recommended === true);
  const change = !known ? "same" : earlier === undefined ? "added" : moved ? "changed" : "same";
  return { label: option.label, change, ...fields, recommended };
};

const removedOption = (option: ChoiceOption): OptionChange => ({
  label: option.label,
  change: "removed",
  description: field(option.description, undefined, false),
  annotation: field(option.annotation, undefined, false),
  preview: field(option.preview, undefined, false),
  recommended: option.recommended === true,
});

/**
 * "Show the agent's change": the new revision's text fields and options, each marked against the
 * earlier revision when the view knows it; options the agent removed come last.
 */
export const revisionDiff = (
  before: ViewQuestionProps | undefined,
  after: ViewQuestionProps,
): RevisionDiff => {
  const known = before !== undefined;
  const earlier = before?.options ?? [];
  const now = after.options ?? [];
  const labels = new Set(now.map((option) => option.label));
  return {
    header: field(after.header, before?.header, known),
    text: field(after.text, before?.text, known),
    options: [
      ...now.map((option) =>
        optionChange(
          option,
          earlier.find((each) => each.label === option.label),
          known,
        ),
      ),
      ...earlier.filter((option) => !labels.has(option.label)).map(removedOption),
    ],
  };
};
