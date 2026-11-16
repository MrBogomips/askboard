import { describe, expect, test } from "bun:test";
import { ARRIVAL_MS, MOVE_DEADLINE_MS, revealAndFocus, SCROLL_MS } from "./reveal.ts";

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
  /** What the document says has focus: the page's body at first. */
  readonly doc: {
    activeElement: unknown;
    body: object;
    documentElement: { style: { overflowAnchor: string } };
  };
  /** The element's node is gone from the document, and `again` is the node that replaced it. */
  readonly replace: () => HTMLElement;
  /** Moves the element down by `by` px, as a card above settling into a taller layout does. */
  readonly shift: (by: number) => void;
};

const stand = (
  options: {
    reduced?: boolean;
    top?: number;
    inCard?: boolean;
    ignoreInstant?: boolean;
    /** The page's height; the default scrolls far. */
    height?: number;
  } = {},
): Stand => {
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
      if (options.ignoreInstant !== true) view.scrollY += each.top;
    },
    scrollTo: (each: { top: number; behavior?: string }) => {
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
  const body = {};
  const doc = {
    defaultView: view,
    body,
    activeElement: body as unknown,
    querySelector: () => null,
    querySelectorAll: () => ({ length: 0, item: () => null }),
    documentElement: { scrollHeight: options.height ?? 6000, style: { overflowAnchor: "" } },
  };
  let moved = 0;
  const card = {
    // The card starts 40 px above the heading and holds it.
    getBoundingClientRect: () => ({
      top: (options.top ?? 900) - 40 + moved - view.scrollY,
      bottom: (options.top ?? 900) + 200 + moved - view.scrollY,
    }),
    setAttribute: (name: string) => attrs.add(name),
    removeAttribute: (name: string) => attrs.delete(name),
  };
  const element = {
    ownerDocument: doc,
    isConnected: true,
    // The box moves with the scroll, as in a browser: the settle at the end of the move reads it.
    getBoundingClientRect: () => ({
      top: (options.top ?? 900) + moved - view.scrollY,
      bottom: (options.top ?? 900) + 40 + moved - view.scrollY,
    }),
    focus: (each: { preventScroll: boolean }) => {
      calls.push(`focus ${each.preventScroll}`);
      doc.activeElement = element;
    },
    closest: () => (options.inCard === false ? null : card),
  };
  const replace = (): HTMLElement => {
    element.isConnected = false;
    const again = {
      ...element,
      isConnected: true,
      focus: (each: { preventScroll: boolean }) => {
        calls.push(`focus again ${each.preventScroll}`);
        doc.activeElement = again;
      },
    };
    return again as unknown as HTMLElement;
  };
  return {
    calls,
    attrs,
    frames,
    timers,
    view,
    element: element as unknown as HTMLElement,
    doc,
    replace,
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
    expect(s.timers.map((timer) => timer.ms)).toEqual([ARRIVAL_MS, MOVE_DEADLINE_MS]);
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
    expect(s.timers).toHaveLength(4);
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
    // A frame an earlier test left pending may be cancelled first: the module keeps one.
    expect(s.calls.filter((call) => call !== "cancelFrame")).toEqual([
      "scrollBy 148 instant",
      "focus true",
    ]);
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
    expect(s.timers.map((timer) => timer.ms)).toEqual([MOVE_DEADLINE_MS]);
  });
});

// The end of a move that always runs (e2e-stabilise-answering-flow, D4; #241, #242).
describe("the end of a move", () => {
  const deadlineOf = (s: Stand) => s.timers.find((timer) => timer.ms === MOVE_DEADLINE_MS);

  test("frames that never run end at the deadline, on the target and focused", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    deadlineOf(s)?.run();
    expect(s.view.scrollY).toBe(148);
    expect(s.calls).toContain("cancelFrame");
  });

  test("a node replaced meanwhile is resolved again and focused", () => {
    const s = stand();
    let again: HTMLElement | null = null;
    revealAndFocus(s.element, { resolve: () => again });
    again = s.replace();
    s.doc.activeElement = s.doc.body;
    deadlineOf(s)?.run();
    expect(s.calls).toContain("focus again true");
  });

  test("focus that fell to the page is restored", () => {
    const s = stand({ top: 200 });
    revealAndFocus(s.element, { smooth: true });
    s.doc.activeElement = s.doc.body;
    deadlineOf(s)?.run();
    expect(s.calls.filter((call) => call === "focus true")).toHaveLength(2);
  });

  test("a focus the user moved meanwhile is kept", () => {
    const s = stand({ top: 200 });
    revealAndFocus(s.element, { smooth: true });
    const other = { isConnected: true };
    s.doc.activeElement = other;
    deadlineOf(s)?.run();
    expect(s.calls.filter((call) => call === "focus true")).toHaveLength(1);
    expect(s.doc.activeElement).toBe(other);
  });

  test("a scroll the user made meanwhile is kept", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    s.view.scrollY = 300;
    deadlineOf(s)?.run();
    expect(s.view.scrollY).toBe(300);
  });

  test("an engine that ignores instant still lands", () => {
    const s = stand({ ignoreInstant: true, reduced: true });
    revealAndFocus(s.element, { smooth: true });
    deadlineOf(s)?.run();
    expect(s.view.scrollY).toBe(148);
    expect(s.calls).toContain("scrollTo 148 undefined");
  });

  test("a move that follows clears the earlier deadline", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    revealAndFocus(s.element, { smooth: true });
    expect(s.timers.filter((timer) => timer.ms === MOVE_DEADLINE_MS)[0]?.cleared).toBe(true);
  });

  test("an instant move during a smooth one still ends at its deadline", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    revealAndFocus(s.element, { resolve: () => s.element });
    // The earlier move's frame may still run (an engine that does not cancel it in time): it ends
    // that move and must not clear the deadline of the move that follows.
    s.frames.shift()?.(16);
    const own = s.timers.filter((timer) => timer.ms === MOVE_DEADLINE_MS).at(-1);
    expect(own?.cleared).toBe(false);
    expect(s.calls).toContain("cancelFrame");
  });

  test("an instant move with no resolve sets no deadline", () => {
    const s = stand();
    revealAndFocus(s.element);
    expect(s.timers).toEqual([]);
  });

  test("a node gone with nothing to resolve again ends quietly", () => {
    const s = stand({ top: 200 });
    revealAndFocus(s.element, { smooth: true });
    s.replace();
    deadlineOf(s)?.run();
    expect(s.calls.filter((call) => call.startsWith("focus"))).toEqual(["focus true"]);
  });
});

