// What a push carries (design decision 8): the contract's push message, one per agent and poll, its
// ask entries shaped as `collect` returns them, so the agent reads one shape whatever the path.

import {
  type AskState,
  type CollectAskEntry,
  OUTPUT_FORMAT_VERSION,
  type PolledEvent,
  pushMessageText,
} from "@askboard/contract";

/** One ask's events in a push: its ID, state and latest cursor, and the events pushed. */
export type PushedAsk = {
  readonly askId: string;
  readonly state: AskState;
  readonly cursor: string;
  readonly events: readonly PolledEvent[];
};

/** An event's key in the mod's memory of what it pushed in an epoch. */
export const eventKey = (askId: string, cursor: string): string => `${askId} ${cursor}`;

export const keysOf = (asks: readonly PushedAsk[]): string[] =>
  asks.flatMap((ask) => ask.events.map((event) => eventKey(ask.askId, event.cursor)));

/** The `seq` of a cursor, `<epoch>.<seq>`. */
export const seqOf = (cursor: string): number => Number(cursor.slice(cursor.lastIndexOf(".") + 1));

/** The cursor of an entry's last event: the one a delivery report raises `received` to. */
export const lastCursor = (ask: PushedAsk): string =>
  ask.events.reduce((last, event) => (seqOf(event.cursor) > seqOf(last) ? event.cursor : last), "");

/**
 * The text of one push: the preface, then the push message. A `closed` event, which the poll may
 * list, joins `collect`'s event union with E3's output-format minor (task 3.6); until then nothing
 * appends one, so every entry is a `collect` entry.
 */
export const pushText = (epoch: string, asks: readonly PushedAsk[]): string =>
  pushMessageText({
    versions: { output: OUTPUT_FORMAT_VERSION },
    epoch,
    asks: asks as readonly CollectAskEntry[],
  });

/**
 * Entries of several pushes as one: each ask once, in the order it first came, its events in `seq`
 * order with no repeat, and its state and cursor from its latest entry.
 */
export const merged = (asks: readonly PushedAsk[]): PushedAsk[] => {
  const byAsk = new Map<string, PushedAsk>();
  for (const ask of asks) {
    const known = byAsk.get(ask.askId);
    if (known === undefined) {
      byAsk.set(ask.askId, ask);
      continue;
    }
    const events = new Map(known.events.map((event) => [event.cursor, event]));
    for (const event of ask.events) events.set(event.cursor, event);
    const latest = seqOf(ask.cursor) >= seqOf(known.cursor) ? ask : known;
    byAsk.set(ask.askId, {
      askId: ask.askId,
      state: latest.state,
      cursor: latest.cursor,
      events: [...events.values()].sort((a, b) => seqOf(a.cursor) - seqOf(b.cursor)),
    });
  }
  return [...byAsk.values()];
};
