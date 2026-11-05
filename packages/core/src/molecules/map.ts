// The expansion map (AD-9; molecules design decision 4; proposal, open question 6): which expanded
// item of a board document belongs to which molecule reference, with the molecule's name and
// version. `ask-core` keeps it beside the board document, which never holds a reference; the
// view, `fetch` and Snapshots read only board documents. Plain ECMAScript (AD-1).

/** What one expanded item came from. */
export type ExpansionEntry = {
  /** The molecule reference's ID in the ask. */
  readonly reference: string;
  readonly molecule: string;
  /** The definition's version the reference expanded with. */
  readonly version: string;
};

/** Each expanded item's entry, by the expanded item's ID, in the order of the references in the ask. */
export type ExpansionMap = ReadonlyMap<string, ExpansionEntry>;

/** One expanded item, as a Snapshot's data block lists it (E7). */
export type ExpansionRecord = {
  /** The expanded item's ID in the board document. */
  readonly itemId: string;
  readonly reference: string;
  readonly molecule: string;
  readonly version: string;
};

/**
 * The expansion map as frozen records, in the order of the references in the ask: the read-only
 * view E7's Snapshot gathering reads. Changes nothing.
 */
export const expansionEntries = (map: ExpansionMap): readonly ExpansionRecord[] =>
  Object.freeze(
    [...map].map(([itemId, { reference, molecule, version }]) =>
      Object.freeze({ itemId, reference, molecule, version }),
    ),
  );
