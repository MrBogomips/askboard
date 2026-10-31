// An ask's append-only event log (AD-3): each entry with its `seq` and the number of the command
// that appended it, which `collect`'s pager keeps together and which never reaches the wire
// (ask-lifecycle, design decision 4). A tombstone drops the entries the agent has acknowledged
// (AD-21); `seq` numbering never restarts.

import type { OutputEvent } from "@askboard/contract";

export type Entry<E extends OutputEvent = OutputEvent> = {
  readonly seq: number;
  /** The command that appended it: every event of one command shares the number. */
  readonly group: number;
  readonly event: E;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

/** A deep copy that shares nothing with the caller, frozen. */
export const frozenCopy = <T>(value: T): T => deepFreeze(JSON.parse(JSON.stringify(value)) as T);

const itemOf = (event: OutputEvent): string | undefined =>
  "itemId" in event ? event.itemId : undefined;

export class EventLog {
  #entries: Entry[] = [];
  // The `seq` before the first entry held; entries are never renumbered.
  #dropped = 0;
  #groups = 0;
  // Each question's entries, for its state and thread; empty once the ask is a tombstone.
  #byItem = new Map<string, Entry[]>();

  /** The `seq` of the latest event, 0 before the first. */
  get latestSeq(): number {
    return this.#dropped + this.#entries.length;
  }

  /**
   * Appends events, already carrying their cursors, as one command: consecutive `seq`s and one
   * group number. Returns the entries, frozen.
   */
  append(events: readonly OutputEvent[]): readonly Entry[] {
    this.#groups += 1;
    const group = this.#groups;
    const entries = events.map((event, index) =>
      deepFreeze({ seq: this.latestSeq + index + 1, group, event: frozenCopy(event) }),
    );
    for (const entry of entries) {
      this.#entries.push(entry);
      const itemId = itemOf(entry.event);
      if (itemId === undefined) continue;
      const list = this.#byItem.get(itemId) ?? [];
      list.push(entry);
      this.#byItem.set(itemId, list);
    }
    return entries;
  }

  /** The entries after `seq`, in order; dropped ones are gone. */
  after(seq: number): readonly Entry[] {
    return this.#entries.slice(Math.max(seq - this.#dropped, 0));
  }

  /** The entry at `seq`, unless it is dropped or not appended yet. */
  at(seq: number): Entry | undefined {
    return seq > this.#dropped ? this.#entries[seq - this.#dropped - 1] : undefined;
  }

  /** A question's entries, in order. */
  ofItem(itemId: string): readonly Entry[] {
    return this.#byItem.get(itemId) ?? [];
  }

  /** Whether any entry is an answer, a decline or a postpone: the ask is no longer waiting. */
  hasActed(): boolean {
    return this.#entries.some(({ event }) => event.type === "answer" || event.type === "postponed");
  }

  /** Drops every entry at or below `seq`, for a tombstone (AD-21). */
  dropThrough(seq: number): void {
    const count = Math.min(seq, this.latestSeq) - this.#dropped;
    if (count <= 0) return;
    this.#entries = this.#entries.slice(count);
    this.#dropped += count;
  }

  /** Forgets the per-question index, which only a live ask reads. */
  forgetItems(): void {
    this.#byItem = new Map();
  }
}
