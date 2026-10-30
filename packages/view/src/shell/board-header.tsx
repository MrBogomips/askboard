// The view's header on a single-question board (EXPERIENCE.md, Board anatomy and Presentations;
// DESIGN.md, Context header and State pill): the ask's title and its state, as the board state
// says, or "Discarded" once the board page says so, as its banner does. The title is agent text and
// renders as text only (AD-8).

import type { BoardState } from "@askboard/contract";

const PILLS = {
  waiting: {
    label: "Waiting",
    pill: "border-border bg-muted text-foreground-secondary",
    // A hollow ring: waiting is neutral grey, and never colour alone (DESIGN.md, Markers).
    marker: "size-2 rounded-full border border-ask-waiting",
  },
  answered: {
    label: "Answered",
    pill: "border-transparent bg-success-subtle text-success-text",
    // A filled dot.
    marker: "size-2 rounded-full bg-ask-answered",
  },
  discarded: {
    label: "Discarded",
    pill: "border-transparent bg-destructive-subtle text-destructive-text",
    // A bar.
    marker: "h-0.5 w-2 bg-ask-discarded",
  },
} as const satisfies Record<AskState, unknown>;

/** The ask states the header shows: the board state's, and discarded from the board page. */
export type AskState = BoardState["ask"] | "discarded";

const StatePill = ({ ask }: { readonly ask: AskState }) => {
  const { label, pill, marker } = PILLS[ask];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-badge ${pill}`}
    >
      <span aria-hidden="true" className={`shrink-0 ${marker}`} />
      {label}
    </span>
  );
};

export const BoardHeader = ({ title, ask }: { readonly title: string; readonly ask: AskState }) => (
  <header className="sticky top-0 z-10 flex h-8 items-center gap-3 border-b border-border bg-card px-4">
    <h1
      className="min-w-0 flex-1 truncate text-body-lg font-semibold text-foreground"
      title={title}
    >
      {title}
    </h1>
    <span className="text-label text-muted-foreground uppercase">Ask</span>
    <StatePill ask={ask} />
  </header>
);
