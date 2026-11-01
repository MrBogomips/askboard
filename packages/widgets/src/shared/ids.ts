// The next view-made element ID (design decision 11, finding F10), one rule for every widget: an
// element the user adds gets `u-<n>`, `n` one more than the highest such number among the item's
// element IDs, so the first is `u-1`. Agent IDs never start with the prefix, so they never collide.

import { VIEW_ID_PREFIX } from "@askboard/contract";

const DIGITS = /^[0-9]+$/;

/** The ID for an element the user adds, from the IDs the item's elements hold. */
export const nextViewId = (ids: Iterable<string>): string => {
  // A bigint, so that a number past the safe integers still gives an ID the item does not hold.
  let highest = 0n;
  for (const id of ids) {
    const number = id.slice(VIEW_ID_PREFIX.length);
    if (!id.startsWith(VIEW_ID_PREFIX) || !DIGITS.test(number)) continue;
    const value = BigInt(number);
    if (value > highest) highest = value;
  }
  return `${VIEW_ID_PREFIX}${highest + 1n}`;
};
