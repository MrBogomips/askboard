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
