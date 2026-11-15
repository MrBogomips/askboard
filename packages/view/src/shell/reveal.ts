// One way to move focus to a heading or a field: first scroll it clear of the sticky header and
// the bottom action bar, then focus it without the browser's own scroll (answering-flow-fixes,
// design decision 2; #180). The browser's focus scroll leaves an element that is already partly in
// the viewport where it is, which can be under a bar. `revealDelta` is the arithmetic;
// `revealAndFocus` is the DOM glue, checked in the browser.

import { measureBoardInset } from "./measure-inset.ts";

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

/** How long the arrival mark stays, in milliseconds (decision 4). */
export const ARRIVAL_MS = 1_200;

const CARD = "[data-askboard-question]";
let arrival: { readonly card: Element; readonly timer: number } | undefined;
let animation: number | undefined;

// The arrival mark: one card at a time, one timer, cleared at the next move.
const markArrival = (element: HTMLElement): void => {
  const view = element.ownerDocument.defaultView;
  if (arrival !== undefined) {
    arrival.card.removeAttribute("data-askboard-arrived");
    view?.clearTimeout(arrival.timer);
    arrival = undefined;
  }
  const card = element.closest(CARD);
  if (card === null || view === null) return;
  card.setAttribute("data-askboard-arrived", "");
  arrival = {
    card,
    timer: view.setTimeout(() => {
      card.removeAttribute("data-askboard-arrived");
      arrival = undefined;
    }, ARRIVAL_MS),
  };
};

const scrollSmoothly = (view: Window, delta: number): void => {
  const frames = scrollFrames(view.scrollY, view.scrollY + delta, SCROLL_MS);
  if (animation !== undefined) view.cancelAnimationFrame(animation);
  const start = view.performance.now();
  const step = (now: number) => {
    const elapsed = now - start;
    const frame = frames.find((each) => each.at >= elapsed) ?? frames[frames.length - 1];
    if (frame === undefined) return;
    view.scrollTo({ top: frame.y, behavior: "instant" });
    animation = frame === frames[frames.length - 1] ? undefined : view.requestAnimationFrame(step);
  };
  animation = view.requestAnimationFrame(step);
};

/** Whether the user asks for less motion: the scroll is then instant (decision 4; WCAG 2.3.3). */
const reducedMotion = (view: Window): boolean =>
  view.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls `element` clear of the bars (the header, the strip of tabs and the bottom bar), and gives
 * it focus without the browser's own scroll. Instant by default; `smooth` (After an answer's move
 * and "Continue") scrolls in at most `SCROLL_MS` unless the user asks for less motion, and marks
 * the card where it arrives.
 */
export const revealAndFocus = (
  element: HTMLElement,
  { smooth = false }: { readonly smooth?: boolean } = {},
): void => {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const { top, bottom } = element.getBoundingClientRect();
  const delta = revealDelta(
    { top, bottom },
    measureBoardInset(doc),
    view?.innerHeight ?? 0,
    REVEAL_GAP,
  );
  // Instant: scroll, then focus without scrolling again. Smooth: focus first, then the frames.
  const instant = !smooth || view === null || delta === 0 || reducedMotion(view);
  if (instant && delta !== 0) view?.scrollBy({ top: delta, behavior: "instant" });
  element.focus({ preventScroll: true });
  if (smooth) markArrival(element);
  if (!instant && view !== null) scrollSmoothly(view, delta);
};
