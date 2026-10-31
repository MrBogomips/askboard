// The `collect` tool (AD-3, AD-6): per ask, its state, latest cursor and the events after the cursor
// passed, grouped by ask in the request's order; paged under the result limit with `more: true`.
// What a result returns raises the ask's `received` watermark, never more (AD-3).

import {
  type CollectAskEntry,
  type CollectRequest,
  type CollectResult,
  type OutputEvent,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
} from "@askboard/contract";
import { type RequestProblem, validateCollectRequest } from "@askboard/contract/validate";
import type { ToolCore } from "./ports.ts";
import { errorResult, jsonResult, problemsResult, type ToolResult } from "./results.ts";
import type { ToolHandler } from "./server.ts";
import { waitForItem } from "./wait.ts";

const REFUSED = "The collect request was refused. Fix these problems and send it again:";

/** An ask as one read found it: its entry before paging, and the cursor that was passed. */
export type Gathered = {
  readonly askId: string;
  readonly after: string;
  readonly state: CollectAskEntry["state"];
  /** The ask's latest cursor, or the cursor passed when the ask is gone. */
  readonly cursor: string;
  readonly events: readonly OutputEvent[];
};

const problemAt = (index: number, field: "askId" | "after", message: string): RequestProblem => ({
  path: `/asks/${index}/${field}`,
  field: `asks[${index}].${field}`,
  expected:
    field === "askId"
      ? "the ID of an ask of this session"
      : "the latest cursor <epoch>.<seq> you received for that ask",
  message: `asks[${index}].${field}: ${message}`,
});

/** Reads every ask the request names, or the problems that make the request one to fix. */
export const gather = (
  core: ToolCore,
  request: CollectRequest,
):
  | { readonly ok: true; readonly asks: Gathered[] }
  | { readonly ok: false; readonly problems: RequestProblem[] } => {
  const asks: Gathered[] = [];
  const problems: RequestProblem[] = [];
  request.asks.forEach(({ askId, after }, index) => {
    const read = core.read(askId, after);
    switch (read.kind) {
      case "events":
        asks.push({ askId, after, state: read.state, cursor: read.cursor, events: read.events });
        return;
      case "discarded":
        asks.push({ askId, after, state: "discarded", cursor: after, events: [] });
        return;
      case "unknown":
        problems.push(
          problemAt(
            index,
            "askId",
            `the ask "${askId}" is not one of this session's asks; an ask from before a restart is reported discarded when you pass the cursor you received for it`,
          ),
        );
        return;
      case "beyond":
        problems.push(
          problemAt(
            index,
            "after",
            `the cursor "${after}" names an event the ask "${askId}" does not have; its latest is "${read.latest}": pass the latest cursor you received`,
          ),
        );
        return;
      case "malformed":
        problems.push(problemAt(index, "after", `"${after}" is not a cursor <epoch>.<seq>`));
    }
  });
  return problems.length === 0 ? { ok: true, asks } : { ok: false, problems };
};

type Page = { readonly result: CollectResult; readonly read: readonly [string, string][] };

const entryOf = (ask: Gathered, events: readonly OutputEvent[]): CollectAskEntry => ({
  askId: ask.askId,
  state: ask.state,
  cursor: events.length === ask.events.length ? ask.cursor : (events.at(-1)?.cursor ?? ask.after),
  events,
  unchecked: true,
});

const resultOf = (
  epoch: string,
  asks: readonly Gathered[],
  taken: readonly OutputEvent[][],
  more: boolean,
  outcome?: "open",
): CollectResult => ({
  versions: RESULT_VERSIONS,
  epoch,
  asks: asks.map((ask, index) => entryOf(ask, taken[index] ?? [])),
  ...(more ? { more: true as const } : {}),
  ...(outcome ? { outcome } : {}),
});

