// What sits under an option's row (EXPERIENCE.md, Option preview and Option annotation; DESIGN.md,
// the same): the agent's annotation, prefixed "Agent:"; "Show preview", which opens the preview
// below the option as plain text, one preview open at a time (open question 9); and the user's own
// note, which "+ Add your note to this option" opens, shown on a selected option and on any option
// under hover or focus (F-52). Every agent string is text (AD-8). The note goes into the lifecycle
// draft through the extras; which preview is open and which note editor the user opened are only
// what the view shows, not work.

import { type ChoiceOption, OPTION_NOTE_MAX_CHARS, OTHER_MAX_CHARS } from "@askboard/contract";
import { useEffect, useRef, useState } from "react";
import { useStrings } from "../port.ts";
import { noteReveal } from "./note-reveal.ts";
import { OptionPreview } from "./preview.tsx";
import type { ChoiceExtras } from "./props.ts";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const LINK = `rounded-md text-control text-primary-text hover:underline ${FOCUS}`;

export const previewId = (itemId: string, index: number): string =>
  `${itemId}:option:${index}:preview`;

type DetailsProps = {
  readonly itemId: string;
  readonly index: number;
  readonly option: ChoiceOption;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly extras: ChoiceExtras | undefined;
  readonly previewOpen: boolean;
  readonly onPreview: () => void;
};

const Annotation = ({ text }: { readonly text: string }) => {
  const strings = useStrings();
  return (
    <p className="ml-xl border-l-2 border-border-strong bg-muted px-sm py-1 text-body text-foreground-secondary">
      <span className="font-semibold">{strings("option.agent")}</span> {text}
    </p>
  );
};

// The user's note on the option, in the user-change colours (`user-annotation`).
const NoteField = ({
  label,
  note,
  disabled,
  focus,
  onChange,
}: {
  readonly label: string;
  readonly note: string;
  readonly disabled: boolean;
  readonly focus: boolean;
  readonly onChange: (note: string | undefined) => void;
}) => {
  const field = useRef<HTMLTextAreaElement>(null);
  const text = useStrings();
  useEffect(() => {
    if (focus) field.current?.focus();
  }, [focus]);
  return (
    <textarea
      ref={field}
      aria-label={text("option.noteLabel", { label })}
      value={note}
      readOnly={disabled}
      maxLength={OPTION_NOTE_MAX_CHARS}
      rows={2}
      onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
      className={`ml-xl rounded-md border border-change bg-change-subtle p-sm text-body text-foreground ${FOCUS}`}
    />
  );
};

export const OptionDetails = ({
  itemId,
  index,
  option,
  selected,
  disabled,
  extras,
  previewOpen,
  onPreview,
}: DetailsProps) => {
  const [editing, setEditing] = useState(false);
  const note =
    extras !== undefined && Object.hasOwn(extras.optionNotes, option.label)
      ? extras.optionNotes[option.label]
      : undefined;
  const noteShown = note !== undefined || editing;
  const canNote = extras !== undefined && !disabled && !noteShown;
  // Shown on a selected option, and on any other under hover or keyboard focus (F-52).
  const text = useStrings();
  const reveal = noteReveal(selected);
  return (
    <>
      {option.annotation === undefined ? null : <Annotation text={option.annotation} />}
      {option.preview === undefined && !canNote ? null : (
        <div className="ml-xl flex flex-wrap items-center gap-md">
          {option.preview === undefined ? null : (
            <button
              type="button"
              className={LINK}
              aria-expanded={previewOpen}
              aria-controls={previewId(itemId, index)}
              onClick={onPreview}
            >
              {text("option.showPreview")}
            </button>
          )}
          {canNote ? (
            <button type="button" className={`${LINK} ${reveal}`} onClick={() => setEditing(true)}>
              {text("option.addNote")}
            </button>
          ) : null}
        </div>
      )}
      {previewOpen && option.preview !== undefined ? (
        <OptionPreview
          id={previewId(itemId, index)}
          itemId={itemId}
          preview={option.preview}
          {...(option.previewFormat === undefined ? {} : { format: option.previewFormat })}
        />
      ) : null}
      {noteShown && extras !== undefined ? (
        <NoteField
          label={option.label}
          note={note ?? ""}
          disabled={disabled}
          focus={editing && note === undefined}
          onChange={(next) => {
            setEditing(true);
            extras.onOptionNoteChange(option.label, next);
          }}
        />
      ) : null}
    </>
  );
};

/** The "Other…" row's text field, under the row while "Other…" is chosen (FR-3). */
export const OtherField = ({
  other,
  disabled,
  onChange,
}: {
  readonly other: string;
  readonly disabled: boolean;
  readonly onChange: (other: string) => void;
}) => {
  const text = useStrings();
  return (
    <input
      type="text"
      aria-label={text("option.other")}
      value={other}
      readOnly={disabled}
      maxLength={OTHER_MAX_CHARS}
      onChange={(event) => onChange(event.target.value)}
      className={`ml-xl rounded-md border border-input bg-card p-sm text-body text-foreground read-only:border-border read-only:bg-muted ${FOCUS}`}
    />
  );
};
