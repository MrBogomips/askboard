// The view's context header (EXPERIENCE.md, Board anatomy and Context header; DESIGN.md, Context
// header and State pill), sticky, in two rows (L46, L110). Row 1 belongs to `push-delivery` (E4):
// who asked, the project, the directory, the branch and the worktree (FR-24); until E4 inserts it,
// row 1 shows the ask's title. Row 2 holds the "Ask" label and the ask state pill, then, after the
// place where E4 inserts the agent pill, the open count, "Next open ↓", the unread-reply count and
// the agent-change flag (ask-lifecycle, design decisions 6 and 8). A single-question board shows
// only the pill (L198). The title is agent text and renders as text only (AD-8).

import type { AskPill as Pill } from "./board-view.ts";
import { AskPill } from "./markers.tsx";
import { BUTTON_LINK, BUTTON_SECONDARY, INFO_BADGE, SEPARATOR } from "./styles.ts";

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
}: {
  readonly title: string;
  readonly pill: Pill;
  readonly counts?: HeaderCounts | undefined;
}) => (
  <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-card">
    <div className="flex h-8 items-center gap-3 px-4">
      {/* push-delivery (E4) inserts its who-and-where row here: <WhoAndWhere />. */}
      <h1
        className="min-w-0 flex-1 truncate text-body-lg font-semibold text-foreground"
        title={title}
      >
        {title}
      </h1>
    </div>
    <div className="flex h-8 items-center gap-3 px-4">
      <span className="text-label text-muted-foreground uppercase">Ask</span>
      <AskPill pill={pill} />
      {/* push-delivery (E4) inserts the agent pill here: <AgentPill />. */}
      {counts === undefined ? null : <Counts counts={counts} />}
    </div>
  </header>
);
