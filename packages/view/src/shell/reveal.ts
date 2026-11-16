// One way to move focus to a heading or a field: first scroll it clear of the sticky header, the
// strip of tabs and the feedback tray, then focus it without the browser's own scroll (answering-flow-fixes,
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
 * box taller than that span its top at the span's top. The inset is the bars' (`measureBoardInset`):
 * its bottom is 0, the viewport's foot, since the board has no bottom bar.
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

const scrollSmoothly = (view: Window, delta: number, settle: () => void): void => {
  const frames = scrollFrames(view.scrollY, view.scrollY + delta, SCROLL_MS);
  if (animation !== undefined) view.cancelAnimationFrame(animation);
  const start = view.performance.now();
  let last = view.scrollY;
  const step = (now: number) => {
    // The user scrolled meanwhile: the move stops where it is, and never fights the user.
    if (Math.abs(view.scrollY - last) > 2) {
      animation = undefined;
      return;
    }
    const elapsed = now - start;
    const frame = frames.find((each) => each.at >= elapsed) ?? frames[frames.length - 1];
    if (frame === undefined) return;
    view.scrollTo({ top: frame.y, behavior: "instant" });
    last = view.scrollY;
    const lastFrame = frame === frames[frames.length - 1];
    animation = lastFrame ? undefined : view.requestAnimationFrame(step);
    // The layout may have moved while the scroll ran (a card above settling into its answered look):
    // the end of the move leaves the element clear of the bars as it was asked to.
    if (lastFrame) settle();
  };
  animation = view.requestAnimationFrame(step);
};

/** Whether the user asks for less motion: the scroll is then instant (decision 4; WCAG 2.3.3). */
const reducedMotion = (view: Window): boolean =>
  view.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls `element` clear of the bars (the header, the strip of tabs and the tray), and gives
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
  // The layout may move while the move runs or just after it (a card above settling into its
  // answered look): the end of the move leaves the element clear of the bars as it was asked to.
  const settle = () => {
    if (view === null) return;
    const box = element.getBoundingClientRect();
    const left = revealDelta(
      { top: box.top, bottom: box.bottom },
      measureBoardInset(doc),
      view.innerHeight,
      REVEAL_GAP,
    );
    if (left !== 0) view.scrollBy({ top: left, behavior: "instant" });
  };
  if (!instant && view !== null) {
    scrollSmoothly(view, delta, settle);
  } else if (smooth && view !== null) {
    // An instant move after an act (less motion asked): one settle once the time of the smooth move
    // has passed, unless the user scrolled meanwhile.
    const at = view.scrollY;
    view.setTimeout(() => {
      if (Math.abs(view.scrollY - at) <= 2) settle();
    }, SCROLL_MS);
  }
};
