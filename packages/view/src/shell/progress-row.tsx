// The context header's third row, the progress row (answering-flow-visual, design decision 1;
// EXPERIENCE.md, Context header, Next-open jump, Select recommended): on a board of two or more
// questions that has not ended, the "Progress" label, the count to do, "Next to do" (absent, not
// disabled, with nothing to do), "Prefill recommended" while a question has a recommendation, then
// at the row's end the unread-reply count and the agent-change flag (ask-lifecycle, design
// decisions 6 and 8). The strip of questions joins the row in its own group.

import type { ReactNode } from "react";
import { KeyHint } from "../catalog/keys/key-help.tsx";
import { useStrings } from "../catalog/port.ts";
import { IconNextOpen, IconPrefill } from "../icons/index.ts";
import { ButtonKeys } from "./button-keys.tsx";
import { BUTTON_LINK, BUTTON_SECONDARY, INFO_BADGE, SECTION_LABEL, SEPARATOR } from "./styles.ts";
import { useBoardKeyTable } from "./use-board-keys.ts";

/** What the row shows; absent on a single-question board and once the ask has ended. */
export type HeaderCounts = {
  /** The count to do, named in the ask's language, with the postponed ones when there are any. */
  readonly openLabel: string;
  /** Goes to the next open question; absent when there is none to go to. */
  readonly onNextOpen: (() => void) | undefined;
  readonly unreadReplies: number;
  readonly onUnread: () => void;
  /** Questions the agent changed under the user's unsent work. */
  readonly changed: number;
  readonly onChanged: () => void;
};

/** "Prefill recommended": absent in an opened Snapshot, offered while a question can take it. */
export type PrefillControl = {
  readonly disabled: boolean;
  readonly onPress: () => void;
  /** The questions it can fill now: the label's count. */
  readonly count: number;
};

export const ProgressRow = ({
  counts,
  prefill,
  strip,
}: {
  readonly counts: HeaderCounts;
  readonly prefill: PrefillControl | undefined;
  /** The progress strip (`progress-strip.tsx`), which takes the row's free width and scrolls. */
  readonly strip?: ReactNode;
}) => {
  const text = useStrings();
  const entry = useBoardKeyTable().find((each) => each.action === "board.nextOpen");
  const jump =
    counts.onNextOpen === undefined ? null : (
      <button
        type="button"
        className={BUTTON_SECONDARY}
        data-askboard-next-to-do=""
        onClick={counts.onNextOpen}
      >
        {text("header.nextOpen")}
        <ButtonKeys entry={entry} />
        <IconNextOpen className="size-4" />
      </button>
    );
  return (
    <div
      data-askboard-progress-row=""
      className="flex h-header-row min-w-0 items-center gap-md px-lg whitespace-nowrap"
    >
      <span className={`${SECTION_LABEL} shrink-0`}>{text("progress.label")}</span>
      <span aria-hidden="true" className={SEPARATOR} />
      {strip ?? <span className="flex-1" />}
      <span aria-hidden="true" className={SEPARATOR} />
      <span className="shrink-0 text-control font-semibold text-foreground">
        {counts.openLabel}
      </span>
      {jump === null ? null : entry === undefined ? jump : <KeyHint entry={entry}>{jump}</KeyHint>}
      {prefill === undefined ? null : (
        <button
          type="button"
          className={BUTTON_SECONDARY}
          data-askboard-prefill=""
          disabled={prefill.disabled}
          onClick={prefill.onPress}
        >
          <IconPrefill className="size-4" />
          {text("bar.selectRecommended", { count: prefill.count })}
        </button>
      )}
      <span className="flex shrink-0 items-center gap-md">
        {counts.unreadReplies === 0 ? null : (
          <button type="button" className={BUTTON_LINK} onClick={counts.onUnread}>
            {text("header.newReplies", { count: counts.unreadReplies })}
          </button>
        )}
        {counts.changed === 0 ? null : (
          <button
            type="button"
            className={`${INFO_BADGE} ${BUTTON_LINK}`}
            onClick={counts.onChanged}
          >
            {text("header.agentUpdated")}
          </button>
        )}
      </span>
    </div>
  );
};
