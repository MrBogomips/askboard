// Short question numbers (answering-flow-visual, design decision 6; #168 settling point 7): pure.
// A number is given to a question once, in board order, kept while the question is on the board
// and never given again after it leaves. Typed on its own, so it imports nothing: the caller
// passes the shared maximum (`QUESTION_NUMBER_MAX`).

/** The numbers the board gave: by question ID, and the next one to give. */
export type Numbers = {
  readonly byId: ReadonlyMap<string, number>;
  readonly next: number;
};

/**
 * Keeps every held number of a question still on the board, gives each question without one the
 * next number in board order, and returns them with the next number, which never decreases and is
 * above every held number, so a removed question's number is never given again. A question that
 * would pass `max` stays unnumbered, and no held number above `max` is kept.
 */
export const numbersOf = (
  held: Numbers | undefined,
  boardOrder: readonly string[],
  max: number,
): Numbers => {
  const byId = new Map<string, number>();
  let next = held?.next ?? 1;
  for (const id of boardOrder) {
    const number = held?.byId.get(id);
    if (number === undefined || number > max) continue;
    byId.set(id, number);
    if (number >= next) next = number + 1;
  }
  for (const id of boardOrder) {
    if (byId.has(id) || held?.byId.has(id) === true) continue;
    if (next > max) continue;
    byId.set(id, next);
    next += 1;
  }
  return { byId, next: Math.min(next, max + 1) };
};
