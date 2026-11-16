import { describe, expect, test } from "bun:test";
import { alignDelta, revealAndFocus, revealDelta } from "./reveal.ts";

// The scroll that clears the sticky bars (answering-flow-fixes, design decision 2; #180): a
// 800 px viewport under a header 60 px down and over a bottom inset of 80 px (the arithmetic keeps a
// bottom inset for the reading panel's sake), with a gap of 8 px, so a box is clear when it lies
// within [68, 712].
const INSET = { top: 60, bottom: 80 };
const VIEWPORT = 800;
const GAP = 8;
const delta = (top: number, bottom: number, inset = INSET) =>
  revealDelta({ top, bottom }, inset, VIEWPORT, GAP);

describe("the scroll that brings a box clear of the bars", () => {
  test("a box inside the band needs none, edges included", () => {
    expect(delta(200, 300)).toBe(0);
    expect(delta(68, 712)).toBe(0);
  });

  test("a box under the bar scrolls down until its bottom is the gap above the bar", () => {
    expect(delta(700, 740)).toBe(28);
    expect(delta(900, 940)).toBe(228);
  });

  test("a box under the header scrolls up until its top is the gap below the header", () => {
    expect(delta(20, 60)).toBe(-48);
    expect(delta(-300, -260)).toBe(-368);
  });

  test("a box taller than the band starts the gap under the header", () => {
    expect(delta(400, 1500)).toBe(332);
    expect(delta(-100, 900)).toBe(-168);
    expect(delta(68, 1500)).toBe(0);
  });

  test("with no header or no bar the inset counts as 0", () => {
    expect(delta(2, 40, { top: 0, bottom: 80 })).toBe(-6);
    expect(delta(0, 40, { top: 0, bottom: 80 })).toBe(-8);
    expect(delta(760, 790, { top: 60, bottom: 0 })).toBe(0);
    expect(delta(780, 800, { top: 60, bottom: 0 })).toBe(8);
    expect(delta(0, 40, { top: 0, bottom: 0 })).toBe(-8);
  });
});

// The DOM glue, against a stand-in document: the real scroll and focus are checked in the browser.
// There is no bottom bar (answering-flow-visual): the header, the strip of tabs and the tray are the
// only bars, so the band ends at the viewport's foot less the gap.
const stubbed = (
  box: { top: number; bottom: number },
  bars: { header?: number; tray?: number },
) => {
  const calls: string[] = [];
  const rect = (edge: number) => ({ getBoundingClientRect: () => ({ top: edge, bottom: edge }) });
  const view = {
    innerHeight: VIEWPORT,
    scrollBy: (options: { top: number; behavior: string }) =>
      calls.push(`scrollBy ${options.top} ${options.behavior}`),
  };
  const doc = {
    defaultView: view,
    querySelector: (selector: string) => {
      if (selector === "header") return bars.header === undefined ? null : rect(bars.header);
      if (selector === "[data-askboard-tray-box]") {
        return bars.tray === undefined ? null : rect(bars.tray);
      }
      return null;
    },
  };
  const element = {
    ownerDocument: doc,
    getBoundingClientRect: () => box,
    focus: (options: { preventScroll: boolean }) => calls.push(`focus ${options.preventScroll}`),
  };
  return { calls, element: element as unknown as HTMLElement };
};

describe("revealing and focusing an element", () => {
  test("scrolls clear of the viewport's foot at once, then focuses without scrolling again", () => {
    const { calls, element } = stubbed({ top: 770, bottom: 810 }, { header: 60 });
    revealAndFocus(element);
    expect(calls).toEqual(["scrollBy 18 instant", "focus true"]);
  });

  test("does not scroll an element already clear", () => {
    const { calls, element } = stubbed({ top: 200, bottom: 240 }, { header: 60 });
    revealAndFocus(element);
    expect(calls).toEqual(["focus true"]);
  });

  test("clears the tray's bottom edge while it holds a message", () => {
    const { calls, element } = stubbed({ top: 100, bottom: 140 }, { header: 60, tray: 180 });
    revealAndFocus(element);
    expect(calls).toEqual(["scrollBy -88 instant", "focus true"]);
  });

  test("with no bar the viewport's edges are the limits", () => {
    const { calls, element } = stubbed({ top: -20, bottom: 20 }, {});
    revealAndFocus(element);
    expect(calls).toEqual(["scrollBy -28 instant", "focus true"]);
  });
});

// The alignment of a move After an answer (answer-moves-to-top, D1, D4): the box's top at the gap
// under the bars, within what the page can scroll. The bars are 60 px, the gap 8: the place is 68.
describe("the scroll that brings a card's top under the bars", () => {
  const align = (top: number, y: number, max: number) =>
    alignDelta({ top, bottom: top + 300 }, INSET, GAP, { y, max });

  test("a card below the bars scrolls down until its top is the gap under them", () => {
    expect(align(900, 0, 5000)).toBe(832);
  });

  test("a card wholly in view still scrolls, up to the place", () => {
    expect(align(300, 0, 5000)).toBe(232);
  });

  test("a card above the bars scrolls up to the place", () => {
    expect(align(-200, 1000, 5000)).toBe(-268);
  });

  test("a card already at the place needs none", () => {
    expect(align(68, 400, 5000)).toBe(0);
  });

  test("a card past what the page can scroll stops at the page's end", () => {
    expect(align(900, 4000, 4300)).toBe(300);
  });

  test("a card above on a page at its top stops at the top", () => {
    expect(align(-50, 20, 5000)).toBe(-20);
  });

  test("a card taller than the span still starts at the place", () => {
    expect(alignDelta({ top: 500, bottom: 2500 }, INSET, GAP, { y: 0, max: 9000 })).toBe(432);
  });

  test("a page that cannot scroll gives 0", () => {
    expect(align(300, 0, 0)).toBe(0);
  });
});
