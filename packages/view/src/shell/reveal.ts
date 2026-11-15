// One way to move focus to a heading or a field: first scroll it clear of the sticky header and
// the bottom action bar, then focus it without the browser's own scroll (answering-flow-fixes,
// design decision 2; #180). The browser's focus scroll leaves an element that is already partly in
// the viewport where it is, which can be under a bar. `revealDelta` is the arithmetic;
// `revealAndFocus` is the DOM glue, checked in the browser.

import { measureInset } from "./measure-inset.ts";

/** The gap, in CSS pixels, a revealed box keeps from the bar it was moved clear of. */
export const REVEAL_GAP = 8;

/** A box's vertical edges, from the viewport's top. */
export type Edges = { readonly top: number; readonly bottom: number };

/**
 * The vertical scroll, in pixels (positive scrolls down), that puts the box wholly within
 * `[inset.top + gap, viewportHeight - inset.bottom - gap]`: 0 for a box already inside, and for a
 * box taller than that span its top at the span's top. The inset is the bars' (`measureInset`),
 * 0 for a bar the view does not have.
 */
export const revealDelta = (
  target: Edges,
  inset: Edges,
  viewportHeight: number,
  gap: number,
): number => {
  const spanTop = inset.top + gap;
  const spanBottom = viewportHeight - inset.bottom - gap;
  if (target.bottom - target.top > spanBottom - spanTop) return target.top - spanTop;
  if (target.top < spanTop) return target.top - spanTop;
  if (target.bottom > spanBottom) return target.bottom - spanBottom;
  return 0;
};

/** Scrolls `element` clear of the bars, at once, then gives it focus without scrolling again. */
export const revealAndFocus = (element: HTMLElement): void => {
  const doc = element.ownerDocument;
  const { top, bottom } = element.getBoundingClientRect();
  const delta = revealDelta(
    { top, bottom },
    measureInset(doc),
    doc.defaultView?.innerHeight ?? 0,
    REVEAL_GAP,
  );
  if (delta !== 0) doc.defaultView?.scrollBy({ top: delta, behavior: "instant" });
  element.focus({ preventScroll: true });
};
