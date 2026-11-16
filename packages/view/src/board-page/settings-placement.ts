// Where the settings sheet sits (answering-flow-visual, design decision 12): pure, so that it is
// checked without a DOM.

import type { ReferenceInset } from "../view-protocol.ts";

/** The sheet's top and bottom from the view's inset: the header's bottom edge, the viewport's foot. */
export const placementOf = (
  inset: ReferenceInset | undefined,
): { top: string; bottom: string } => ({
  top: `${inset?.top ?? 0}px`,
  bottom: `${inset?.bottom ?? 0}px`,
});
