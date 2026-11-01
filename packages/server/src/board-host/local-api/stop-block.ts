// The stop guard's block as the local API sends it (design decision 2, review fix of 2026-11-01;
// AD-10): the push message with the subagent's open asks, holding the events above `received` in
// order up to the response limit. The open asks take at most half of the response, so the first
// event always fits; a block that cannot hold every event stops at the last whole one, and ask-core
// raises `received` to that one only, so the hook never drops a block whose answers count as
// delivered. What it leaves stays above `received`, and the open-asks list tells the subagent to
// collect it.

import {
  type CollectAskEntry,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_VERSION,
  type OpenAsk,
  OUTPUT_FORMAT_VERSION,
  type StopDecision,
} from "@askboard/contract";
import type { StopBlock, StopFit } from "@askboard/core";
import { jsonBytes } from "./poll.ts";

/** The most of a stop response its open asks may take, so that the events always have room. */
export const OPEN_ASKS_MAX_BYTES = LOCAL_API_MAX_BYTES / 2;

type Event = CollectAskEntry["events"][number];

/** The decision a block makes, as `POST /v1/stop` answers it. */
export const blockDecision = (epoch: string, { asks, openAsks }: StopBlock): StopDecision => ({
  version: LOCAL_API_VERSION,
  decision: "block",
  message: { versions: { output: OUTPUT_FORMAT_VERSION }, epoch, asks, openAsks },
});

// The open asks, in order, as many as their share of the response holds.
const listed = (openAsks: readonly OpenAsk[]): OpenAsk[] => {
  const kept: OpenAsk[] = [];
  let size = 2;
  for (const ask of openAsks) {
    size += jsonBytes(ask) + (kept.length > 0 ? 1 : 0);
    if (size > OPEN_ASKS_MAX_BYTES) break;
    kept.push(ask);
  }
  return kept;
};

/** The fit ask-core applies to a stop block of this epoch: what one local API response holds. */
export const fitStop =
  (epoch: string): StopFit =>
  ({ asks, openAsks }) => {
    const carried: CollectAskEntry[] = [];
    const block = { asks: carried, openAsks: listed(openAsks) };
    let size = jsonBytes(blockDecision(epoch, block));
    for (const ask of asks) {
      // The ask's entry, its comma and its empty list, then each event and its comma.
      let cost = jsonBytes({ ...ask, events: [] }) + (carried.length > 0 ? 1 : 0);
      const taken: Event[] = [];
      for (const event of ask.events) {
        cost += jsonBytes(event) + (taken.length > 0 ? 1 : 0);
        const first = carried.length === 0 && taken.length === 0;
        if (!first && size + cost > LOCAL_API_MAX_BYTES) {
          const last = taken.at(-1);
          if (last !== undefined) carried.push({ ...ask, cursor: last.cursor, events: taken });
          return block;
        }
        taken.push(event);
      }
      size += cost;
      carried.push(ask);
    }
    return block;
  };