// The alignment (answer-moves-to-top, D1, D3): the card's top, or the page's top, instead of the
// least scroll. The stand's bars are 0 px (no header), so the place is the gap, 8 px, under 0.
describe("a smooth reveal aligned to the card or the page", () => {
  const deadlineOf = (s: Stand) => s.timers.find((timer) => timer.ms === MOVE_DEADLINE_MS);
  const run = (s: Stand) => {
    for (let now = 16; s.frames.length > 0 && now <= SCROLL_MS + 32; now += 16) {
      s.frames.shift()?.(now);
    }
  };

  test('"card" puts the card top 8 px under the bars, smooth', () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true, align: "card" });
    run(s);
    // The card's top is 860: 860 - 8 = 852.
    expect(s.view.scrollY).toBe(852);
  });

  test('"card" puts it there at once under reduced motion', () => {
    const s = stand({ reduced: true });
    revealAndFocus(s.element, { smooth: true, align: "card" });
    expect(s.calls).toContain("scrollBy 852 instant");
    expect(s.frames).toEqual([]);
  });

  test('"card" scrolls a card that is already in view', () => {
    const s = stand({ top: 300 });
    revealAndFocus(s.element, { smooth: true, align: "card" });
    run(s);
    expect(s.view.scrollY).toBe(252);
  });

  test('"card" stops at the page end', () => {
    // The page scrolls 5300 - 800 = 4500 at most; the card would need 4852.
    const s = stand({ top: 4900, height: 5300 });
    s.view.scrollY = 4000;
    revealAndFocus(s.element, { smooth: true, align: "card" });
    run(s);
    expect(s.view.scrollY).toBe(4500);
  });

  test('"page" goes to the top of the page', () => {
    const s = stand({ top: 300, reduced: true });
    s.view.scrollY = 700;
    revealAndFocus(s.element, { smooth: true, align: "page" });
    expect(s.calls).toContain("scrollBy -700 instant");
    expect(s.view.scrollY).toBe(0);
  });

  test('"page" with the page at its top does not scroll', () => {
    const s = stand({ top: 300 });
    revealAndFocus(s.element, { smooth: true, align: "page" });
    expect(s.frames).toEqual([]);
    expect(s.calls.filter((call) => call.startsWith("scroll"))).toEqual([]);
  });

  test("the landing aligns again after a card above changed height", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true, align: "card" });
    s.shift(60);
    run(s);
    deadlineOf(s)?.run();
    expect(s.view.scrollY).toBe(912);
  });

  test("a scroll by the user during the move is kept at the landing", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true, align: "card" });
    s.view.scrollY = 300;
    deadlineOf(s)?.run();
    expect(s.view.scrollY).toBe(300);
  });

  test("the card is the element itself when it sits in no card", () => {
    const s = stand({ inCard: false });
    revealAndFocus(s.element, { smooth: true, align: "card" });
    run(s);
    // The heading's own top, 900: 900 - 8.
    expect(s.view.scrollY).toBe(892);
  });

  test("the default is still the least scroll", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true });
    run(s);
    expect(s.view.scrollY).toBe(148);
  });
});

// The browser's scroll anchoring moves the page when a card above changes height: that is not the
// user scrolling, so a move turns it off until it ends (answer-moves-to-top, D1; found with the
// card's alignment, where the move then stopped short of the place).
describe("scroll anchoring during a move", () => {
  const deadlineOf = (s: Stand) => s.timers.find((timer) => timer.ms === MOVE_DEADLINE_MS);
  const anchor = (s: Stand) => s.doc.documentElement.style.overflowAnchor;

  test("is off while a smooth move runs and restored when it ends", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true, align: "card" });
    expect(anchor(s)).toBe("none");
    deadlineOf(s)?.run();
    expect(anchor(s)).toBe("");
  });

  test("restores the value it found", () => {
    const s = stand();
    s.doc.documentElement.style.overflowAnchor = "auto";
    revealAndFocus(s.element, { smooth: true, align: "card" });
    deadlineOf(s)?.run();
    expect(anchor(s)).toBe("auto");
  });

  test("is left alone by an instant move", () => {
    const s = stand();
    revealAndFocus(s.element, { resolve: () => s.element });
    expect(anchor(s)).toBe("");
  });

  test("a move that follows keeps the value the page had, not none", () => {
    const s = stand();
    revealAndFocus(s.element, { smooth: true, align: "card" });
    revealAndFocus(s.element, { smooth: true, align: "card" });
    s.timers
      .filter((timer) => timer.ms === MOVE_DEADLINE_MS)
      .at(-1)
      ?.run();
    expect(anchor(s)).toBe("");
  });
});