/**
 * The events that fit under the result limit, in order: every ask's events in the request's
 * order, cut at the first that does not fit (AD-6). The first event always goes, so a collect
 * always makes progress; the input format's limits keep any one event far below the limit.
 */
export const page = (epoch: string, asks: readonly Gathered[], outcome?: "open"): Page => {
  const total = asks.reduce((sum, ask) => sum + ask.events.length, 0);
  const taken: OutputEvent[][] = asks.map(() => []);
  const empty = asks.map(() => [] as OutputEvent[]);
  let size = JSON.stringify(resultOf(epoch, asks, empty, true, outcome)).length;
  let count = 0;
  outer: for (const [index, ask] of asks.entries()) {
    const list = taken[index] as OutputEvent[];
    for (const event of ask.events) {
      const previous = list.at(-1)?.cursor ?? ask.after;
      const cost =
        JSON.stringify(event).length +
        (list.length > 0 ? 1 : 0) +
        event.cursor.length -
        previous.length;
      if (count > 0 && size + cost >= RESULT_MAX_CHARS) break outer;
      list.push(event);
      size += cost;
      count += 1;
    }
  }
  const result = resultOf(epoch, asks, taken, count < total, outcome);
  const read = asks.flatMap((ask, index): [string, string][] => {
    const last = taken[index]?.at(-1);
    return last === undefined ? [] : [[ask.askId, last.cursor]];
  });
  return { result, read };
};

/** The result, after raising `received` to what it returns (AD-3). */
export const respond = (
  core: ToolCore,
  asks: readonly Gathered[],
  outcome?: "open",
): ToolResult => {
  const { result, read } = page(core.epoch, asks, outcome);
  for (const [askId, cursor] of read) core.markRead(askId, cursor);
  return jsonResult(result);
};

// A wait names an item of its ask, unless the ask is gone, which ends the wait at once.
const waitProblem = (
  core: ToolCore,
  asks: readonly Gathered[],
  wait: NonNullable<CollectRequest["wait"]>,
): RequestProblem | undefined => {
  const waited = asks.find((ask) => ask.askId === wait.askId);
  if (waited?.state === "discarded") return undefined;
  const items = core.board(wait.askId)?.questions ?? [];
  if (items.some((question) => question.itemId === wait.itemId)) return undefined;
  return {
    path: "/wait/itemId",
    field: "wait.itemId",
    expected: "the ID of an item of that ask",
    message: `wait.itemId: the ask "${wait.askId}" has no item "${wait.itemId}"`,
  };
};

// Something to return at once: an event after a cursor passed, or the waited ask gone.
const hasNews = (asks: readonly Gathered[], askId: string): boolean =>
  asks.some((ask) => ask.events.length > 0 || (ask.askId === askId && ask.state === "discarded"));

/**
 * `collect`: validates the request, reads every ask it names and returns their events. With
 * `wait`, when nothing is new yet, it waits for the item first (AD-4) and returns `open` after the
 * longest wait; an aborted wait marks nothing read.
 */
export const handleCollect: ToolHandler = async (deps, args, context) => {
  const { core } = deps;
  const checked = validateCollectRequest(args ?? {});
  if (!checked.ok) return problemsResult(REFUSED, checked.problems);
  const request = checked.value;
  const gathered = gather(core, request);
  if (!gathered.ok) return problemsResult(REFUSED, gathered.problems);
  const { wait } = request;
  if (wait === undefined) return respond(core, gathered.asks);
  const problem = waitProblem(core, gathered.asks, wait);
  if (problem !== undefined) return problemsResult(REFUSED, [problem]);
  if (hasNews(gathered.asks, wait.askId)) return respond(core, gathered.asks);
  const end = await waitForItem(deps, wait, context);
  if (end === "aborted") return errorResult("The collect was cancelled; nothing was marked read.");
  const again = gather(core, request);
  if (!again.ok) return problemsResult(REFUSED, again.problems);
  return respond(core, again.asks, end === "timeout" ? "open" : undefined);
};
