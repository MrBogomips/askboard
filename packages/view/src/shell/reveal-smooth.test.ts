import { describe, expect, test } from "bun:test";
import { ARRIVAL_MS, revealAndFocus, SCROLL_MS } from "./reveal.ts";

// The smooth move and the arrival mark (answering-flow-guidance, D4), against a stand-in window
// whose frames the test runs by hand: the real scroll is checked in the browser, the frames'
// arithmetic in `reveal.test.ts`.
const ARRIVED = "data-askboard-arrived";

type Stand = {
  readonly calls: string[];
  readonly attrs: Set<string>;
  readonly frames: ((now: number) => void)[];
  readonly timers: { readonly run: () => void; readonly ms: number; cleared: boolean }[];
  readonly view: { scrollY: number };
  readonly element: HTMLElement;
  /** Moves the element down by `by` px, as a card above settling into a taller layout does. */
  readonly shift: (by: number) => void;
};

const stand = (options: { reduced?: boolean; top?: number; inCard?: boolean } = {}): Stand => {
  const calls: string[] = [];
  const attrs = new Set<string>();
  const frames: ((now: number) => void)[] = [];
  const timers: Stand["timers"] = [];
  const view = {
    innerHeight: 800,
    scrollY: 0,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: options.reduced === true }),
    scrollBy: (each: { top: number; behavior: string }) => {
      calls.push(`scrollBy ${each.top} ${each.behavior}`);
      view.scrollY += each.top;
    },
    scrollTo: (each: { top: number; behavior: string }) => {
      calls.push(`scrollTo ${Math.round(each.top)} ${each.behavior}`);
      view.scrollY = each.top;
    },
    requestAnimationFrame: (run: (now: number) => void) => frames.push(run),
    cancelAnimationFrame: () => calls.push("cancelFrame"),
    setTimeout: (run: () => void, ms: number) => timers.push({ run, ms, cleared: false }),
    clearTimeout: (id: number) => {
      const timer = timers[id - 1];
      if (timer !== undefined) timer.cleared = true;
    },
  };
  const doc = {
    defaultView: view,
    querySelector: () => null,
    querySelectorAll: () => ({ length: 0, item: () => null }),
  };
  let moved = 0;
  const card = {
    setAttribute: (name: string) => attrs.add(name),
    removeAttribute: (name: string) => attrs.delete(name),
  };
  const element = {
    ownerDocument: doc,
    // The box moves with the scroll, as in a browser: the settle at the end of the move reads it.
    getBoundingClientRect: () => ({
      top: (options.top ?? 900) + moved - view.scrollY,
      bottom: (options.top ?? 900) + 40 + moved - view.scrollY,
    }),
    focus: (each: { preventScroll: boolean }) => calls.push(`focus ${each.preventScroll}`),
    closest: () => (options.inCard === false ? null : card),
  };
  return {
    calls,
    attrs,
    frames,
    timers,
    view,
    element: element as unknown as HTMLElement,
    shift: (by) => {
      moved += by;
    },
  };
};

describe("a smooth reveal", () => {
  test("a layout that moved during the scroll is settled at its end (answering-flow-visual)", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    // The page grows above the element while the frames run: 60 px.
    s.shift(60);
    for (let now = 16; s.frames.length > 0 && now <= SCROLL_MS + 32; now += 16) {
      s.frames.shift()?.(now);
    }
    // 148 for the first delta, 60 more once the move has ended.
    expect(s.view.scrollY).toBe(208);
    expect(s.calls.at(-1)).toBe("scrollBy 60 instant");
  });

  test("focuses first, then scrolls in frames that end on the target, and marks the card", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    // A frame another test left pending may be cancelled first: the module keeps one.
    expect(s.calls.filter((call) => call !== "cancelFrame")).toEqual(["focus true"]);
    expect(s.attrs.has(ARRIVED)).toBe(true);
    expect(s.timers.map((timer) => timer.ms)).toEqual([ARRIVAL_MS]);
    // The delta is 900 + 40 - (800 - 8) = 148; the frames run until the last is on it.
    for (let now = 16; s.frames.length > 0 && now <= SCROLL_MS + 32; now += 16) {
      s.frames.shift()?.(now);
    }
    expect(s.view.scrollY).toBe(148);
    expect(s.calls.filter((call) => call.startsWith("scrollTo")).at(-1)).toBe(
      "scrollTo 148 instant",
    );
    expect(s.frames).toEqual([]);
  });

  test("stops where it is when the user scrolls meanwhile", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    s.frames.shift()?.(16);
    const moved = s.view.scrollY;
    s.view.scrollY = moved + 50;
    const next = s.frames.shift();
    next?.(32);
    expect(s.view.scrollY).toBe(moved + 50);
    expect(s.frames).toEqual([]);
  });

  test("a second move cancels the first's frames and replaces the arrival mark", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    revealAndFocus(s.element, { smooth: true });
    expect(s.calls).toContain("cancelFrame");
    expect(s.timers[0]?.cleared).toBe(true);
    expect(s.timers).toHaveLength(2);
    expect(s.attrs.has(ARRIVED)).toBe(true);
  });

  test("the mark leaves when its time is up", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    s.timers[0]?.run();
    expect(s.attrs.has(ARRIVED)).toBe(false);
  });

  test("with reduced motion the scroll is at once, and the card is still marked", () => {
    const s = stand({ reduced: true });
    revealAndFocus(s.element, { smooth: true });
    expect(s.calls).toEqual(["scrollBy 148 instant", "focus true"]);
    expect(s.frames).toEqual([]);
    expect(s.attrs.has(ARRIVED)).toBe(true);
  });

  test("an element clear of the bars is focused and marked, with no frames", () => {
    const s = stand({ top: 200 });
    revealAndFocus(s.element, { smooth: true });
    expect(s.calls).toEqual(["focus true"]);
    expect(s.frames).toEqual([]);
    expect(s.attrs.has(ARRIVED)).toBe(true);
  });

  test("an element outside a card gets no mark", () => {
    const s = stand({ inCard: false });
    revealAndFocus(s.element, { smooth: true });
    expect(s.attrs.has(ARRIVED)).toBe(false);
    expect(s.timers).toEqual([]);
  });
});
