// The view's context header (EXPERIENCE.md, Board anatomy and Context header; DESIGN.md, Context
// header and State pill), sticky, in two rows (L46, L110). Row 1 is push delivery's (E4): who
// asked, the project, the directory, the branch and the worktree (FR-24, `who-and-where.tsx`). Row
// 2 holds the ask's title, the "Ask" label and the ask state pill, the agent pill (push delivery,
// `agent-pill.tsx`), then the open count, "Next open ↓", the unread-reply count and the
// agent-change flag (ask-lifecycle, design decisions 6 and 8). A single-question board shows only
// the pills (L198). The title is agent text and renders as text only (AD-8).

import { AgentPill } from "./agent-pill.tsx";
import type { AskPill as Pill } from "./board-view.ts";
import type { HeaderData } from "./header-data.ts";
import { AskPill } from "./markers.tsx";
import type { Store } from "./store.ts";
import { BUTTON_LINK, BUTTON_SECONDARY, INFO_BADGE, SEPARATOR } from "./styles.ts";
import { type ThemeChoice, ThemeControl } from "./theme-control.tsx";
import { WhoAndWhere } from "./who-and-where.tsx";

/** What row 2 shows beyond the pill; absent on a single-question board. */
export type HeaderCounts = {
  readonly open: number;
  /** Goes to the next open question; disabled when there is none to go to. */
  readonly onNextOpen: (() => void) | undefined;
  readonly unreadReplies: number;
  readonly onUnread: () => void;
  /** Questions the agent changed under the user's unsent work. */
  readonly changed: number;
  readonly onChanged: () => void;
};

const replies = (count: number) => (count === 1 ? "1 new reply" : `${count} new replies`);

const Counts = ({ counts }: { readonly counts: HeaderCounts }) => (
  <>
    <span aria-hidden="true" className={SEPARATOR} />
    <span className="text-control font-semibold text-foreground">{`${counts.open} open`}</span>
    <button
      type="button"
      className={BUTTON_SECONDARY}
      disabled={counts.onNextOpen === undefined}
      onClick={counts.onNextOpen}
    >
      Next open ↓
    </button>
    {counts.unreadReplies === 0 ? null : (
      <button type="button" className={BUTTON_LINK} onClick={counts.onUnread}>
        {replies(counts.unreadReplies)}
      </button>
    )}
    {counts.changed === 0 ? null : (
      <button type="button" className={`${INFO_BADGE} ${BUTTON_LINK}`} onClick={counts.onChanged}>
        The agent updated this
      </button>
    )}
  </>
);

export const BoardHeader = ({
  title,
  pill,
  counts,
  header,
  theme,
}: {
  readonly title: string;
  readonly pill: Pill;
  readonly counts?: HeaderCounts | undefined;
  /** Who asked and where, and the agent status (push delivery). */
  readonly header: Store<HeaderData>;
  /** An opened Snapshot's Theme control (snapshot task 8.3). */
  readonly theme?: Store<ThemeChoice> | undefined;
}) => (
  <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-card">
    <WhoAndWhere header={header} />
    <div className="flex h-8 items-center gap-3 px-4">
      <h1
        className="min-w-0 flex-1 truncate text-body-lg font-semibold text-foreground"
        title={title}
      >
        {title}
      </h1>
      <span className="text-label text-muted-foreground uppercase">Ask</span>
      <AskPill pill={pill} />
      <AgentPill header={header} />
      {counts === undefined ? null : <Counts counts={counts} />}
      {theme === undefined ? null : <ThemeControl choice={theme} />}
    </div>
  </header>
);
