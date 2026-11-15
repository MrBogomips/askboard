// The follow-up composer (board-keys, design decisions 5 and 6): the text area, which sends on the
// board table's `board.sendFollowUp` key, and "Send", which carries that key as a hint. Enter adds a
// line; a held key sends once, never again for its repeats (NFR-10).

import { FOLLOW_UP_MAX_CHARS, type KeyEntry } from "@askboard/contract";
import type { RefObject } from "react";
import { KeyHint } from "../catalog/keys/key-help.tsx";
import { BUTTON_SECONDARY, TEXT_FIELD } from "./styles.ts";
import { sendKeyOf } from "./thread-text.ts";

export type ComposerProps = {
  readonly composerRef: RefObject<HTMLTextAreaElement | null>;
  readonly label: string;
  readonly sendLabel: string;
  readonly value: string;
  /** The text area takes text: the question is usable and no follow-up is on its way. */
  readonly editable: boolean;
  readonly canSend: boolean;
  /** The board's table in effect. */
  readonly table: readonly KeyEntry[];
  readonly onChange: (text: string) => void;
  readonly onSend: () => void;
};

export const Composer = ({
  composerRef,
  label,
  sendLabel,
  value,
  editable,
  canSend,
  table,
  onChange,
  onSend,
}: ComposerProps) => {
  const send = table.find((entry) => entry.action === "board.sendFollowUp");
  const sendButton = (
    <button type="button" className={BUTTON_SECONDARY} disabled={!canSend} onClick={onSend}>
      {sendLabel}
    </button>
  );
  return (
    <div className="flex items-end gap-sm border-t border-border p-sm">
      <textarea
        ref={composerRef}
        aria-label={label}
        placeholder={label}
        value={value}
        readOnly={!editable}
        maxLength={FOLLOW_UP_MAX_CHARS}
        rows={2}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!sendKeyOf(table, event)) return;
          event.preventDefault();
          if (canSend && !event.repeat) onSend();
        }}
        className={TEXT_FIELD}
      />
      {send === undefined ? sendButton : <KeyHint entry={send}>{sendButton}</KeyHint>}
    </div>
  );
};
