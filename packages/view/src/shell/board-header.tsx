// The view's header on a single-question board (EXPERIENCE.md, Board anatomy and Presentations;
// DESIGN.md, Context header and State pill): the ask's title and its state, as the board state
// says. The title is agent text and renders as text only (AD-8).

import type { BoardState } from "@askboard/contract";

const PILLS = {
  waiting: {
    label: "Waiting",
    pill: "border-border bg-muted text-foreground-secondary",
    // A hollow ring: waiting is neutral grey, and never colour alone (DESIGN.md, Markers).
    marker: "border border-ask-waiting",
  },
  answered: {
    label: "Answered",
    pill: "border-transparent bg-success-subtle text-success-text",
    // A filled dot.
    marker: "bg-ask-answered",
  },
} as const satisfies Record<BoardState["ask"], unknown>;

const StatePill = ({ ask }: { readonly ask: BoardState["ask"] }) => {
  const { label, pill, marker } = PILLS[ask];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-badge ${pill}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${marker}`} />
      {label}
    </span>
  );
};

export const BoardHeader = ({
  title,
  ask,
}: {
  readonly title: string;
  readonly ask: BoardState["ask"];
}) => (
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
