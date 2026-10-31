// The draft mirror's board-page side (ask-lifecycle, design decision 6; AD-20, FR-25): the view
// sends its draft record after each change; the board page keeps the latest, for "Copy my unsent
// work" and the leave-page prompt, and sends it to `board-host` 300 ms after the last change, at
// once when the page is hidden or going away, and again on each new socket. Told the board moved,
// it sends its last record at once, since a takeover takes only the older tab's last draft.

import type { DraftRecord } from "@askboard/contract";

/** How long the board page waits after the view's last change before it mirrors the record. */
export const DRAFT_DEBOUNCE_MS = 300;

export type DraftMirrorDeps = {
  /** Runs `run` after `ms`; returns what cancels it. */
  readonly schedule: (ms: number, run: () => void) => () => void;
  /** Sends the record as a `draft` message; false when the board is not live. */
  readonly send: (record: DraftRecord) => boolean;
};

export type DraftMirror = {
  /** The view's latest record; it goes once the view has been quiet for the debounce. */
  take(record: DraftRecord): void;
  /** Sends the latest record now, unless it went already. */
  flush(): void;
  /** Sends the latest record now, even if it went already: the board moved. */
  flushLast(): void;
  /** A new socket is live: the latest record goes again. */
  resend(): void;
  /** The view's latest record, if it sent one. */
  latest(): DraftRecord | undefined;
};

export const createDraftMirror = ({ schedule, send }: DraftMirrorDeps): DraftMirror => {
  let latest: DraftRecord | undefined;
  let sentText: string | undefined;
  let cancel: (() => void) | undefined;
  const stopTimer = () => {
    cancel?.();
    cancel = undefined;
  };
  const sendLatest = (always: boolean) => {
    stopTimer();
    if (latest === undefined) return;
    const text = JSON.stringify(latest);
    if (!always && text === sentText) return;
    if (send(latest)) sentText = text;
  };
  return {
    take: (record) => {
      latest = record;
      stopTimer();
      cancel = schedule(DRAFT_DEBOUNCE_MS, () => {
        cancel = undefined;
        sendLatest(false);
      });
    },
    flush: () => sendLatest(false),
    flushLast: () => sendLatest(true),
    resend: () => sendLatest(true),
    latest: () => latest,
  };
};
