// What resolving a pointer gives (excerpts, design decisions 2 and 3; proposal B9): the reasons a
// pointer stays unresolved, which `excerpts` and `ask-core` give, the `unresolved-pointer` warning
// names and the board document records.

/** Why a pointer stays unresolved; the warning and the board document name these. */
export const UNRESOLVED_REASONS = [
  "no-root",
  "invalid-pointer",
  "outside-root",
  "not-found",
  "not-a-file",
  "anchor-not-found",
  "not-text",
  "not-image",
  "too-large",
  "timeout",
] as const;

export type UnresolvedReason = (typeof UNRESOLVED_REASONS)[number];
