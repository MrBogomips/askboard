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

/** Where the page stands and the farthest it scrolls: `scrollHeight - innerHeight`. */
export type ScrollRange = { readonly y: number; readonly max: number };

/**
 * The vertical scroll that puts the box's top `gap` under the bars (answer-moves-to-top, D1),
 * wherever the box is now, within what the page can scroll: never above the page's top, never
 * past its end. A page that cannot scroll gives 0.
 */
export const alignDelta = (
  target: Edges,
  inset: Edges,
  gap: number,
  scroll: ScrollRange,
): number => {
  const wanted = target.top - (inset.top + gap);
  return Math.max(-scroll.y, Math.min(wanted, scroll.max - scroll.y));
};

/** Where a move puts its target: the least scroll, the card's top under the bars, or the page's top. */
export type Align = "least" | "card" | "page";

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

/** The scroll a move of this alignment makes now, from the layout as it stands. */
const deltaFor = (view: Window, doc: Document, element: HTMLElement, align: Align): number => {
  const inset = measureBoardInset(doc);
  if (align === "page") return -view.scrollY;
  if (align === "card") {
    const { top, bottom } = (element.closest(CARD) ?? element).getBoundingClientRect();
    const max = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
    return alignDelta({ top, bottom }, inset, REVEAL_GAP, { y: view.scrollY, max });
  }
  const { top, bottom } = element.getBoundingClientRect();
  return revealDelta({ top, bottom }, inset, view.innerHeight, REVEAL_GAP);
};
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

/** What the move reads of a run of frames: where it last put the page, and whether it is over. */
type Move = { last: number; done: boolean; frame?: number };

const scrollSmoothly = (view: Window, delta: number, move: Move, finish: () => void): void => {
  const frames = scrollFrames(view.scrollY, view.scrollY + delta, SCROLL_MS);
  if (animation !== undefined) view.cancelAnimationFrame(animation);
  const start = view.performance.now();
  const step = (now: number) => {
    // The user scrolled meanwhile: the move stops where it is, and never fights the user.
    if (Math.abs(view.scrollY - move.last) > 2) {
      animation = undefined;
      finish();
      return;
    }
    const elapsed = now - start;
    const frame = frames.find((each) => each.at >= elapsed) ?? frames[frames.length - 1];
    if (frame === undefined) return;
    view.scrollTo({ top: frame.y, behavior: "instant" });
    move.last = view.scrollY;
    const lastFrame = frame === frames[frames.length - 1];
    animation = lastFrame ? undefined : view.requestAnimationFrame(step);
    move.frame = animation;
    if (lastFrame) finish();
  };
  animation = view.requestAnimationFrame(step);
  move.frame = animation;
};

/** Whether the user asks for less motion: the scroll is then instant (decision 4; WCAG 2.3.3). */
const reducedMotion = (view: Window): boolean =>
  view.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The time after which every move has ended, whatever the engine did with its frames: the smooth
 * move's length and two frames (e2e-stabilise-answering-flow, D4).
 */
export const MOVE_DEADLINE_MS = SCROLL_MS + 2 * FRAME_MS;

let deadline: number | undefined;

// The page's own value of `overflow-anchor`, kept while a smooth move holds it at none: the
// browser's scroll anchoring would move the page when a card above changes height, which the move
// would read as the user's scroll and stop short of its place.
let anchored: string | undefined;

const holdAnchor = (doc: Document): void => {
  const style = doc.documentElement.style;
  if (anchored === undefined) anchored = style.overflowAnchor;
  style.overflowAnchor = "none";
};

const releaseAnchor = (doc: Document): void => {
  if (anchored === undefined) return;
  doc.documentElement.style.overflowAnchor = anchored;
  anchored = undefined;
};

/** Where the page stands when a move ends: as the move asked. Reads the layout as it is then. */
const land = (view: Window, doc: Document, box: HTMLElement, align: Align): void => {
  const left = deltaFor(view, doc, box, align);
  if (left === 0) return;
  const from = view.scrollY;
  view.scrollBy({ top: left, behavior: "instant" });
  // An engine that ignored "instant" has not moved: scroll to the place without a behavior.
  if (Math.abs(view.scrollY - from) < Math.abs(left) - 1) view.scrollTo({ top: from + left });
};

/**
 * Scrolls `element` clear of the bars (the header, the strip of tabs and the tray), and gives
 * it focus without the browser's own scroll. Instant by default; `smooth` (After an answer's move
 * and "Continue") scrolls in at most `SCROLL_MS` unless the user asks for less motion, and marks
 * the card where it arrives. `resolve` names the element again when the move ends: a re-render
 * that replaced the node meanwhile does not leave focus on the page (#241), and the move ends at
 * `MOVE_DEADLINE_MS` even where the engine never ran its frames. `align` says where the move
 * puts the target: the least scroll that clears the bars (the default), its card's top under them
 * (`"card"`) or the page's top (`"page"`), the landing aligning again the same way.
 */
export const revealAndFocus = (
  element: HTMLElement,
  {
    smooth = false,
    align = "least",
    resolve,
  }: {
    readonly smooth?: boolean;
    readonly align?: Align;
    readonly resolve?: () => HTMLElement | null;
  } = {},
): void => {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const delta = view === null ? 0 : deltaFor(view, doc, element, align);
  // Instant: scroll, then focus without scrolling again. Smooth: focus first, then the frames.
  const instant = !smooth || view === null || delta === 0 || reducedMotion(view);
  if (instant && delta !== 0) view?.scrollBy({ top: delta, behavior: "instant" });
  element.focus({ preventScroll: true });
  if (smooth) markArrival(element);
  if (view === null) return;
  // Every move ends the one before it: its frames and its deadline.
  if (animation !== undefined) view.cancelAnimationFrame(animation);
  animation = undefined;
  if (deadline !== undefined) view.clearTimeout(deadline);
  deadline = undefined;
  releaseAnchor(doc);
  if (!smooth && resolve === undefined) return;
  // The layout or the node may change while the move runs or just after it (a card above settling
  // into its answered look; a re-render): the end of the move leaves the target focused and clear
  // of the bars as it was asked to, unless the user scrolled or moved focus meanwhile.
  if (smooth) holdAnchor(doc);
  const move: Move = { last: view.scrollY, done: false };
  let own: number | undefined;
  const finish = () => {
    if (move.done) return;
    move.done = true;
    // Only this move's own deadline and frames: a later move has set its own.
    if (deadline === own) {
      releaseAnchor(doc);
      if (deadline !== undefined) view.clearTimeout(deadline);
      deadline = undefined;
    }
    if (animation !== undefined && animation === move.frame) {
      view.cancelAnimationFrame(animation);
      animation = undefined;
    }
    const userScrolled = Math.abs(view.scrollY - move.last) > 2;
    const target = resolve === undefined ? element : (resolve() ?? element);
    if (!target.isConnected) return;
    const active = doc.activeElement;
    if (active === null || active === doc.body || !active.isConnected) {
      target.focus({ preventScroll: true });
    }
    if (!userScrolled) land(view, doc, target, align);
  };
  own = view.setTimeout(finish, MOVE_DEADLINE_MS);
  deadline = own;
  if (!instant) scrollSmoothly(view, delta, move, finish);
};
