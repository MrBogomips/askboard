// The view's context header (EXPERIENCE.md, Board anatomy and Context header; DESIGN.md, Context
// header and State pill), sticky, in up to three rows of `{spacing.header-row}`, with
// `{elevation.shadow-sm}` (answering-flow-visual, design decision 1). Row 1 is push delivery's: who
// asked, the project, the directory, the branch and the worktree (FR-24, `who-and-where.tsx`). Row 2
// is the ask row (`ask-row.tsx`): the title and ID, the pills, the postponed warning and the tools.
// Row 3 is the progress row (`progress-row.tsx`), on a board of two or more that has not ended. A
// single-question board has rows 1 and 2.

import type { ReactNode } from "react";
import { AskRow, type AskRowProps } from "./ask-row.tsx";
import { type HeaderCounts, type PrefillControl, ProgressRow } from "./progress-row.tsx";
import { WhoAndWhere } from "./who-and-where.tsx";

export type { HeaderCounts, PrefillControl };

export const BoardHeader = ({
  counts,
  prefill,
  strip,
  ...ask
}: AskRowProps & {
  readonly counts?: HeaderCounts | undefined;
  readonly prefill?: PrefillControl | undefined;
  readonly strip?: ReactNode;
}) => (
  <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-card shadow-sm">
    <WhoAndWhere header={ask.header} />
    <AskRow {...ask} />
    {counts === undefined ? null : <ProgressRow counts={counts} prefill={prefill} strip={strip} />}
  </header>
);
