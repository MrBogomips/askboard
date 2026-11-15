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

/** The longest the smooth move lasts, in milliseconds (WCAG 2.2 SC 2.3.3; design decision 4). */
export const SCROLL_MS = 250;

/** The time between two frames, in milliseconds: about 60 a second. */
export const FRAME_MS = 16;

/** One frame of the smooth move: the scroll position to set `at` milliseconds from its start. */
export type ScrollFrame = { readonly at: number; readonly y: number };

/**
 * The frames of a smooth scroll from `from` to `to`, pure: ease-out (cubic), one frame every
 * `FRAME_MS`, the last at `duration` capped at `SCROLL_MS` and exactly on `to`. A zero delta or
 * no duration gives the one frame, at 0. `revealAndFocus` drives these with `requestAnimationFrame`.
 */
export const scrollFrames = (
  from: number,
  to: number,
  duration: number,
): readonly ScrollFrame[] => {
  const total = Math.min(duration, SCROLL_MS);
  if (from === to || total <= 0) return [{ at: 0, y: to }];
  const frames: ScrollFrame[] = [];
  for (let at = FRAME_MS; at < total; at += FRAME_MS) {
    const left = 1 - at / total;
    frames.push({ at, y: from + (to - from) * (1 - left ** 3) });
  }
  frames.push({ at: total, y: to });
  return frames;
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
