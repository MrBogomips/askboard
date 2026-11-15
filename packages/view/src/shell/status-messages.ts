// The status store (answering-flow-fixes, design decision 4; #182): what the board says to a screen
// reader, as descriptors the status region turns into text in the ask's language. The store counts
// each announcement, so a repeated message is announced again; descriptors announced in the same
// turn of the event loop are read together, in order.

import type { Slots, StringKey } from "../strings/index.ts";

/** A message by its string key and slots; the region renders it. */
export type StatusMessage = { readonly key: StringKey; readonly params?: Slots };

export type StatusSnapshot = {
  /** The count of announcements so far: a change of it makes the region speak. */
  readonly n: number;
  /** The messages of the current batch, in the order announced. */
  readonly messages: readonly StatusMessage[];
};

export type StatusMessages = {
  announce(message: StatusMessage): void;
  /** The same snapshot until the next announcement, as `useSyncExternalStore` needs. */
  get(): StatusSnapshot;
  subscribe(listener: () => void): () => void;
};

export const createStatusMessages = (): StatusMessages => {
  let snapshot: StatusSnapshot = { n: 0, messages: [] };
  let open = false;
  const listeners = new Set<() => void>();
  return {
    announce: (message) => {
      snapshot = {
        n: snapshot.n + 1,
        messages: open ? [...snapshot.messages, message] : [message],
      };
      if (!open) {
        open = true;
        queueMicrotask(() => {
          open = false;
        });
      }
      for (const listener of [...listeners]) listener();
    },
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
