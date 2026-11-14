// One bound for the warnings of an `ask` or `update` result (result-bound, design decision 4; AD-6):
// the `formula` and the `unresolved-pointer` warnings each keep a share of `RESULT_MAX_CHARS`, and
// past it one closing warning stands for the first warning left out. Pure, plain ECMAScript
// (AD-1).

export type WarningBound<T> = {
  /** The most characters the JSON text of the whole list may take, closing warning included. */
  readonly max: number;
  /**
   * The room kept free for the closing warning, in characters of JSON text. It includes the comma
   * before the closing warning: the loop does not count that comma, so a caller whose closing
   * warning can fill the room adds one to it.
   */
  readonly room: number;
  /** The closing warning for `first`, the first warning left out, with `left` warnings after it. */
  readonly closing: (first: T, left: number) => T;
};

const jsonLength = (warning: unknown): number => JSON.stringify(warning).length;

/**
 * The warnings within `max` characters of JSON text, measured as `JSON.stringify` writes them,
 * brackets, commas and escapes included. A list within `max` is returned as it is. Past it, the
 * warnings kept in order leave `room` free, then `closing(firstLeftOut, countAfter)` ends the list,
 * so that the kept, the closing one and the count make up the input.
 */
export const boundedWarnings = <T>(
  warnings: readonly T[],
  { max, room, closing }: WarningBound<T>,
): readonly T[] => {
  const lengths = warnings.map(jsonLength);
  // "[" and "]", and a comma between two warnings.
  const total = lengths.reduce((sum, length) => sum + length, 2) + Math.max(0, lengths.length - 1);
  if (total <= max) return warnings;
  const budget = max - room;
  let used = 2;
  let kept = 0;
  while (kept < warnings.length) {
    const next = used + (lengths[kept] as number) + (kept === 0 ? 0 : 1);
    if (next > budget) break;
    used = next;
    kept += 1;
  }
  return [...warnings.slice(0, kept), closing(warnings[kept] as T, warnings.length - kept - 1)];
};
