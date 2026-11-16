// The question's primary button (answering-flow-guidance, design decision 5; EXPERIENCE.md,
// Answer): the string key of the label that names its act. The card renders it through `t`.

import type { StringKey } from "../strings/index.ts";
import type { Delivery } from "./board-draft.ts";

export type PrimaryInputs = {
  /** The board holds one question: it works as "One by one". */
  readonly single: boolean;
  readonly delivery: Delivery;
  /** The answer is held for Submit. */
  readonly ready: boolean;
  /** "Answer" would send the open prompt's note alone. */
  readonly noteOnly: boolean;
  /** The draft is a revision of an answered or declined question. */
  readonly revision: boolean;
};

/** "Edit" on a ready answer; "Confirm" in "All together"; else the note, the change or the answer. */
export const primaryLabelOf = ({
  single,
  delivery,
  ready,
  noteOnly,
  revision,
}: PrimaryInputs): StringKey => {
  if (ready) return "question.edit";
  if (!single && delivery === "submitted") return "question.confirm";
  if (noteOnly) return "question.sendNote";
  return revision ? "question.sendChange" : "question.answer";
};
