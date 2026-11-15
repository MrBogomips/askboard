// The heights the reading panel sits between (DESIGN.md, Reading panel): from the bottom of the
// view's header down to the top of its bottom action bar, measured in the view's own document, in
// whole CSS pixels and bounded, since the board page takes them from the view and checks them.

import { INSET_MAX, type ReferenceInset } from "../view-protocol.ts";

type Measures = {
  /** The header's bottom edge, from the viewport's top; absent without a header. */
  readonly headerBottom?: number;
  /** The bottom bar's top edge, from the viewport's top; absent without one. */
  readonly footerTop?: number;
  readonly viewportHeight: number;
};

const bounded = (height: number): number => Math.min(INSET_MAX, Math.max(0, Math.round(height)));

/** The inset for these measures: none for a bar the view does not have. */
export const insetFrom = ({
  headerBottom,
  footerTop,
  viewportHeight,
}: Measures): ReferenceInset => ({
  top: headerBottom === undefined ? 0 : bounded(headerBottom),
  bottom: footerTop === undefined ? 0 : bounded(viewportHeight - footerTop),
});

type BoardMeasures = Measures & {
  /** The sticky strip of tabs' bottom edge, from the viewport's top; absent without tabs. */
  readonly stripBottom?: number;
};

/**
 * What a move on the board clears (answering-flow-guidance, decision 4): `insetFrom` with its top
 * raised to the strip of tabs' bottom edge, which sits under the header, when the board has one.
 */
export const boardInsetFrom = (measures: BoardMeasures): ReferenceInset => {
  const base = insetFrom(measures);
  const { stripBottom } = measures;
  return stripBottom === undefined
    ? base
    : { ...base, top: Math.max(base.top, bounded(stripBottom)) };
};
