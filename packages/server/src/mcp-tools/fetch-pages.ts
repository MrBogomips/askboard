// `fetch` pages (ask-lifecycle, design decision 4; proposal, open question 5): an item whose full
// value does not fit one result comes as consecutive slices of its RFC 8785 JSON text, cut at
// code-point boundaries, each within the contract's page size and each result under the result
// limit once the slice is escaped into it. A continuation names the ask and the epoch, the item,
// its rev, the generation ask-core gave its value and the next offset, as base64url of that JSON.

import { FETCH_PAGE_MAX_CHARS, RESULT_MAX_CHARS } from "@askboard/contract";

/** Where the next page of an item's value starts, and which value it is a page of. */
export type Continuation = {
  /** The ask and the session epoch: another ask's item of the same ID is another value. */
  readonly askId: string;
  readonly epoch: string;
  readonly itemId: string;
  /** The question's rev; an area has none. */
  readonly rev?: number;
  readonly generation: number;
  /** In UTF-16 code units into the value's RFC 8785 JSON text. */
  readonly offset: number;
};

export const encodeContinuation = ({
  askId,
  epoch,
  itemId,
  rev,
  generation,
  offset,
}: Continuation): string =>
  Buffer.from(
    JSON.stringify({
      askId,
      epoch,
      itemId,
      ...(rev === undefined ? {} : { rev }),
      generation,
      offset,
    }),
    "utf8",
  ).toString("base64url");

const isCount = (value: unknown, least: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= least;

/** The continuation a base64url text holds, or undefined when it holds none `fetch` could write. */
export const decodeContinuation = (text: string): Continuation | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { askId, epoch, itemId, rev, generation, offset } = value as Record<string, unknown>;
  if (typeof askId !== "string" || typeof epoch !== "string" || typeof itemId !== "string") {
    return undefined;
  }
  if (!isCount(generation, 0) || !isCount(offset, 1)) return undefined;
  if (rev !== undefined && !isCount(rev, 1)) return undefined;
  return { askId, epoch, itemId, ...(rev === undefined ? {} : { rev }), generation, offset };
};

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Whether `offset` falls between two code points of `text`, never inside a surrogate pair. */
export const atCodePoint = (text: string, offset: number): boolean =>
  offset <= 0 ||
  offset >= text.length ||
  !(isHigh(text.charCodeAt(offset - 1)) && isLow(text.charCodeAt(offset)));

/**
 * The longest slice of `text` from `offset` that holds at most the contract's page size and whose
 * JSON string form, quotes aside, takes at most `escapedMax` characters; cut between code points.
 */
export const sliceFrom = (text: string, offset: number, escapedMax: number): string => {
  let end = offset;
  let escaped = 0;
  while (end < text.length) {
    const width = isHigh(text.charCodeAt(end)) && isLow(text.charCodeAt(end + 1)) ? 2 : 1;
    const cost = JSON.stringify(text.slice(end, end + width)).length - 2;
    if (end + width - offset > FETCH_PAGE_MAX_CHARS || escaped + cost > escapedMax) break;
    end += width;
    escaped += cost;
  }
  return text.slice(offset, end);
};

/**
 * The page of `text` from `offset`: its slice, and the continuation of the next page unless it is
 * the last. `envelope` writes the result around a slice; the room it leaves under the result limit
 * is measured with the longest continuation this value can have.
 */
export const pageOf = (
  text: string,
  offset: number,
  next: Omit<Continuation, "offset">,
  envelope: (part: string, continuation?: string) => unknown,
): { readonly part: string; readonly continuation?: string } => {
  const longest = encodeContinuation({ ...next, offset: text.length });
  const room = RESULT_MAX_CHARS - 1 - JSON.stringify(envelope("", longest)).length;
  const part = sliceFrom(text, offset, room);
  const end = offset + part.length;
  if (end >= text.length) return { part };
  return { part, continuation: encodeContinuation({ ...next, offset: end }) };
};
