// The feedback tray's store (answering-flow-visual, design decision 11; requirement "The feedback
// tray"): at most one message per kind, newest first. A message ends by its close control, its own
// end (below) or a newer message of its kind, never on a timer (WCAG 2.2 SC 2.2.1): the clock is
// only the order's stamp. Pure of the DOM; the tray component reads it.

import type { StatusMessage } from "./status-messages.ts";

export type TrayMessage =
  /**
   * A Snapshot's outcome, with the unsent-work note when it applies. No action. The words come
   * from the Snapshot control's state, which the tray component reads, so `text` is optional.
   */
  | {
      readonly kind: "snapshot";
      readonly text?: StatusMessage;
      readonly note?: StatusMessage;
    }
  /** A prefill's result; "Undo" ends it, and so does the end of change 4's batch. */
  | {
      readonly kind: "prefill";
      readonly text: StatusMessage;
      /** "Undo": clears what the prefill filled (answering-flow-guidance, decision 8). */
      readonly onUndo?: () => void;
    }
  /** Questions the agent added, by ID; "Go" reaches the first still unseen. */
  | {
      readonly kind: "added";
      readonly text: StatusMessage;
      readonly questions: readonly string[];
    };

export type TrayKind = TrayMessage["kind"];

/** A message as the tray holds it: stamped when it was shown. */
export type TrayEntry = TrayMessage & { readonly at: number };

export type Tray = {
  /** The messages, newest first; the same array until the next change. */
  get(): readonly TrayEntry[];
  /** Shows a message, replacing the older one of its kind. */
  show(message: TrayMessage): void;
  /** The close control, "Undo" or "Go": ends the message of the kind. */
  close(kind: TrayKind): void;
  /** Change 4's batch ended (the next draft change or act): a prefill message ends. */
  batchEnded(): void;
  /** The set of questions the agent added and the user has not seen: an added message ends when none it names is in it. */
  unseenChanged(unseen: ReadonlySet<string>): void;
  subscribe(listener: () => void): () => void;
};

/** The question "Go" reaches: the first the message names that is still unseen. */
export const goTargetOf = (
  message: Extract<TrayMessage, { kind: "added" }>,
  unseen: ReadonlySet<string>,
): string | undefined => message.questions.find((id) => unseen.has(id));

export const createTray = (clock: () => number = Date.now): Tray => {
  let entries: readonly TrayEntry[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly TrayEntry[]) => {
    if (next.length === entries.length && next.every((entry, n) => entry === entries[n])) return;
    entries = next;
    for (const listener of listeners) listener();
  };
  const without = (kind: TrayKind) => entries.filter((entry) => entry.kind !== kind);
  return {
    get: () => entries,
    show: (message) => set([{ ...message, at: clock() }, ...without(message.kind)]),
    close: (kind) => set(without(kind)),
    batchEnded: () => set(without("prefill")),
    unseenChanged: (unseen) =>
      set(
        entries.filter(
          (entry) => entry.kind !== "added" || entry.questions.some((id) => unseen.has(id)),
        ),
      ),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
