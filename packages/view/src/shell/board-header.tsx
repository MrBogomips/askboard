// The view's context header (EXPERIENCE.md, Board anatomy and Context header; DESIGN.md, Context
// header and State pill), sticky, in two rows (L46, L110). Row 1 is push delivery's (E4): who
// asked, the project, the directory, the branch and the worktree (FR-24, `who-and-where.tsx`). Row
// 2 holds the ask's title, the "Ask" label and the ask state pill, the agent pill (push delivery,
// `agent-pill.tsx`), then the open count, "Next open", the unread-reply count and the
// agent-change flag (ask-lifecycle, design decisions 6 and 8), and the quick toggles at its right
// end (`quick-toggles.tsx`, settings-languages). A single-question board shows only
// the pills (L198). The title is agent text and renders as text only (AD-8).

import { useStrings } from "../catalog/port.ts";
import { AgentPill } from "./agent-pill.tsx";
import type { BoardKeysProps } from "./board-keys-panel.tsx";
import type { AskPill as Pill } from "./board-view.ts";
import { HeaderActions, type HeaderCounts } from "./header-actions.tsx";
import type { HeaderData } from "./header-data.ts";
import { AskPill } from "./markers.tsx";
import type { PresentationControls } from "./presentation-controls.ts";
import { QuickToggles } from "./quick-toggles.tsx";
import type { StatusMessages } from "./status-messages.ts";
import type { Store } from "./store.ts";
import { WhoAndWhere } from "./who-and-where.tsx";

export type { HeaderCounts };

export const BoardHeader = ({
  title,
  pill,
  counts,
  header,
  status,
  controls,
  ended = false,
  keys,
}: {
  readonly title: string;
  readonly pill: Pill;
  readonly counts?: HeaderCounts | undefined;
  /** Who asked and where, and the agent status (push delivery). */
  readonly header: Store<HeaderData>;
  /** Where the agent pill announces a change to waiting. */
  readonly status: Pick<StatusMessages, "announce">;
  /** The quick toggles at the right end of row 2 (settings-languages). */
  readonly controls: PresentationControls;
  /** The ask is closed or discarded: no agent pill, which would be stale (review F-18). */
  readonly ended?: boolean;
  /** The Keys button and its panel: none on an ended board (board-keys, decision 5). */
  readonly keys?: BoardKeysProps | undefined;
}) => {
  const text = useStrings();
  return (
    <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-card">
      <WhoAndWhere header={header} />
      <div className="flex h-header-row items-center gap-md px-lg">
        <h1
          className="min-w-0 flex-1 truncate text-body-lg font-semibold text-foreground"
          title={title}
        >
          {title}
        </h1>
        <span className="text-label text-muted-foreground uppercase">{text("header.ask")}</span>
        <AskPill pill={pill} />
        {ended ? null : <AgentPill header={header} status={status} />}
        <HeaderActions counts={counts} keys={keys} />
        <QuickToggles controls={controls} />
      </div>
    </header>
  );
};
