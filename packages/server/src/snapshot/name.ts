// A Snapshot's file name (snapshot design decision 6, open question A4):
// `<ask-id>-<YYYYMMDDTHHMMSSZ>-<random>.html`, the basic ISO 8601 form of the time it was taken,
// with no colon, and a random part drawn anew for each name tried.

import {
  ID_PATTERN,
  SNAPSHOT_NAME_TRIES,
  SNAPSHOT_RANDOM,
  UTC_TIME_PATTERN,
} from "@askboard/contract";
import type { Randomness } from "@askboard/core";

const ASK_ID = new RegExp(ID_PATTERN);
const UTC_TIME = new RegExp(UTC_TIME_PATTERN);

const { alphabet, length } = SNAPSHOT_RANDOM;

/** The largest multiple of the alphabet's size up to 256: a byte at or above it is drawn again. */
const BYTE_LIMIT = 256 - (256 % alphabet.length);

/** The random part: each character from one byte below the limit, so no character is likelier. */
export const randomPart = (randomness: Randomness): string => {
  let part = "";
  while (part.length < length) {
    for (const byte of randomness.bytes(length - part.length)) {
      if (byte < BYTE_LIMIT) part += alphabet[byte % alphabet.length];
    }
  }
  return part;
};

/** `2026-10-31T16:12:05.987Z` as `20261031T161205Z`: the fraction of a second is dropped. */
const basicTime = (takenAt: string): string => {
  if (!UTC_TIME.test(takenAt)) throw new RangeError("a Snapshot is named by a UTC time");
  const [date = "", time = ""] = takenAt.split("T");
  return `${date.replaceAll("-", "")}T${time.slice(0, 8).replaceAll(":", "")}Z`;
};

/** The names one Snapshot may take: the first, then up to `SNAPSHOT_NAME_TRIES` in all. */
export type SnapshotNames = {
  readonly first: string;
  /** Another name with a new random part, or undefined once every try is used. */
  next(): string | undefined;
};

/**
 * The names of one Snapshot of `askId` taken at `takenAt`. A malformed ask ID or time throws a
 * `RangeError` naming neither, before any name is drawn.
 */
export const snapshotNames = (
  askId: string,
  takenAt: string,
  randomness: Randomness,
): SnapshotNames => {
  if (!ASK_ID.test(askId)) throw new RangeError("a Snapshot is named by a well-formed ask ID");
  const stem = `${askId}-${basicTime(takenAt)}`;
  const draw = () => `${stem}-${randomPart(randomness)}.html`;
  let drawn = 1;
  return {
    first: draw(),
    next: () => {
      if (drawn === SNAPSHOT_NAME_TRIES) return undefined;
      drawn += 1;
      return draw();
    },
  };
};
