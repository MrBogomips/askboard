// The board's rail (answering-flow-visual, design decision 2; EXPERIENCE.md, Board anatomy;
// DESIGN.md, Layout & Spacing): on a board of two or more questions, in every presentation, a sticky
// column of `{spacing.outline-rail}` (256 px) under the header for the rest of the viewport's height.
// The outline scrolls in the part above; the outbox, when the board has one, stays at the foot, wholly
// in view. Its top and height follow the header's height, which the board sets once as
// `--askboard-header-height` on its root.

import type { ReactNode } from "react";

export const Rail = ({
  outline,
  outbox,
}: {
  readonly outline: ReactNode;
  readonly outbox: ReactNode | undefined;
}) => (
  <aside
    data-askboard-rail=""
    style={{
      top: "var(--askboard-header-height, 0px)",
      height: "calc(100vh - var(--askboard-header-height, 0px))",
    }}
    className="sticky z-[4] flex w-[var(--outline-rail)] shrink-0 flex-col self-start border-r border-border bg-background"
  >
    <div className="min-h-0 flex-1 overflow-y-auto">{outline}</div>
    {outbox === undefined || outbox === null ? null : <div className="flex-none">{outbox}</div>}
  </aside>
);
