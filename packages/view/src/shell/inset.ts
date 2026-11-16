// The heights the view's panels and moves clear (DESIGN.md, Reading panel; answering-flow-visual,
// design decisions 11 and 12): the header's bottom edge, the strip of tabs' and the feedback tray's
// while it holds a message. There is no bottom bar: the bottom inset is 0, the viewport's foot.
// Whole CSS pixels and bounded, since the board page takes them from the view and checks them.

import { INSET_MAX, type ReferenceInset } from "../view-protocol.ts";

type Measures = {
  /** The header's bottom edge, from the viewport's top; absent without a header. */
  readonly headerBottom?: number;
};

const bounded = (height: number): number => Math.min(INSET_MAX, Math.max(0, Math.round(height)));

/** The inset for these measures: the header's bottom edge, and nothing at the viewport's foot. */
export const insetFrom = ({ headerBottom }: Measures): ReferenceInset => ({
  top: headerBottom === undefined ? 0 : bounded(headerBottom),
  bottom: 0,
});

type BoardMeasures = Measures & {
  /** The sticky strip of tabs' bottom edge, from the viewport's top; absent without tabs. */
  readonly stripBottom?: number;
  /** The feedback tray's bottom edge, from the viewport's top; absent while it holds no message. */
  readonly trayBottom?: number;
};

/**
 * What a move on the board clears (answering-flow-guidance, decision 4): `insetFrom` with its top
 * raised to the strip of tabs' bottom edge, which sits under the header, and to the tray's, when the
 * board has them.
 */
export const boardInsetFrom = (measures: BoardMeasures): ReferenceInset => {
  const base = insetFrom(measures);
  const edges = [measures.stripBottom, measures.trayBottom].filter(
    (edge): edge is number => edge !== undefined,
  );
  return { ...base, top: Math.max(base.top, ...edges.map(bounded)) };
};
