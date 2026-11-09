// The shared annotation list (document-review, design decision 7; DESIGN.md: Document review,
// detached annotations): entries of a label, an excerpt and a text, each with an optional "Delete",
// under a heading and an optional note. A Document review's detached annotations are one use of it.
// Text is rendered by React as text, never as markup, and a long word wraps. Nothing here names a
// widget type.

import { useStrings } from "@askboard/view/catalog";
import { useId } from "react";
import {
  BUTTON_LINK,
  ENTRIES,
  ENTRY,
  ENTRY_HEAD,
  ENTRY_LABEL,
  EXCERPT,
  LIST,
  LIST_HEADING,
  LIST_NOTE,
  TEXT,
} from "./classes.ts";

export type ListEntry = {
  readonly id: string;
  /** "Comment 2". */
  readonly label: string;
  /** The passage the annotation was made on. */
  readonly excerpt: string;
  /** What the user wrote, if anything. */
  readonly text?: string;
  /** Present, the entry has a "Delete"; absent, it has none. */
  readonly onDelete?: () => void;
};

export const AnnotationList = ({
  heading,
  note,
  entries,
}: {
  readonly heading: string;
  readonly note?: string;
  readonly entries: readonly ListEntry[];
}) => {
  const text = useStrings();
  const headingId = useId();
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={LIST}>
      <p id={headingId} className={`m-0 ${LIST_HEADING}`}>
        {heading}
      </p>
      {note === undefined ? null : <p className={`m-0 ${LIST_NOTE}`}>{note}</p>}
      <ul className={ENTRIES}>
        {entries.map((entry) => (
          <li key={entry.id} className={ENTRY}>
            <div className={ENTRY_HEAD}>
              <span className={ENTRY_LABEL}>{entry.label}</span>
              {entry.onDelete === undefined ? null : (
                <button
                  type="button"
                  className={BUTTON_LINK}
                  aria-label={`${text("annotations.delete")} ${entry.label}`}
                  onClick={entry.onDelete}
                >
                  {text("annotations.delete")}
                </button>
              )}
            </div>
            <p className={EXCERPT}>{entry.excerpt}</p>
            {entry.text === undefined || entry.text === "" ? null : (
              <p className={`m-0 ${TEXT}`}>{entry.text}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
