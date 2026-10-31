// The board's markers (DESIGN.md, Colors: Markers; Components: State pill and Question marker): the
// ask pill with its marker, and each question's marker, whose shape carries its state so that no
// state relies on colour alone. Markers are decoration (`aria-hidden`); their state is always in
// text beside them.

import type { Mark, AskPill as Pill } from "./board-view.ts";

const PILLS: Readonly<Record<Pill["kind"], { pill: string; marker: string }>> = {
  waiting: {
    pill: "border-border bg-muted text-foreground-secondary",
    // A hollow ring: waiting is neutral grey.
    marker: "size-2 rounded-full border border-ask-waiting",
  },
  partial: {
    pill: "border-border-strong bg-card text-foreground",
    // A half-filled dot, so it never reads as a selected control (F-92).
    marker:
      "size-2 rounded-full border border-ask-partial bg-linear-to-r from-ask-partial from-50% to-transparent to-50%",
  },
  answered: {
    pill: "border-transparent bg-success-subtle text-success-text",
    // A filled dot.
    marker: "size-2 rounded-full bg-ask-answered",
  },
  closed: {
    pill: "border-border-strong bg-muted text-foreground",
    // A square.
    marker: "size-2 bg-ask-closed",
  },
  discarded: {
    pill: "border-transparent bg-destructive-subtle text-destructive-text",
    // A bar.
    marker: "h-0.5 w-2 bg-ask-discarded",
  },
};

/** The ask state pill (State pill). */
export const AskPill = ({ pill }: { readonly pill: Pill }) => {
  const { pill: look, marker } = PILLS[pill.kind];
  return (
    <span
      data-askboard-ask-pill={pill.kind}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-badge ${look}`}
    >
      <span aria-hidden="true" className={`shrink-0 ${marker}`} />
      {pill.label}
    </span>
  );
};

/** A question's marker: the ask markers for unanswered and answered, then held, postponed, declined. */
export const QuestionMarker = ({ mark }: { readonly mark: Mark }) => {
  switch (mark) {
    case "unanswered":
      return (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full border border-ask-waiting"
        />
      );
    case "answered":
      return <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ask-answered" />;
    case "ready":
      // A dot in a ring (`question-marker-held`).
      return (
        <span
          aria-hidden="true"
          className="flex size-2.5 shrink-0 items-center justify-center rounded-full border border-ask-answered"
        >
          <span className="size-1 rounded-full bg-ask-answered" />
        </span>
      );
    case "postponed":
      // Two short bars (`question-marker-postponed`).
      return (
        <span aria-hidden="true" className="flex h-2 shrink-0 gap-0.5">
          <span className="h-2 w-0.5 bg-muted-foreground" />
          <span className="h-2 w-0.5 bg-muted-foreground" />
        </span>
      );
    case "declined":
      // A slashed ring (`question-marker-declined`).
      return (
        <span
          aria-hidden="true"
          className="relative flex size-2.5 shrink-0 items-center justify-center rounded-full border border-foreground-secondary"
        >
          <span className="h-px w-2.5 -rotate-45 bg-foreground-secondary" />
        </span>
      );
  }
};
