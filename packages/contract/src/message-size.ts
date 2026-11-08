// The board's message limit and its measure (oversized-acts, design decision 1): one limit that
// `board-host` and the board page share, and the one way a message and a draft record are counted.
// Plain ECMAScript: `contract` uses no DOM, Node or Bun API.

import { DRAFT_RECORD_MAX_CHARS } from "./lifecycle-limits.ts";
import { CHOICE_LABELS_MAX_CHARS } from "./limits.ts";

/**
 * The largest message a board page may send, in UTF-8 bytes: a draft record of the draft limit, or
 * an answer naming every option of a question whose labels take the most room, whichever is larger,
 * at three UTF-8 bytes per UTF-16 unit, plus the envelope. A draft record within the draft limit
 * therefore always measures within it. `board-host` passes it to the socket as its payload limit;
 * the board page refuses a command over it.
 */
export const BOARD_MESSAGE_MAX_BYTES =
  Math.max(CHOICE_LABELS_MAX_CHARS, DRAFT_RECORD_MAX_CHARS) * 3 + 4 * 1024;

/**
 * The WebSocket close code for a message too big (RFC 6455), which the socket library sends on a
 * message past the payload limit. Not one of `BOARD_CLOSE_CODES`, which carry the board's own meanings.
 */
export const MESSAGE_TOO_BIG_CLOSE = 1009;

/**
 * The length of `text` in UTF-8 bytes. A lone surrogate counts as 3, the bytes of the replacement
 * character that WebSocket's `send` writes for it. Counted by hand because `contract` uses no
 * `TextEncoder` or `Buffer`.
 */
export const utf8Length = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && isLowSurrogate(text.charCodeAt(index + 1))) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
};

const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

/** The size of `message` as the board page's socket sends it: the UTF-8 length of its JSON text. */
export const boardMessageBytes = (message: unknown): number => utf8Length(JSON.stringify(message));

/**
 * The size of a draft record in characters, the count the draft limit applies: the length of its
 * JSON text in UTF-16 units. `board-host` and the board page both refuse a record past
 * `DRAFT_RECORD_MAX_CHARS` by this count.
 */
export const draftRecordChars = (record: unknown): number => JSON.stringify(record).length;
