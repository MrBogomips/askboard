// What row 2 of the context header shows after the pills (EXPERIENCE.md, Context header; ask-
// lifecycle design decision 6; board-keys design decision 5): the open count, "Next open", the
// unread-reply count and the agent-change flag, then the "Keys" button with its panel, which a board
// that has not ended shows, the single-question board included.

import { KeyHint } from "../catalog/keys/key-help.tsx";
import { useStrings } from "../catalog/port.ts";
import { IconNextOpen } from "../icons/index.ts";
import { BoardKeysButton, type BoardKeysProps } from "./board-keys-panel.tsx";
import { BUTTON_LINK, BUTTON_SECONDARY, INFO_BADGE, SEPARATOR } from "./styles.ts";
import { useBoardKeyTable } from "./use-board-keys.ts";

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

const Counts = ({ counts }: { readonly counts: HeaderCounts }) => {
  const text = useStrings();
  const entry = useBoardKeyTable().find((each) => each.action === "board.nextOpen");
  const jump = (
    <button
      type="button"
      className={BUTTON_SECONDARY}
      disabled={counts.onNextOpen === undefined}
      onClick={counts.onNextOpen}
    >
      {text("header.nextOpen")}
      <IconNextOpen className="size-4" />
    </button>
  );
  return (
    <>
      <span aria-hidden="true" className={SEPARATOR} />
      <span className="text-control font-semibold text-foreground">
        {text("header.open", { count: counts.open })}
      </span>
      {entry === undefined ? jump : <KeyHint entry={entry}>{jump}</KeyHint>}
      {counts.unreadReplies === 0 ? null : (
        <button type="button" className={BUTTON_LINK} onClick={counts.onUnread}>
          {text("header.newReplies", { count: counts.unreadReplies })}
        </button>
      )}
      {counts.changed === 0 ? null : (
        <button type="button" className={`${INFO_BADGE} ${BUTTON_LINK}`} onClick={counts.onChanged}>
          {text("header.agentUpdated")}
        </button>
      )}
    </>
  );
};

export const HeaderActions = ({
  counts,
  keys,
}: {
  readonly counts: HeaderCounts | undefined;
  readonly keys: BoardKeysProps | undefined;
}) => (
  <>
    {counts === undefined ? null : <Counts counts={counts} />}
    {keys === undefined ? null : <BoardKeysButton {...keys} />}
  </>
);
