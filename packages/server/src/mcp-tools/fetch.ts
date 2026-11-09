// The `fetch` tool (AD-6, FR-20; ask-lifecycle, design decision 4): one item of an open or closed
// ask as ask-core holds it now, in full, or page by page when it does not fit one result. It reads
// nothing from the draft record and raises no `received` (AD-3). A discarded ask, and one this
// epoch does not hold, is a typed result, never an error (AD-10); so is an item the agent deleted,
// at any depth, the outcome `deleted` beside `discarded` (agent-facing-gaps). An ID the ask never
// held, or one a change dropped, stays an error.

import {
  FETCH_PAGE_MAX_CHARS,
  type FetchOutcomeResult,
  type FetchPage,
  type FetchResult,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
} from "@askboard/contract";
import { validateFetchRequest } from "@askboard/contract/validate";
import { canonicalize, type FullValue } from "@askboard/core";
import { atCodePoint, decodeContinuation, pageOf } from "./fetch-pages.ts";
import { ownerCheck, uncheckedMark } from "./owner-refusal.ts";
import { errorResult, jsonResult, problemsResult, type ToolResult } from "./results.ts";
import type { ToolHandler } from "./server.ts";

const REFUSED = "The fetch request was refused. Fix these problems and send it again:";

// The item ask-core holds, with the result's unchecked mark while the ask has no owner (AD-5).
type Held = Extract<FullValue, { kind: "item" }> & { readonly unchecked?: true };

const notHeld = (
  value: Exclude<FullValue, Held>,
  epoch: string,
  unchecked: { readonly unchecked?: true },
): ToolResult => {
  if (value.kind === "discarded") {
    const typed: FetchOutcomeResult = {
      versions: RESULT_VERSIONS,
      epoch,
      askId: value.askId,
      outcome: "discarded",
    };
    return jsonResult(typed);
  }
  const { askId, itemId } = value;
  if (value.kind === "deleted") {
    const typed: FetchOutcomeResult = {
      versions: RESULT_VERSIONS,
      epoch,
      askId,
      itemId,
      outcome: "deleted",
      ...unchecked,
    };
    return jsonResult(typed);
  }
  return errorResult(
    `The fetch was refused: the ask "${askId}" has no item "${itemId}"; name a question, an area, a widget item or a molecule reference the ask holds, by the ID you sent.`,
  );
};

const unknownContinuation = (itemId: string) =>
  errorResult(
    `The continuation is not one fetch returned for the item "${itemId}": fetch it again without a continuation.`,
  );

const changed = (itemId: string) =>
  errorResult(
    `The item "${itemId}" changed since that continuation was returned: fetch it again without a continuation, from its first page.`,
  );

// The page of the held value that a continuation names, or why it names none. A continuation is
// one fetch returned for this ask in this epoch, or none (fail closed, AD-10).
const continued = (held: Held, epoch: string, text: string, continuation: string): ToolResult => {
  const { item } = held;
  const rev = item.type === "question" ? item.rev : undefined;
  const at = decodeContinuation(continuation);
  if (at === undefined || at.askId !== held.askId || at.epoch !== epoch || at.itemId !== item.id) {
    return unknownContinuation(item.id);
  }
  if (at.generation !== held.generation || at.rev !== rev) return changed(item.id);
  if (fits(held, epoch, text) || at.offset >= text.length || !atCodePoint(text, at.offset)) {
    return unknownContinuation(item.id);
  }
  return page(held, epoch, text, at.offset);
};

const page = (held: Held, epoch: string, text: string, offset: number): ToolResult => {
  const { item, generation, askId } = held;
  const rev = item.type === "question" ? item.rev : undefined;
  const envelope = (part: string, continuation?: string): FetchPage => ({
    versions: RESULT_VERSIONS,
    epoch,
    askId,
    itemId: item.id,
    part,
    ...(continuation === undefined ? {} : { continuation }),
    ...(held.unchecked ? { unchecked: true as const } : {}),
  });
  const next = { askId, epoch, itemId: item.id, ...(rev === undefined ? {} : { rev }), generation };
  const { part, continuation } = pageOf(text, offset, next, envelope);
  return jsonResult(envelope(part, continuation));
};

const whole = (held: Held, epoch: string): FetchResult => ({
  versions: RESULT_VERSIONS,
  epoch,
  askId: held.askId,
  state: held.state,
  item: held.item,
  ...(held.unchecked ? { unchecked: true as const } : {}),
});

// Whether the value goes whole in one result: its text within a page, and the result under the
// limit, which the page size leaves room for.
const fits = (held: Held, epoch: string, text: string): boolean =>
  text.length <= FETCH_PAGE_MAX_CHARS &&
  JSON.stringify(whole(held, epoch)).length < RESULT_MAX_CHARS;

/**
 * `fetch`: validates the request, then returns the item whole when its RFC 8785 JSON text fits a
 * page, else its first page, or the page a continuation names while the value is unchanged.
 */
export const handleFetch: ToolHandler = async ({ core }, args, context) => {
  const checked = validateFetchRequest(args ?? {});
  if (!checked.ok) return problemsResult(REFUSED, checked.problems);
  // Only the owner's call goes on (AD-5).
  const refused = await ownerCheck(core, "fetch", args, context);
  if (refused !== undefined) return refused;
  const { askId, itemId, continuation } = checked.value;
  const full = core.fullValue(askId, itemId);
  const unchecked = uncheckedMark(core, askId);
  if (full.kind !== "item") return notHeld(full, core.epoch, unchecked);
  const value: Held = { ...full, ...unchecked };
  const text = canonicalize(value.item);
  if (continuation !== undefined) return continued(value, core.epoch, text, continuation);
  if (fits(value, core.epoch, text)) return jsonResult(whole(value, core.epoch));
  return page(value, core.epoch, text, 0);
};
