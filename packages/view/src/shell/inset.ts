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
