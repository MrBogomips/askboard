// Small text rules of the core: the epoch, the derived title, names cut to fit, and cursors.

import {
  CURSOR_PATTERN,
  NAME_MAX_CHARS,
  TITLE_MAX_CHARS,
  UTC_TIME_PATTERN,
} from "@askboard/contract";
import type { Randomness } from "./ports.ts";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
// The largest multiple of the alphabet's size below 256: a byte at or above it would make the
// first characters likelier, so it is drawn again.
const UNBIASED_BELOW = 256 - (256 % ALPHABET.length);

/** The epoch's length: 36^8 values, so two session processes practically never share one. */
export const EPOCH_LENGTH = 8;

export const makeEpoch = (randomness: Randomness): string => {
  let epoch = "";
  while (epoch.length < EPOCH_LENGTH) {
    for (const byte of randomness.bytes(EPOCH_LENGTH - epoch.length)) {
      if (byte < UNBIASED_BELOW) epoch += ALPHABET[byte % ALPHABET.length];
    }
  }
  return epoch;
};

// Cuts a text to at most `max` characters, counting code points, so a character is never split.
const cut = (text: string, max: number, ending: string): string => {
  const characters = [...text];
  if (characters.length <= max) return text;
  return `${characters
    .slice(0, max - [...ending].length)
    .join("")
    .trimEnd()}${ending}`;
};

/** An ask's title from its first question's text, cut at the contract's length (FR-1). */
export const deriveTitle = (text: string): string => cut(text, TITLE_MAX_CHARS, "…");

/** A name as an answer's `who` carries it: trimmed, and cut to the contract's limit. */
export const nameOf = (name: string | undefined): string | undefined => {
  const trimmed = name?.trim();
  return trimmed ? cut(trimmed, NAME_MAX_CHARS, "") : undefined;
};

export const cursorOf = (epoch: string, seq: number): string => `${epoch}.${seq}`;

const CURSOR = new RegExp(CURSOR_PATTERN);

/** A cursor's epoch and `seq`, or undefined when it is not `<epoch>.<seq>` (AD-3). */
export const parseCursor = (cursor: string): { epoch: string; seq: number } | undefined => {
  if (!CURSOR.test(cursor)) return undefined;
  const dot = cursor.indexOf(".");
  const seq = Number(cursor.slice(dot + 1));
  return Number.isSafeInteger(seq) ? { epoch: cursor.slice(0, dot), seq } : undefined;
};

const UTC_TIME = new RegExp(UTC_TIME_PATTERN);

const daysIn = (year: number, month: number): number => {
  if (month !== 2) return [4, 6, 9, 11].includes(month) ? 30 : 31;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 29 : 28;
};

/**
 * Whether a time is RFC 3339 UTC as the contract writes it and names a real day: the contract's
 * pattern cannot see an impossible day such as February 30.
 */
export const isRealUtcTime = (when: string): boolean => {
  if (!UTC_TIME.test(when)) return false;
  const [year, month, day] = when.slice(0, 10).split("-").map(Number) as [number, number, number];
  return day <= daysIn(year, month);
};
