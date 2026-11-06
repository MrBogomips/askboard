// What the Choice atom gets through the port: a question with options as its item, and the labels
// chosen so far as its value, undefined while none has been (design decision 7). Since the ask
// lifecycle (ask-lifecycle, design decision 6) the shell's renderer also hands it the question's
// "Other…" text and the user's option notes, which the lifecycle draft keeps beside the draft
// record, and the setters that put them back there; Choice keeps no edit state of its own (AD-9).

import type { BoardQuestion, ChoiceOption } from "@askboard/contract";
import type { ItemProps } from "../port.ts";

/** The lifecycle draft's part of a question that Choice renders and edits (FR-3, FR-18). */
export type ChoiceExtras = {
  /** The "Other…" row's text; undefined while "Other…" is not chosen. */
  readonly other: string | undefined;
  readonly onOtherChange: (other: string | undefined) => void;
  /** The user's notes on options, by option label. */
  readonly optionNotes: Readonly<Record<string, string>>;
  readonly onOptionNoteChange: (label: string, note: string | undefined) => void;
};

/** A question that has options: since input format 1.4 `options` is optional, and Choice needs it. */
export type ChoiceQuestion = Omit<BoardQuestion, "props"> & {
  readonly props: Omit<BoardQuestion["props"], "options"> & {
    readonly options: readonly ChoiceOption[];
  };
};

export type ChoiceProps = ItemProps<ChoiceQuestion, readonly string[]> & {
  readonly extras?: ChoiceExtras;
};
